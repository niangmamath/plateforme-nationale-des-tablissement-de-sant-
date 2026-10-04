import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Appelé juste après une connexion/inscription réussie, pour enchaîner sur l'action que
  // l'utilisateur voulait faire avant d'être interrompu par la demande de connexion
  // (ex: ouvrir le générateur de business plan).
  onSucces?: () => void;
}

// Chargée une seule fois pour toute la session (plusieurs ouvertures de la modale ne doivent pas
// réinjecter le script ni perdre le cache navigateur dessus).
let chargementScriptGoogle: Promise<void> | null = null;
function chargerScriptGoogle(): Promise<void> {
  if (chargementScriptGoogle) return chargementScriptGoogle;
  chargementScriptGoogle = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossible de charger Google Sign-In.'));
    document.head.appendChild(script);
  });
  return chargementScriptGoogle;
}

// Bouton "Se connecter avec Google" (Google Identity Services) : rendu délégué à Google
// lui-même (impossible à construire à la main dans son propre style sans violer les règles de
// marque Google), on lui fournit juste un conteneur et un callback qui reçoit le jeton d'identité
// à vérifier côté serveur (voir server/auth.ts :: connecterAvecGoogle).
function BoutonGoogle({ onCredential }: { onCredential: (idToken: string) => void }) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [indisponible, setIndisponible] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) { setIndisponible(true); return; }
    let annule = false;
    chargerScriptGoogle()
      .then(() => {
        if (annule || !conteneurRef.current) return;
        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (reponse: { credential: string }) => onCredential(reponse.credential),
        });
        google.accounts.id.renderButton(conteneurRef.current, {
          type: 'standard', theme: 'outline', size: 'large', width: 296, text: 'continue_with',
        });
      })
      .catch(() => setIndisponible(true));
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (indisponible) return null;
  return <div ref={conteneurRef} className="flex justify-center" />;
}

export default function AuthModal({ isOpen, onClose, onSucces }: AuthModalProps) {
  const { inscrire, connecter, connecterAvecGoogle } = useAuth();
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  if (!isOpen) return null;

  const terminerAvecSucces = () => {
    setEmail('');
    setMotDePasse('');
    onSucces?.();
    onClose();
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      if (mode === 'inscription') await inscrire(email, motDePasse);
      else await connecter(email, motDePasse);
      terminerAvecSucces();
    } catch (err: any) {
      setErreur(err.message || 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  };

  const avecGoogle = async (idToken: string) => {
    setErreur('');
    setEnCours(true);
    try {
      await connecterAvecGoogle(idToken);
      terminerAvecSucces();
    } catch (err: any) {
      setErreur(err.message || 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>

          <div className="flex items-center gap-2 mb-1">
            {mode === 'connexion' ? <LogIn className="h-5 w-5 text-blue-600" /> : <UserPlus className="h-5 w-5 text-blue-600" />}
            <h2 className="text-lg font-black text-slate-900">{mode === 'connexion' ? 'Connexion' : 'Créer un compte'}</h2>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Nécessaire pour sauvegarder votre business plan et le reprendre plus tard, à votre rythme.
          </p>

          <div className="mb-4">
            <BoutonGoogle onCredential={avecGoogle} />
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-bold uppercase text-slate-400">ou avec un e-mail</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={soumettre} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="vous@exemple.com" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Mot de passe</label>
              <input type="password" required minLength={8} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="8 caractères minimum" />
            </div>

            {erreur && <p className="text-xs font-bold text-rose-600">{erreur}</p>}

            <button type="submit" disabled={enCours} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
              {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'connexion' ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>

          <p className="text-xs text-slate-500 mt-4 text-center">
            {mode === 'connexion' ? (
              <>Pas encore de compte ? <button onClick={() => { setMode('inscription'); setErreur(''); }} className="text-blue-600 font-bold hover:underline">S'inscrire</button></>
            ) : (
              <>Déjà un compte ? <button onClick={() => { setMode('connexion'); setErreur(''); }} className="text-blue-600 font-bold hover:underline">Se connecter</button></>
            )}
          </p>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
