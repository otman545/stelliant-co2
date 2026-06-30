import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Leaf } from "lucide-react";

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await login(email.trim().toLowerCase(), password);
    setSubmitting(false);
    if (res.ok) navigate("/");
    else setError(res.error || "Échec de la connexion");
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-primary">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1768661770207-9aa46d5ed526?crop=entropy&cs=srgb&fm=jpg&q=85')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="text-2xl font-bold">STELLIANT<span className="text-white/70">.</span></div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs uppercase tracking-wider mb-6">
              <Leaf className="w-3.5 h-3.5" /> Démarche RSE
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              Pilotez l'empreinte<br />carbone de votre agence.
            </h1>
            <p className="mt-4 text-white/80 max-w-md leading-relaxed">
              Centralisez les données CO₂ de vos 11 experts terrain — déplacements, numérique
              et énergie — avec une saisie hebdomadaire simple et un pilotage mensuel automatique.
            </p>
          </div>
          <div className="text-xs text-white/60">Agence STELLIANT Lille · Facteurs Base Empreinte ADEME</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-2xl font-bold text-slate-900">STELLIANT<span className="text-primary">.</span></div>
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">Connexion</div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Suivi CO₂</h2>
          <p className="mt-2 text-sm text-slate-500">Accédez à votre espace expert ou manager.</p>

          <div className="mt-8 bg-white rounded-md border border-slate-200 p-6">
            <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
              <div>
                <label htmlFor="email" className="text-sm text-slate-600 font-medium">Email</label>
                <input
                  id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@stelliant.fr" data-testid="login-email-input"
                  className="w-full mt-1.5 h-11 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-sm text-slate-600 font-medium">Mot de passe</label>
                <input
                  id="password" type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" data-testid="login-password-input"
                  className="w-full mt-1.5 h-11 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2" data-testid="login-error">
                  {error}
                </div>
              )}
              <button
                type="submit" disabled={submitting} data-testid="login-submit-button"
                className="w-full h-11 rounded-md bg-primary text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Se connecter
              </button>
            </form>
          </div>

          <div className="mt-6 text-xs text-slate-500 leading-relaxed">
            <div className="font-semibold text-slate-700 mb-1">Comptes de démo</div>
            Manager : <code className="bg-slate-100 px-1.5 py-0.5 rounded">manager@stelliant.fr</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded">manager123</code><br />
            Experts : <code className="bg-slate-100 px-1.5 py-0.5 rounded">expert1@stelliant.fr</code> ... <code className="bg-slate-100 px-1.5 py-0.5 rounded">expert11@stelliant.fr</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded">expert123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
