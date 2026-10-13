import { useState, FormEvent, useEffect } from 'react';
import { KeyRound, CheckCircle2 } from 'lucide-react';

export default function AdminActivationPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) setToken(t);
    else setErreur("Lien d'activation invalide (token manquant).");
  }, []);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (password !== confirmation) { setErreur('Les deux mots de passe ne correspondent pas.'); return; }
    setEnCours(true);
    try {
      const r = await fetch('/api/admin-ui/activer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErreur(d.error || "Activation impossible.");
        return;
      }
      setSucces(true);
    } catch { setErreur('Erreur réseau.'); }
    finally { setEnCours(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg mb-4 ${succes ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30' : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-600/30'}`}>
            {succes ? <CheckCircle2 className="w-7 h-7 text-white" /> : <KeyRound className="w-7 h-7 text-white" />}
          </div>
          <p className="text-xs tracking-[0.2em] font-bold text-blue-600 uppercase mb-1">Empower Doctor</p>
          <h1 className="text-2xl font-bold text-slate-900">{succes ? 'Compte activé' : 'Activer mon accès'}</h1>
          <p className="text-sm text-slate-500 mt-2">
            {succes ? 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.' : 'Choisissez un mot de passe (8 caractères minimum, avec au moins une lettre et un chiffre).'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/60 p-7">
          {succes ? (
            <a href="/admin" className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all">
              Se connecter maintenant
            </a>
          ) : (
            <form onSubmit={soumettre} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Nouveau mot de passe</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Confirmer</label>
                <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required autoComplete="new-password"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              {erreur && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-rose-800">{erreur}</p>
                </div>
              )}
              <button type="submit" disabled={enCours || !token}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all">
                {enCours ? 'Activation…' : 'Activer mon compte'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Empower Doctor — dashboard d'administration</p>
      </div>
    </div>
  );
}
