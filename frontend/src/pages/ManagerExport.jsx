import { Download } from "lucide-react";

export default function ManagerExport() {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

  const downloadCSV = () => {
    const token = localStorage.getItem("co2_token");
    fetch(`${BACKEND_URL}/api/export/csv`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stelliant_co2_export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Espace manager</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">Export des données</h1>
        <p className="text-sm text-slate-500 mt-1">Téléchargez l'ensemble des saisies hebdomadaires pour le reporting RSE.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-8 text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-md flex items-center justify-center text-primary mx-auto mb-4">
          <Download className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Export CSV complet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Inclut toutes les saisies hebdomadaires des 11 experts : déplacements, numérique,
          CO₂ calculé par poste, et métadonnées (semaine ISO, dates, nombre de photos).
        </p>
        <button
          onClick={downloadCSV} data-testid="export-csv-button"
          className="h-11 px-6 rounded-md bg-primary text-white font-medium text-sm inline-flex items-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all"
        >
          <Download className="w-4 h-4" /> Télécharger le CSV
        </button>
      </div>
    </div>
  );
}
