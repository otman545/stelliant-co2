import { useEffect, useMemo, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  computeCO2, formatKg, factorsArrayToMap,
  getISOWeek, formatWeekLabel, getRecentWeeks,
} from "@/lib/co2";
import { toast } from "sonner";
import {
  Car, Wifi, Image as ImageIcon, Plug, Train, Mail, Video,
  HardDrive, Save, Trash2, Loader2, ChevronLeft, ChevronRight, CalendarDays,
} from "lucide-react";

function NumField({ id, label, value, onChange, suffix, testid, step = 1 }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-slate-600 font-medium">{label}</label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          data-testid={testid}
          className="w-full h-11 px-3 pr-12 rounded-md border border-slate-200 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-colors"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function PostBreakdown({ icon: Icon, label, v }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-md p-3">
      <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 truncate">{label}</div>
        <div className="text-sm font-semibold text-slate-900">{formatKg(v)}</div>
      </div>
    </div>
  );
}

const EMPTY_DEP = { km_thermique: 0, km_electrique: 0, km_train: 0, nb_deplacements: 0, nb_expertises: 0, jours_bureau: 0 };
const EMPTY_NUM = { emails_simples: 0, emails_lourds: 0, heures_visio: 0, donnees_go: 0, nb_rapports: 0 };

export default function ExpertSaisie() {
  const current = getISOWeek();
  const [isoYear, setIsoYear] = useState(current.iso_year);
  const [isoWeek, setIsoWeek] = useState(current.iso_week);
  const [factors, setFactors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("deplacements");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [deplacements, setDeplacements] = useState(EMPTY_DEP);
  const [numerique, setNumerique] = useState(EMPTY_NUM);
  const [photos, setPhotos] = useState([]);
  const [comment, setComment] = useState("");

  const co2 = useMemo(
    () => computeCO2(deplacements, numerique, factors || undefined),
    [deplacements, numerique, factors]
  );

  const recentWeeks = useMemo(() => getRecentWeeks(8), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: fdata }, { data: entry }] = await Promise.all([
          api.get("/factors"),
          api.get("/entries/me/current", { params: { iso_year: isoYear, iso_week: isoWeek } }),
        ]);
        if (!mounted) return;
        setFactors(factorsArrayToMap(fdata));
        if (entry) {
          setDeplacements({ ...EMPTY_DEP, ...entry.deplacements });
          setNumerique({ ...EMPTY_NUM, ...entry.numerique });
          setPhotos(entry.photos || []);
          setComment(entry.comment || "");
          setAlreadySubmitted(true);
        } else {
          setDeplacements(EMPTY_DEP);
          setNumerique(EMPTY_NUM);
          setPhotos([]);
          setComment("");
          setAlreadySubmitted(false);
        }
      } catch (e) {
        toast.error("Erreur de chargement : " + formatApiErrorDetail(e.response?.data?.detail));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isoYear, isoWeek]);

  const goToWeek = (yr, wk) => { setIsoYear(yr); setIsoWeek(wk); };

  const shiftWeek = (delta) => {
    const idx = recentWeeks.findIndex((w) => w.iso_year === isoYear && w.iso_week === isoWeek);
    if (idx === -1) return;
    const target = recentWeeks[idx - delta]; // recentWeeks[0] = plus récente
    if (target) goToWeek(target.iso_year, target.iso_week);
  };

  const handlePhotos = async (files) => {
    const arr = Array.from(files || []);
    const next = [...photos];
    for (const f of arr) {
      if (next.length >= 20) break;
      const dataUrl = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(f);
      });
      next.push(dataUrl);
    }
    setPhotos(next);
  };

  const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i));

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/entries", {
        iso_year: isoYear, iso_week: isoWeek, deplacements, numerique, photos, comment,
      });
      toast.success(`Saisie ${formatWeekLabel(isoYear, isoWeek)} enregistrée`);
      setAlreadySubmitted(true);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const setDep = (k, v) => setDeplacements({ ...deplacements, [k]: v });
  const setNum = (k, v) => setNumerique({ ...numerique, [k]: v });

  const currentIdx = recentWeeks.findIndex((w) => w.iso_year === isoYear && w.iso_week === isoWeek);
  const isCurrentWeek = currentIdx === 0;

  return (
    <div className="space-y-6 pb-32">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Espace expert</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
          Saisie hebdomadaire
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Renseignez votre semaine. Le CO₂ se calcule en temps réel.
        </p>
      </div>

      {/* Week selector */}
      <div className="bg-white border border-slate-200 rounded-md p-4 flex items-center justify-between gap-3">
        <button
          onClick={() => shiftWeek(-1)}
          disabled={currentIdx <= 0}
          className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200
                     hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="week-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 text-center">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <div>
            <div className="font-semibold text-slate-900 text-sm sm:text-base" data-testid="current-week-label">
              {formatWeekLabel(isoYear, isoWeek)}
            </div>
            {isCurrentWeek && (
              <div className="text-[11px] text-primary font-medium">Semaine en cours</div>
            )}
            {alreadySubmitted && (
              <div className="text-[11px] text-emerald-600 font-medium">Déjà saisie — modifiable</div>
            )}
          </div>
        </div>
        <button
          onClick={() => shiftWeek(1)}
          disabled={currentIdx <= 0}
          className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200
                     hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="week-next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="grid grid-cols-3 bg-slate-100 rounded-md p-1 gap-1">
            {[
              { id: "deplacements", label: "Déplacements", icon: Car },
              { id: "numerique", label: "Numérique", icon: Wifi },
              { id: "photos", label: "Photos", icon: ImageIcon },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`flex items-center justify-center gap-1.5 h-10 rounded-md text-sm font-medium
                  transition-colors ${tab === t.id ? "bg-white shadow-sm text-primary" : "text-slate-500"}`}
              >
                <t.icon className="w-4 h-4 hidden sm:inline" />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "deplacements" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-md p-5">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Déplacements de la semaine</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <NumField id="km_thermique" label="Véhicule thermique" suffix="km" value={deplacements.km_thermique} onChange={(v) => setDep("km_thermique", v)} testid="input-km-thermique" />
                  <NumField id="km_electrique" label="Véhicule électrique" suffix="km" value={deplacements.km_electrique} onChange={(v) => setDep("km_electrique", v)} testid="input-km-electrique" />
                  <NumField id="km_train" label="Train" suffix="km" value={deplacements.km_train} onChange={(v) => setDep("km_train", v)} testid="input-km-train" />
                  <NumField id="nb_deplacements" label="Nombre de déplacements" value={deplacements.nb_deplacements} onChange={(v) => setDep("nb_deplacements", v)} testid="input-nb-deplacements" />
                  <NumField id="nb_expertises" label="Expertises réalisées" value={deplacements.nb_expertises} onChange={(v) => setDep("nb_expertises", v)} testid="input-nb-expertises" />
                  <NumField id="jours_bureau" label="Jours au bureau" suffix="j" value={deplacements.jours_bureau} onChange={(v) => setDep("jours_bureau", v)} testid="input-jours-bureau" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PostBreakdown icon={Car} label="Véhicule thermique" v={(Number(deplacements.km_thermique) || 0) * (factors?.vehicule_thermique || 0.218)} />
                <PostBreakdown icon={Plug} label="Véhicule électrique" v={(Number(deplacements.km_electrique) || 0) * (factors?.vehicule_electrique || 0.0195)} />
                <PostBreakdown icon={Train} label="Train" v={(Number(deplacements.km_train) || 0) * (factors?.train || 0.00573)} />
              </div>
            </div>
          )}

          {tab === "numerique" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-md p-5">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Empreinte numérique de la semaine</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <NumField id="emails_simples" label="Emails envoyés (simples)" value={numerique.emails_simples} onChange={(v) => setNum("emails_simples", v)} testid="input-emails-simples" />
                  <NumField id="emails_lourds" label="Emails avec PJ lourde (>5 Mo)" value={numerique.emails_lourds} onChange={(v) => setNum("emails_lourds", v)} testid="input-emails-lourds" />
                  <NumField id="heures_visio" label="Visioconférence" suffix="h" step={0.5} value={numerique.heures_visio} onChange={(v) => setNum("heures_visio", v)} testid="input-heures-visio" />
                  <NumField id="donnees_go" label="Données / photos envoyées" suffix="Go" step={0.1} value={numerique.donnees_go} onChange={(v) => setNum("donnees_go", v)} testid="input-donnees-go" />
                  <NumField id="nb_rapports" label="Rapports d'expertise rédigés" value={numerique.nb_rapports} onChange={(v) => setNum("nb_rapports", v)} testid="input-nb-rapports" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <PostBreakdown icon={Mail} label="Emails simples" v={(Number(numerique.emails_simples) || 0) * (factors?.email_simple || 0.004)} />
                <PostBreakdown icon={Mail} label="Emails lourds" v={(Number(numerique.emails_lourds) || 0) * (factors?.email_lourd || 0.019)} />
                <PostBreakdown icon={Video} label="Visio" v={(Number(numerique.heures_visio) || 0) * (factors?.visioconference || 0.15)} />
                <PostBreakdown icon={HardDrive} label="Données" v={(Number(numerique.donnees_go) || 0) * (factors?.stockage_donnees || 0.03)} />
              </div>
            </div>
          )}

          {tab === "photos" && (
            <div className="bg-white border border-slate-200 rounded-md p-5 space-y-5">
              <h3 className="text-lg font-semibold text-slate-900">Photos & observations</h3>
              <div>
                <label className="text-xs text-slate-600 font-medium">Photos de sinistres cette semaine (max 20)</label>
                <div className="mt-2">
                  <label className="flex items-center justify-center w-full h-32 border-2 border-dashed
                                     border-slate-200 rounded-md cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file" multiple accept="image/*"
                      onChange={(e) => handlePhotos(e.target.files)}
                      className="hidden" data-testid="photos-input"
                    />
                    <div className="text-center text-sm text-slate-500">
                      <ImageIcon className="w-6 h-6 mx-auto mb-2" />
                      Glisser/déposer ou cliquer pour ajouter
                    </div>
                  </label>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4" data-testid="photos-grid">
                    {photos.map((p, i) => (
                      <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-slate-200">
                        <img src={p} alt={`p-${i}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 p-1 bg-white/90 rounded-md opacity-0
                                     group-hover:opacity-100 transition-opacity"
                          data-testid={`remove-photo-${i}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="comment" className="text-xs text-slate-600 font-medium">Observations de la semaine</label>
                <textarea
                  id="comment" value={comment} onChange={(e) => setComment(e.target.value)}
                  rows={4} placeholder="Notes complémentaires..."
                  data-testid="comment-input"
                  className="w-full mt-1.5 px-3 py-2 rounded-md border border-slate-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Sticky CO2 bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-lg lg:left-64">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-[1400px] mx-auto">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Déplacements</div>
              <div className="text-base sm:text-lg font-semibold text-slate-900" data-testid="co2-deplacement">
                {formatKg(co2.co2_deplacement)}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Numérique</div>
              <div className="text-base sm:text-lg font-semibold text-slate-900" data-testid="co2-numerique">
                {formatKg(co2.co2_numerique)}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Total semaine</div>
              <div className="text-xl sm:text-2xl font-bold text-primary" data-testid="co2-total">
                {formatKg(co2.co2_total)}
              </div>
            </div>
          </div>
          <button
            onClick={submit} disabled={saving}
            data-testid="submit-button"
            className="w-full sm:w-auto h-11 px-6 rounded-md bg-primary text-white font-medium text-sm
                       flex items-center justify-center gap-2 hover:bg-primary-hover
                       active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {alreadySubmitted ? "Mettre à jour ma saisie" : "Valider ma saisie"}
          </button>
        </div>
      </div>
    </div>
  );
}
