import { useState, FormEvent } from 'react';
import { Lock, Mail, LogIn } from 'lucide-react';
import { AdminMoi } from './AdminShell';

export default function AdminLoginPage({ onConnecte }: { onConnecte: (m: AdminMoi) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const r = await fetch('/api/admin-ui/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErreur(d.error || 'Connexion impossible.');
        return;
      }
      onConnecte(await r.json());
    } catch { setErreur('Erreur réseau.'); }
    finally { setEnCours(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-600/30 mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <p className="text-xs tracking-[0.2em] font-bold text-blue-600 uppercase mb-1">Empower Doctor</p>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard interne</h1>
          <p className="text-sm text-slate-500 mt-2">Accès réservé aux administrateurs.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/60 p-7">
          <form onSubmit={soumettre} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Adresse e-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="vous@exemple.com"
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            {erreur && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <p className="text-sm text-rose-800">{erreur}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={enCours}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              {enCours ? 'Connexion…' : (<><LogIn className="w-4 h-4" />Se connecter</>)}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Empower Doctor — dashboard d'administration</p>
      </div>
    </div>
  );
}
