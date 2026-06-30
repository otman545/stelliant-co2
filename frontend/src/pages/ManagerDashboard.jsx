import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { MONTHS_FR, formatKg } from "@/lib/co2";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Car, Wifi, Zap, Users, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

const COLORS = { deplacement: "#0055A4", numerique: "#3B82F6", energie: "#93C5FD" };
const now = new Date();

function KpiCard({ icon: Icon, label, value, sub, accent, testid }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md p-5" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${accent ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className={`text-2xl font-bold mt-2 ${accent ? "text-primary" : "text-slate-900"}`}>{value}</div>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}

function PostBar({ label, value, pct, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
          <span className="text-sm text-slate-700">{label}</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">
          {formatKg(value)} <span className="text-slate-400 font-normal">· {pct}%</span>
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [s, t, c] = await Promise.all([
          api.get("/dashboard/summary", { params: { month, year } }),
          api.get("/dashboard/monthly-trend"),
          api.get("/dashboard/collection-status", { params: { month, year } }),
        ]);
        if (!mounted) return;
        setSummary(s.data);
        setTrend(t.data);
        setCollection(c.data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [month, year]);

  const donutData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Déplacements", value: summary.co2_deplacement, color: COLORS.deplacement },
      { name: "Numérique", value: summary.co2_numerique, color: COLORS.numerique },
      { name: "Énergie agence", value: summary.co2_energie, color: COLORS.energie },
    ].filter((d) => d.value > 0);
  }, [summary]);

  const prevMonth = useMemo(() => {
    if (!trend.length || !summary) return null;
    const idx = trend.findIndex((t) => t.year === summary.year && t.month === summary.month);
    return idx > 0 ? trend[idx - 1] : null;
  }, [trend, summary]);

  const trendDelta = useMemo(() => {
    if (!prevMonth || !summary || !prevMonth.total) return null;
    return ((summary.co2_total - prevMonth.total) / prevMonth.total) * 100;
  }, [prevMonth, summary]);

  if (loading || !summary) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const total = summary.co2_total || 1;
  const pct = (v) => Math.min(100, Math.round((v / total) * 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Espace manager</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            Tableau de bord CO₂
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Vue mensuelle — agrège automatiquement les {summary.nb_weeks_in_month} semaines du mois.
          </p>
        </div>
        <div className="flex gap-3" data-testid="dashboard-filters">
          <select
            value={month} onChange={(e) => setMonth(Number(e.target.value))}
            data-testid="dashboard-month"
            className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white"
          >
            {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year} onChange={(e) => setYear(Number(e.target.value))}
            data-testid="dashboard-year"
            className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white"
          >
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingUp} label="Total CO₂ — mois" value={formatKg(summary.co2_total)} accent
          sub={trendDelta != null && (
            <span className={`flex items-center gap-1 text-xs ${trendDelta > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {trendDelta > 0 ? <TrendingUp className="w-3 h-3" /> : trendDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {Math.abs(trendDelta).toFixed(1)}% vs mois précédent
            </span>
          )}
          testid="kpi-total"
        />
        <KpiCard icon={Car} label="Déplacements" value={formatKg(summary.co2_deplacement)} testid="kpi-deplacement" />
        <KpiCard icon={Wifi} label="Numérique" value={formatKg(summary.co2_numerique)} testid="kpi-numerique" />
        <KpiCard icon={Zap} label="Énergie agence" value={formatKg(summary.co2_energie)} testid="kpi-energie" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Taux de collecte</h3>
            <span className="text-xs border border-slate-200 rounded-full px-2 py-0.5 text-slate-500">Objectif 90%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-900" data-testid="collection-rate">{summary.collection_rate}%</span>
            <span className="text-sm text-slate-500">{summary.nb_submitted}/{summary.nb_experts} experts</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${summary.collection_rate}%` }} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />
            {summary.nb_entries} saisie(s) hebdo sur {summary.nb_weeks_in_month} semaine(s) du mois
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-md p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Répartition des émissions — {MONTHS_FR[month - 1]} {year}</h3>
          {donutData.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-10">Aucune émission enregistrée pour ce mois.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatKg(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <PostBar label="Déplacements" value={summary.co2_deplacement} pct={pct(summary.co2_deplacement)} color={COLORS.deplacement} />
                <PostBar label="Numérique" value={summary.co2_numerique} pct={pct(summary.co2_numerique)} color={COLORS.numerique} />
                <PostBar label="Énergie agence" value={summary.co2_energie} pct={pct(summary.co2_energie)} color={COLORS.energie} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Évolution sur 12 mois</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E2E8F0" />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E2E8F0" />
              <Tooltip formatter={(v) => formatKg(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deplacement" stackId="a" fill={COLORS.deplacement} name="Déplacements" />
              <Bar dataKey="numerique" stackId="a" fill={COLORS.numerique} name="Numérique" />
              <Bar dataKey="energie" stackId="a" fill={COLORS.energie} name="Énergie" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-5">
        <h3 className="font-semibold text-slate-900 mb-4">
          Statut des saisies — {MONTHS_FR[month - 1]} {year}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="collection-grid">
          {collection.map((c) => (
            <div key={c.user_id} className="flex items-center justify-between border border-slate-200 rounded-md p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{c.name || c.email}</div>
                <div className="text-xs text-slate-500 truncate">
                  {c.nb_weeks_submitted}/{c.nb_weeks_expected} semaines saisies
                </div>
              </div>
              {c.submitted ? (
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 shrink-0">
                  Validé
                </span>
              ) : (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 shrink-0">
                  En attente
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
