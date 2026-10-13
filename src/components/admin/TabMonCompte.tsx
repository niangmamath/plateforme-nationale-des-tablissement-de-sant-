// Onglet "Mon compte" : changement du mot de passe de l'admin connecté.
// Vérifie l'ancien mdp côté serveur (évite qu'un attaquant qui a volé la session verrouille le
// compte en changeant le mdp).

import { useState, FormEvent } from 'react';
import { useAdminAuth } from './AdminShell';
import { Loader2, CheckCircle2, AlertCircle, KeyRound, UserCog, Eye, EyeOff } from 'lucide-react';

// Champ mot de passe avec bouton "œil" pour afficher/masquer. autoComplete="new-password" sur TOUS
// les champs (y compris l'ancien) : sinon Chrome injecte automatiquement le mdp mémorisé et le user
// a l'impression que c'est pré-rempli. "new-password" dit au navigateur "ne remplis pas, c'est un
// changement" — il proposera quand même de mémoriser le nouveau mdp après soumission.
function ChampMotDePasse({
  label, valeur, onChange, autoFocus,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const [afficher, setAfficher] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={afficher ? 'text' : 'password'}
          value={valeur}
          onChange={e => onChange(e.target.value)}
          required
          autoFocus={autoFocus}
          autoComplete="new-password"
          className="w-full pl-3 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
        />
        <button
          type="button"
          onClick={() => setAfficher(a => !a)}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
          title={afficher ? 'Masquer' : 'Afficher'}
        >
          {afficher ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export function TabMonCompte() {
  const { moi } = useAdminAuth();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null); setSucces(false);

    if (nouveau !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    if (nouveau.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/[a-zA-Z]/.test(nouveau) || !/[0-9]/.test(nouveau)) {
      setErreur('Le nouveau mot de passe doit contenir au moins une lettre et un chiffre.');
      return;
    }

    setEnCours(true);
    try {
      const r = await fetch('/api/admin-ui/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ancien, nouveau }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur serveur');
      }
      setAncien(''); setNouveau(''); setConfirmation('');
      setSucces(true);
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Profil */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 lg:p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white shrink-0">
            <UserCog className="w-7 h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">Mon compte</h2>
            <p className="text-xs text-slate-500 mt-0.5">Informations du compte connecté</p>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-500 w-24 shrink-0">E-mail</span>
                <span className="font-medium text-slate-900 break-all">{moi.email}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-24 shrink-0">Rôle</span>
                <span className="font-medium text-slate-900">Administrateur</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Changement de mot de passe */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 lg:p-6 shadow-sm max-w-xl">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">Changer mon mot de passe</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">8 caractères minimum, avec au moins une lettre et un chiffre.</p>

        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          {/* Leurre invisible : Chrome / Safari ignorent autoComplete="off" sur un form, mais
              arrêtent d'auto-remplir quand un champ password caché bidon est présent en amont. */}
          <input type="password" tabIndex={-1} autoComplete="new-password" className="hidden" />

          <ChampMotDePasse label="Mot de passe actuel" valeur={ancien} onChange={setAncien} autoFocus />
          <ChampMotDePasse label="Nouveau mot de passe" valeur={nouveau} onChange={setNouveau} />
          <ChampMotDePasse label="Confirmer le nouveau mot de passe" valeur={confirmation} onChange={setConfirmation} />

          {erreur && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800">{erreur}</p>
            </div>
          )}
          {succes && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800">Mot de passe changé avec succès.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={enCours || !ancien || !nouveau || !confirmation}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {enCours && <Loader2 className="w-4 h-4 animate-spin" />}
              Mettre à jour mon mot de passe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
