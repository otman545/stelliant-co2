import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { MONTHS_FR, formatKg, factorsArrayToMap } from "@/lib/co2";
import { toast } from "sonner";
import { Zap, Flame, Loader2, Save } from "lucide-react";

const now = new Date();

export default function ManagerEnergie() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [electricity, setElectricity] = useState(0);
  const [gas, setGas] = useState(0);
  const [list, setList] = useState([]);
  const [factors, setFactors] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: f }, { data: l }] = await Promise.all([
      api.get("/factors"), api.get("/agency-energy"),
    ]);
    setFactors(factorsArrayToMap(f));
    setList(l);
    const existing = l.find((x) => x.month === month && x.year === year);
    setElectricity(existing?.electricity_kwh || 0);
    setGas(existing?.gas_kwh || 0);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month, year]);

  const co2 = factors
    ? { co2_elec: Number(electricity) * (factors.electricite || 0.0599), co2_gaz: Number(gas) * (factors.gaz || 0.227) }
    : { co2_elec: 0, co2_gaz: 0 };

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/agency-energy", { month, year, electricity_kwh: Number(electricity) || 0, gas_kwh: Number(gas) || 0 });
      toast.success("Consommation enregistrée");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Espace manager</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">Énergie de l'agence</h1>
        <p className="text-sm text-slate-500 mt-1">Saisie mensuelle (relevé de facture électricité/gaz).</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-md">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-semibold text-slate-900">Saisie pour la période</h3>
          <div className="flex gap-3">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} data-testid="energy-month"
              className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white">
              {MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} data-testid="energy-year"
              className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white">
              {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-slate-600 font-medium">Électricité consommée</label>
            <div className="relative mt-1.5">
              <input type="number" value={electricity} onChange={(e) => setElectricity(e.target.value)} data-testid="electricity-input"
                className="w-full h-11 px-3 pr-12 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">kWh</span>
            </div>
            <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-md p-3">
              <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary"><Zap className="w-4 h-4" /></div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">CO₂ électricité</div>
                <div className="text-lg font-semibold text-slate-900" data-testid="co2-elec">{formatKg(co2.co2_elec)}</div>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium">Gaz / chauffage</label>
            <div className="relative mt-1.5">
              <input type="number" value={gas} onChange={(e) => setGas(e.target.value)} data-testid="gas-input"
                className="w-full h-11 px-3 pr-12 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">kWh</span>
            </div>
            <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-md p-3">
              <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary"><Flame className="w-4 h-4" /></div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">CO₂ gaz</div>
                <div className="text-lg font-semibold text-slate-900" data-testid="co2-gas">{formatKg(co2.co2_gaz)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-5 flex justify-between items-center border-t border-slate-200">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Total mois</div>
            <div className="text-2xl font-bold text-primary" data-testid="energy-total">{formatKg(co2.co2_elec + co2.co2_gaz)}</div>
          </div>
          <button onClick={submit} disabled={saving} data-testid="save-energy-button"
            className="h-11 px-6 rounded-md bg-primary text-white font-medium text-sm flex items-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md">
        <div className="p-5 border-b border-slate-200"><h3 className="font-semibold text-slate-900">Historique</h3></div>
        <div className="p-5">
          {list.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-8">Aucune saisie d'énergie pour l'instant.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider">Période</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Élec. (kWh)</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Gaz (kWh)</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">CO₂ élec.</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">CO₂ gaz</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 font-medium text-slate-900">{MONTHS_FR[e.month - 1]} {e.year}</td>
                      <td className="py-3 text-right text-slate-700">{e.electricity_kwh}</td>
                      <td className="py-3 text-right text-slate-700">{e.gas_kwh}</td>
                      <td className="py-3 text-right text-slate-700">{formatKg(e.co2_electricite)}</td>
                      <td className="py-3 text-right text-slate-700">{formatKg(e.co2_gaz)}</td>
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
