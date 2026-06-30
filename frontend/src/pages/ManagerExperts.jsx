import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Plus, Trash2, KeyRound, UserCheck, UserX, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ManagerExperts() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "expert" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", email: "", password: "", role: "expert" }); setOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: "", role: u.role }); setOpen(true); };

  const submit = async () => {
    setSaving(true);
    try {
      if (editing) {
        const body = { name: form.name, role: form.role };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editing.id}`, body);
        toast.success("Utilisateur mis à jour");
      } else {
        await api.post("/users", form);
        toast.success("Utilisateur créé");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { active: !u.active });
      toast.success(u.active ? "Compte désactivé" : "Compte réactivé");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Supprimer définitivement ${u.email} ?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Utilisateur supprimé");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Administration</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">Gestion des experts</h1>
          <p className="text-sm text-slate-500 mt-1">Créez, modifiez ou désactivez les comptes utilisateurs.</p>
        </div>
        <button onClick={openCreate} data-testid="add-user-button"
          className="h-10 px-4 rounded-md bg-primary text-white text-sm font-medium flex items-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all">
          <Plus className="w-4 h-4" /> Ajouter un expert
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{editing ? "Modifier l'utilisateur" : "Nouveau compte"}</h2>
            <div>
              <label className="text-sm text-slate-600 font-medium">Nom complet</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input"
                className="w-full mt-1.5 h-11 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm text-slate-600 font-medium">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} data-testid="user-email-input"
                className="w-full mt-1.5 h-11 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50" />
            </div>
            <div>
              <label className="text-sm text-slate-600 font-medium">{editing ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe"}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input"
                className="w-full mt-1.5 h-11 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm text-slate-600 font-medium">Rôle</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="user-role-select"
                className="w-full mt-1.5 h-11 px-3 rounded-md border border-slate-200 text-sm bg-white">
                <option value="expert">Expert terrain</option>
                <option value="manager">Manager</option>
                <option value="rse">Responsable RSE (lecture)</option>
                <option value="manager_of_managers">Responsable des managers (lecture)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="h-10 px-4 rounded-md border border-slate-200 text-sm font-medium hover:bg-slate-50">Annuler</button>
              <button onClick={submit} disabled={saving} data-testid="save-user-button"
                className="h-10 px-4 rounded-md bg-primary text-white text-sm font-medium flex items-center gap-2 hover:bg-primary-hover disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md">
        <div className="p-5 border-b border-slate-200"><h3 className="font-semibold text-slate-900">Utilisateurs ({users.length})</h3></div>
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider">Nom</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider">Email</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider">Rôle</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider">Statut</th>
                    <th className="pb-2 font-medium text-slate-500 text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0" data-testid={`user-row-${u.id}`}>
                      <td className="py-3 font-medium text-slate-900">{u.name}</td>
                      <td className="py-3 text-slate-700">{u.email}</td>
                      <td className="py-3">
                        <span className="text-xs border border-slate-200 rounded-full px-2 py-0.5 text-slate-600 capitalize">
                          {u.role === "manager" ? "Manager" : u.role === "expert" ? "Expert" : u.role}
                        </span>
                      </td>
                      <td className="py-3">
                        {u.active ? (
                          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">Actif</span>
                        ) : (
                          <span className="text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2.5 py-1">Désactivé</span>
                        )}
                      </td>
                      <td className="py-3 text-right space-x-1">
                        <button onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`} className="p-2 rounded-md hover:bg-slate-100"><KeyRound className="w-3.5 h-3.5" /></button>
                        <button onClick={() => toggleActive(u)} className="p-2 rounded-md hover:bg-slate-100">
                          {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => remove(u)} className="p-2 rounded-md hover:bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
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
