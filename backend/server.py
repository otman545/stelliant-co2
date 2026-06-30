"""
STELLIANT Lille — Suivi CO2 des experts terrain
Backend FastAPI + MongoDB

Logique de saisie : HEBDOMADAIRE côté expert (clé unique = user_id + iso_year + iso_week)
Logique de pilotage : MENSUELLE côté manager (agrégation automatique des semaines du mois)

Pourquoi hebdomadaire : les données de km, expertises, emails, photos n'existent nulle part
ailleurs que dans la mémoire de l'expert (pas de système centralisé par expert chez
l'économe). Un cycle mensuel impose trop de rappel a posteriori (oublis, approximations).
Le cycle hebdomadaire colle au rythme réel du métier sans saturer l'expert de sollicitations.
"""

import os
import uuid
from datetime import datetime, timedelta, date
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import jwt, JWTError

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "stelliant_co2")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production-stelliant-co2-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 14  # 14 jours
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------------------------------------------------------------------
# Facteurs d'émission ADEME (Base Empreinte) — modifiables en base
# ---------------------------------------------------------------------------

DEFAULT_FACTORS = {
    "vehicule_thermique": 0.218,    # kg CO2eq / km
    "vehicule_electrique": 0.0195,  # kg CO2eq / km
    "train": 0.00573,               # kg CO2eq / km
    "email_simple": 0.004,          # kg CO2eq / email
    "email_lourd": 0.019,           # kg CO2eq / email avec PJ > 5 Mo
    "visioconference": 0.15,        # kg CO2eq / heure
    "stockage_donnees": 0.03,       # kg CO2eq / Go
    "electricite": 0.0599,          # kg CO2eq / kWh
    "gaz": 0.227,                   # kg CO2eq / kWh
}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "expert"  # expert | manager | rse | manager_of_managers


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    active: bool
    created_at: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class Deplacements(BaseModel):
    km_thermique: float = 0
    km_electrique: float = 0
    km_train: float = 0
    nb_deplacements: int = 0
    nb_expertises: int = 0
    jours_bureau: float = 0


class Numerique(BaseModel):
    emails_simples: int = 0
    emails_lourds: int = 0
    heures_visio: float = 0
    donnees_go: float = 0
    nb_rapports: int = 0


class EntryIn(BaseModel):
    """Saisie hebdomadaire d'un expert."""
    iso_year: int
    iso_week: int  # 1-53, semaine ISO 8601
    deplacements: Deplacements
    numerique: Numerique
    photos: List[str] = Field(default_factory=list)  # data URLs (max 20)
    comment: str = ""


class AgencyEnergyIn(BaseModel):
    """Saisie mensuelle manager — l'énergie agence reste un relevé mensuel
    (facture électricité/gaz, pas une donnée terrain hebdo)."""
    month: int
    year: int
    electricity_kwh: float = 0
    gas_kwh: float = 0


class FactorUpdate(BaseModel):
    key: str
    value: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hash_password(p: str) -> str:
    return pwd_context.hash(p)


def verify_password(p: str, hashed: str) -> bool:
    return pwd_context.verify(p, hashed)


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Compte introuvable ou désactivé")
    return user


async def require_manager(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Accès réservé au manager")
    return user


def serialize_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["name"],
        "email": u["email"],
        "role": u["role"],
        "active": u.get("active", True),
        "created_at": u.get("created_at", ""),
    }


def iso_week_bounds(iso_year: int, iso_week: int):
    """Retourne (date_lundi, date_dimanche) pour une semaine ISO donnée."""
    monday = date.fromisocalendar(iso_year, iso_week, 1)
    sunday = date.fromisocalendar(iso_year, iso_week, 7)
    return monday, sunday


def weeks_overlapping_month(month: int, year: int) -> List[tuple]:
    """Retourne la liste des (iso_year, iso_week) dont au moins un jour
    tombe dans le mois calendaire donné. Une semeine est comptée dans le
    mois où elle a la majorité de ses jours (convention : jour du lundi)."""
    first_day = date(year, month, 1)
    if month == 12:
        next_month_first = date(year + 1, 1, 1)
    else:
        next_month_first = date(year, month + 1, 1)
    weeks = set()
    d = first_day
    while d < next_month_first:
        iso = d.isocalendar()
        weeks.add((iso[0], iso[1]))
        d += timedelta(days=1)
    return sorted(weeks)


async def compute_co2_for_entry(deplacements: dict, numerique: dict, factors: dict) -> dict:
    co2_dep = (
        deplacements.get("km_thermique", 0) * factors["vehicule_thermique"]
        + deplacements.get("km_electrique", 0) * factors["vehicule_electrique"]
        + deplacements.get("km_train", 0) * factors["train"]
    )
    co2_num = (
        numerique.get("emails_simples", 0) * factors["email_simple"]
        + numerique.get("emails_lourds", 0) * factors["email_lourd"]
        + numerique.get("heures_visio", 0) * factors["visioconference"]
        + numerique.get("donnees_go", 0) * factors["stockage_donnees"]
    )
    return {
        "co2_deplacement": round(co2_dep, 2),
        "co2_numerique": round(co2_num, 2),
        "co2_total": round(co2_dep + co2_num, 2),
    }


async def get_factors_map() -> dict:
    rows = await db.factors.find().to_list(100)
    if not rows:
        # seed defaults
        for k, v in DEFAULT_FACTORS.items():
            await db.factors.insert_one({"key": k, "value": v})
        return dict(DEFAULT_FACTORS)
    return {r["key"]: r["value"] for r in rows}


# ---------------------------------------------------------------------------
# Lifespan — seed initial data
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_factors_map()

    existing = await db.users.count_documents({})
    if existing == 0:
        manager = {
            "id": str(uuid.uuid4()),
            "name": "Otman Hejjaji",
            "email": "manager@stelliant.fr",
            "password": hash_password("manager123"),
            "role": "manager",
            "active": True,
            "created_at": datetime.utcnow().isoformat(),
        }
        await db.users.insert_one(manager)

        expert_names = [
            "Martin Dubois", "Sara Leroy", "Karim Naji", "Lucie Bernard",
            "Thomas Petit", "Amina Cisse", "Pierre Moreau", "Fatima Ouali",
            "Nicolas Blanc", "Julie Rousseau", "Youssef Tazi",
        ]
        for i, name in enumerate(expert_names, start=1):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "email": f"expert{i}@stelliant.fr",
                "password": hash_password("expert123"),
                "role": "expert",
                "active": True,
                "created_at": datetime.utcnow().isoformat(),
            })
    yield


app = FastAPI(title="STELLIANT CO2 Tracker", lifespan=lifespan)

cors_origins_env = os.environ.get("CORS_ORIGINS", "")
allowed = [FRONTEND_URL]
if cors_origins_env and cors_origins_env != "*":
    allowed.extend([o.strip() for o in cors_origins_env.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------------------

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Compte désactivé")

    token = create_token(user["id"], user["role"])
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=True, samesite="none", max_age=JWT_EXPIRE_HOURS * 3600, path="/",
    )
    return {"user": serialize_user(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


# ---------------------------------------------------------------------------
# USERS (manager only, except self-read)
# ---------------------------------------------------------------------------

@api.get("/users")
async def list_users(user: dict = Depends(require_manager)):
    rows = await db.users.find().sort("name", 1).to_list(200)
    return [serialize_user(r) for r in rows]


@api.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(require_manager)):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email")
    new_user = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": body.email.lower(),
        "password": hash_password(body.password),
        "role": body.role,
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.users.insert_one(new_user)
    return serialize_user(new_user)


@api.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(require_manager)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    update = {}
    if body.name is not None:
        update["name"] = body.name
    if body.role is not None:
        update["role"] = body.role
    if body.active is not None:
        update["active"] = body.active
    if body.password:
        update["password"] = hash_password(body.password)
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    updated = await db.users.find_one({"id": user_id})
    return serialize_user(updated)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_manager)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    await db.users.delete_one({"id": user_id})
    # Soft cleanup: on conserve les entries historiques mais on les marque orphelines
    await db.entries.update_many({"user_id": user_id}, {"$set": {"user_active": False}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# FACTORS (référentiel ADEME, modifiable par le manager)
# ---------------------------------------------------------------------------

@api.get("/factors")
async def get_factors(user: dict = Depends(get_current_user)):
    rows = await db.factors.find().to_list(100)
    return rows if rows else [{"key": k, "value": v} for k, v in DEFAULT_FACTORS.items()]


@api.put("/factors")
async def update_factor(body: FactorUpdate, user: dict = Depends(require_manager)):
    await db.factors.update_one(
        {"key": body.key}, {"$set": {"value": body.value}}, upsert=True
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# ENTRIES — saisie HEBDOMADAIRE des experts
# ---------------------------------------------------------------------------

@api.get("/entries/me/current")
async def get_my_current_week(iso_year: int, iso_week: int, user: dict = Depends(get_current_user)):
    entry = await db.entries.find_one({
        "user_id": user["id"], "iso_year": iso_year, "iso_week": iso_week
    })
    if not entry:
        return None
    entry.pop("_id", None)
    return entry


@api.get("/entries/me")
async def get_my_entries(user: dict = Depends(get_current_user)):
    rows = await db.entries.find({"user_id": user["id"]}).sort(
        [("iso_year", -1), ("iso_week", -1)]
    ).to_list(500)
    for r in rows:
        r.pop("_id", None)
    return rows


@api.post("/entries")
async def submit_entry(body: EntryIn, user: dict = Depends(get_current_user)):
    if len(body.photos) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 photos par saisie")
    if len(body.comment) > 2000:
        raise HTTPException(status_code=400, detail="Commentaire limité à 2000 caractères")

    factors = await get_factors_map()
    co2 = await compute_co2_for_entry(body.deplacements.dict(), body.numerique.dict(), factors)
    monday, sunday = iso_week_bounds(body.iso_year, body.iso_week)

    existing = await db.entries.find_one({
        "user_id": user["id"], "iso_year": body.iso_year, "iso_week": body.iso_week
    })

    doc = {
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "iso_year": body.iso_year,
        "iso_week": body.iso_week,
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat(),
        "deplacements": body.deplacements.dict(),
        "numerique": body.numerique.dict(),
        "photos": body.photos,
        "comment": body.comment,
        "user_active": True,
        **co2,
        "updated_at": datetime.utcnow().isoformat(),
    }

    if existing:
        await db.entries.update_one(
            {"user_id": user["id"], "iso_year": body.iso_year, "iso_week": body.iso_week},
            {"$set": doc},
        )
    else:
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = datetime.utcnow().isoformat()
        await db.entries.insert_one(doc)

    doc.pop("_id", None)
    return doc


@api.get("/entries")
async def list_all_entries(user: dict = Depends(require_manager)):
    rows = await db.entries.find().sort(
        [("iso_year", -1), ("iso_week", -1)]
    ).to_list(2000)
    for r in rows:
        r.pop("_id", None)
    return rows


# ---------------------------------------------------------------------------
# AGENCY ENERGY — saisie mensuelle manager
# ---------------------------------------------------------------------------

@api.get("/agency-energy")
async def list_agency_energy(user: dict = Depends(require_manager)):
    rows = await db.agency_energy.find().sort([("year", -1), ("month", -1)]).to_list(100)
    for r in rows:
        r.pop("_id", None)
    return rows


@api.post("/agency-energy")
async def submit_agency_energy(body: AgencyEnergyIn, user: dict = Depends(require_manager)):
    factors = await get_factors_map()
    co2_elec = round(body.electricity_kwh * factors["electricite"], 2)
    co2_gaz = round(body.gas_kwh * factors["gaz"], 2)

    doc = {
        "month": body.month,
        "year": body.year,
        "electricity_kwh": body.electricity_kwh,
        "gas_kwh": body.gas_kwh,
        "co2_electricite": co2_elec,
        "co2_gaz": co2_gaz,
        "co2_total": round(co2_elec + co2_gaz, 2),
        "updated_at": datetime.utcnow().isoformat(),
    }

    existing = await db.agency_energy.find_one({"month": body.month, "year": body.year})
    if existing:
        await db.agency_energy.update_one(
            {"month": body.month, "year": body.year}, {"$set": doc}
        )
    else:
        doc["id"] = str(uuid.uuid4())
        await db.agency_energy.insert_one(doc)

    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# DASHBOARD — agrégation MENSUELLE automatique des saisies hebdomadaires
# ---------------------------------------------------------------------------

@api.get("/dashboard/summary")
async def dashboard_summary(month: int, year: int, user: dict = Depends(require_manager)):
    target_weeks = weeks_overlapping_month(month, year)
    week_filter = {"$or": [{"iso_year": y, "iso_week": w} for y, w in target_weeks]}

    entries = await db.entries.find(week_filter).to_list(2000)

    co2_dep = sum(e.get("co2_deplacement", 0) for e in entries)
    co2_num = sum(e.get("co2_numerique", 0) for e in entries)

    energy = await db.agency_energy.find_one({"month": month, "year": year})
    co2_energie = energy.get("co2_total", 0) if energy else 0

    total_experts = await db.users.count_documents({"role": "expert", "active": True})
    submitted_user_ids = set(e["user_id"] for e in entries)
    nb_submitted = len(submitted_user_ids)
    collection_rate = round((nb_submitted / total_experts) * 100) if total_experts else 0

    return {
        "month": month,
        "year": year,
        "co2_deplacement": round(co2_dep, 2),
        "co2_numerique": round(co2_num, 2),
        "co2_energie": round(co2_energie, 2),
        "co2_total": round(co2_dep + co2_num + co2_energie, 2),
        "nb_experts": total_experts,
        "nb_submitted": nb_submitted,
        "collection_rate": collection_rate,
        "nb_weeks_in_month": len(target_weeks),
        "nb_entries": len(entries),
    }


@api.get("/dashboard/monthly-trend")
async def dashboard_monthly_trend(user: dict = Depends(require_manager)):
    """12 derniers mois calendaires, calculés par arithmétique de date directe
    (pas d'offset en jours qui dérive)."""
    now = datetime.utcnow()
    months = []
    total_index = now.year * 12 + (now.month - 1)
    for i in range(11, -1, -1):
        idx = total_index - i
        y, m = divmod(idx, 12)
        months.append((y, m + 1))

    MONTHS_FR_SHORT = ["jan", "fév", "mar", "avr", "mai", "jun",
                        "jul", "aoû", "sep", "oct", "nov", "déc"]

    result = []
    for (y, m) in months:
        target_weeks = weeks_overlapping_month(m, y)
        week_filter = {"$or": [{"iso_year": wy, "iso_week": ww} for wy, ww in target_weeks]}
        entries = await db.entries.find(week_filter).to_list(2000)
        co2_dep = round(sum(e.get("co2_deplacement", 0) for e in entries), 2)
        co2_num = round(sum(e.get("co2_numerique", 0) for e in entries), 2)
        energy = await db.agency_energy.find_one({"month": m, "year": y})
        co2_energie = energy.get("co2_total", 0) if energy else 0
        result.append({
            "month": m, "year": y,
            "label": f"{MONTHS_FR_SHORT[m-1]} {str(y)[2:]}",
            "deplacement": co2_dep, "numerique": co2_num, "energie": co2_energie,
            "total": round(co2_dep + co2_num + co2_energie, 2),
        })
    return result


@api.get("/dashboard/collection-status")
async def collection_status(month: int, year: int, user: dict = Depends(require_manager)):
    target_weeks = weeks_overlapping_month(month, year)
    week_filter = {"$or": [{"iso_year": y, "iso_week": w} for y, w in target_weeks]}
    entries = await db.entries.find(week_filter).to_list(2000)
    submitted_ids = set(e["user_id"] for e in entries)

    experts = await db.users.find({"role": "expert", "active": True}).sort("name", 1).to_list(200)
    return [
        {
            "user_id": ex["id"],
            "name": ex["name"],
            "email": ex["email"],
            "submitted": ex["id"] in submitted_ids,
            "nb_weeks_submitted": len([e for e in entries if e["user_id"] == ex["id"]]),
            "nb_weeks_expected": len(target_weeks),
        }
        for ex in experts
    ]


@api.get("/dashboard/week-status")
async def week_status(iso_year: int, iso_week: int, user: dict = Depends(require_manager)):
    """Statut de collecte pour UNE semaine précise (vue plus fine que le mois)."""
    entries = await db.entries.find({"iso_year": iso_year, "iso_week": iso_week}).to_list(200)
    submitted_ids = set(e["user_id"] for e in entries)
    experts = await db.users.find({"role": "expert", "active": True}).sort("name", 1).to_list(200)
    monday, sunday = iso_week_bounds(iso_year, iso_week)
    return {
        "iso_year": iso_year, "iso_week": iso_week,
        "week_start": monday.isoformat(), "week_end": sunday.isoformat(),
        "experts": [
            {"user_id": ex["id"], "name": ex["name"], "submitted": ex["id"] in submitted_ids}
            for ex in experts
        ],
    }


# ---------------------------------------------------------------------------
# CSV EXPORT
# ---------------------------------------------------------------------------

@api.get("/export/csv")
async def export_csv(user: dict = Depends(require_manager)):
    import csv
    import io

    rows = await db.entries.find().sort([("iso_year", -1), ("iso_week", -1)]).to_list(5000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Expert", "Email", "Année ISO", "Semaine ISO", "Début semaine", "Fin semaine",
        "Km thermique", "Km électrique", "Km train", "Nb expertises", "Jours bureau",
        "Emails simples", "Emails lourds", "Heures visio", "Données (Go)",
        "CO2 déplacements (kg)", "CO2 numérique (kg)", "CO2 total (kg)",
        "Nb photos", "Commentaire",
    ])
    for r in rows:
        dep = r.get("deplacements", {})
        num = r.get("numerique", {})
        writer.writerow([
            r.get("user_name", ""), r.get("user_email", ""),
            r.get("iso_year", ""), r.get("iso_week", ""),
            r.get("week_start", ""), r.get("week_end", ""),
            dep.get("km_thermique", 0), dep.get("km_electrique", 0), dep.get("km_train", 0),
            dep.get("nb_expertises", 0), dep.get("jours_bureau", 0),
            num.get("emails_simples", 0), num.get("emails_lourds", 0),
            num.get("heures_visio", 0), num.get("donnees_go", 0),
            r.get("co2_deplacement", 0), r.get("co2_numerique", 0), r.get("co2_total", 0),
            len(r.get("photos", [])), (r.get("comment", "") or "").replace("\n", " "),
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stelliant_co2_export.csv"},
    )


app.include_router(api)
