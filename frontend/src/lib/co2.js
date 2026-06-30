// Facteurs d'émission ADEME — Base Empreinte (doivent rester synchronisés
// avec backend/server.py DEFAULT_FACTORS). Chargés dynamiquement depuis
// /api/factors si besoin de précision, ces valeurs servent de fallback
// pour le calcul en temps réel pendant la saisie.
export const DEFAULT_FACTORS = {
  vehicule_thermique: 0.218,
  vehicule_electrique: 0.0195,
  train: 0.00573,
  email_simple: 0.004,
  email_lourd: 0.019,
  visioconference: 0.15,
  stockage_donnees: 0.03,
  electricite: 0.0599,
  gaz: 0.227,
};

export function factorsArrayToMap(arr) {
  if (!arr || !arr.length) return DEFAULT_FACTORS;
  const map = {};
  arr.forEach((f) => { map[f.key] = f.value; });
  return { ...DEFAULT_FACTORS, ...map };
}

export function computeCO2(deplacements = {}, numerique = {}, factors = DEFAULT_FACTORS) {
  const f = factors || DEFAULT_FACTORS;

  const co2_deplacement =
    (Number(deplacements.km_thermique) || 0) * f.vehicule_thermique +
    (Number(deplacements.km_electrique) || 0) * f.vehicule_electrique +
    (Number(deplacements.km_train) || 0) * f.train;

  const co2_numerique =
    (Number(numerique.emails_simples) || 0) * f.email_simple +
    (Number(numerique.emails_lourds) || 0) * f.email_lourd +
    (Number(numerique.heures_visio) || 0) * f.visioconference +
    (Number(numerique.donnees_go) || 0) * f.stockage_donnees;

  return {
    co2_deplacement: Math.round(co2_deplacement * 100) / 100,
    co2_numerique: Math.round(co2_numerique * 100) / 100,
    co2_total: Math.round((co2_deplacement + co2_numerique) * 100) / 100,
  };
}

export function formatKg(value) {
  const v = Math.round((Number(value) || 0) * 10) / 10;
  return `${v.toLocaleString("fr-FR")} kg`;
}

export const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// --- Semaine ISO 8601 ---------------------------------------------------

export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { iso_year: d.getUTCFullYear(), iso_week: weekNo };
}

export function isoWeekToDateRange(iso_year, iso_week) {
  const simple = new Date(Date.UTC(iso_year, 0, 1 + (iso_week - 1) * 7));
  const dayOfWeek = simple.getUTCDay();
  const isoWeekStart = new Date(simple);
  if (dayOfWeek <= 4) {
    isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setUTCDate(isoWeekStart.getUTCDate() + 6);
  return { start: isoWeekStart, end: isoWeekEnd };
}

export function formatWeekLabel(iso_year, iso_week) {
  const { start, end } = isoWeekToDateRange(iso_year, iso_week);
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  return `Semaine ${iso_week} · ${fmt(start)} – ${fmt(end)}`;
}

export function getRecentWeeks(count = 8, fromDate = new Date()) {
  const weeks = [];
  let cursor = new Date(fromDate);
  for (let i = 0; i < count; i++) {
    const { iso_year, iso_week } = getISOWeek(cursor);
    weeks.push({ iso_year, iso_week });
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}
