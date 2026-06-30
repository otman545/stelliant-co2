import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatKg, formatWeekLabel } from "@/lib/co2";
import { Loader2, Image as ImageIcon } from "lucide-react";

export default function ExpertHistorique() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/entries/me");
        setEntries(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalCO2 = entries.reduce((s, e) => s + (e.co2_total || 0), 0);
  const avgWeek = entries.length ? totalCO2 / entries.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Espace expert</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
          Mon historique
        </h1>
        <p className="text-sm text-slate-500 mt-1">Détail de vos saisies hebdomadaires.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Semaines saisies</div>
          <div className="text-2xl font-bold text-slate-900 mt-1" data-testid="stat-nb-saisies">{entries.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Total CO₂eq cumulé</div>
          <div className="text-2xl font-bold text-primary mt-1" data-testid="stat-total-co2">{formatKg(totalCO2)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-5">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Moyenne / semaine</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatKg(avgWeek)}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Détail des saisies</h2>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">Aucune saisie pour l'instant.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="history-table">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider">Semaine</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Déplacements</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Numérique</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Photos</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 font-medium text-slate-900">
                        {formatWeekLabel(e.iso_year, e.iso_week)}
                      </td>
                      <td className="py-3 text-right text-slate-700">{formatKg(e.co2_deplacement)}</td>
                      <td className="py-3 text-right text-slate-700">{formatKg(e.co2_numerique)}</td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
                          <ImageIcon className="w-3 h-3" />
                          {(e.photos || []).length}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold text-primary">{formatKg(e.co2_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
