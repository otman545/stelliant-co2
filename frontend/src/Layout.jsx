import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ClipboardList, History, LayoutDashboard, Users, Zap,
  Table2, Download, LogOut, Leaf,
} from "lucide-react";

const expertNav = [
  { to: "/saisie", label: "Saisie hebdomadaire", icon: ClipboardList },
  { to: "/historique", label: "Mon historique", icon: History },
];

const managerNav = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/entries", label: "Toutes les saisies", icon: Table2 },
  { to: "/experts", label: "Gestion experts", icon: Users },
  { to: "/energie", label: "Énergie agence", icon: Zap },
  { to: "/export", label: "Export", icon: Download },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = user?.role === "manager" || user?.role === "admin" ? managerNav : expertNav;

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-slate-200 fixed inset-y-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">STELLIANT<span className="text-primary">.</span></span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to} to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2 mb-1">
            <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={doLogout}
            className="w-full flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">STELLIANT</span>
        </div>
        <button onClick={doLogout} className="p-2 rounded-md hover:bg-slate-50">
          <LogOut className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex">
        {nav.map((item) => (
          <NavLink
            key={item.to} to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium ${
                isActive ? "text-primary" : "text-slate-500"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-20 lg:pb-0 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
