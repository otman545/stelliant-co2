import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatKg, formatWeekLabel } from "@/lib/co2";
import { Loader2, ArrowUpDown, Image as ImageIcon } from "lucide-react";

const now = new Date();

export default function ManagerEntries() {
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [filterUser, setFilterUser] = useState("all");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: e }, { data: u }] = await Promise.all([
          api.get("/entries"), api.get("/users"),
        ]);
        setEntries(e);
        setUsers(u);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let out = entries;
    if (filterYear !== "all") out = out.filter((e) => e.iso_year === Number(filterYear));
    if (filterUser !== "all") out = out.filter((e) => e.user_id === filterUser);

    const sorted = [...out];
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      if (sortKey === "date") return ((a.iso_year - b.iso_year) * 100 + (a.iso_week - b.iso_week)) * dir;
      if (sortKey === "expert") return (a.user_name || "").localeCompare(b.user_name || "") * dir;
      if (sortKey === "total") return (a.co2_total - b.co2_total) * dir;
      return 0;
    });
    return sorted;
  }, [entries, filterYear, filterUser, sortKey, sortDir]);

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const Th = ({ k, children, align }) => (
    <th className={`pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider ${align === "right" ? "text-right" : "text-left"}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-primary" data-testid={`sort-${k}`}>
        {children} <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Espace manager</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">Toutes les saisies</h1>
        <p className="text-sm text-slate-500 mt-1">Filtrer, trier et explorer le détail des contributions hebdomadaires.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="font-semibold text-slate-900 mr-auto">Filtres</h3>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} data-testid="filter-year"
            className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white w-[120px]">
            <option value="all">Toutes années</option>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} data-testid="filter-user"
            className="h-10 px-3 rounded-md border border-slate-200 text-sm bg-white w-[200px]">
            <option value="all">Tous les experts</option>
            {users.filter((u) => u.role === "expert").map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">Aucune saisie ne correspond aux filtres.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th k="expert">Expert</Th>
                  <Th k="date">Semaine</Th>
                  <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Déplacements</th>
                  <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Numérique</th>
                  <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Photos</th>
                  <Th k="total" align="right">Total CO₂</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0" data-testid={`entry-row-${e.id}`}>
                    <td className="py-3">
                      <div className="font-medium text-slate-900">{e.user_name || "—"}</div>
                      <div className="text-xs text-slate-500">{e.user_email}</div>
                    </td>
                    <td className="py-3 text-slate-700">{formatWeekLabel(e.iso_year, e.iso_week)}</td>
                    <td className="py-3 text-right text-slate-700">{formatKg(e.co2_deplacement)}</td>
                    <td className="py-3 text-right text-slate-700">{formatKg(e.co2_numerique)}</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">
                        <ImageIcon className="w-3 h-3" />{(e.photos || []).length}
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
  );
}
