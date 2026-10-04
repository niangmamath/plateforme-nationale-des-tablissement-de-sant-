import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, UserPlus, Loader2, MailCheck, KeyRound } from 'lucide-react';
import { useAuth, ErreurApi } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Appelé juste après une connexion réussie (jamais après une inscription, vérification ou
  // réinitialisation seules — voir AuthContext), pour enchaîner sur l'action que l'utilisateur
  // voulait faire avant d'être interrompu (ex: ouvrir le générateur de business plan).
  onSucces?: () => void;
}

type Etape = 'connexion' | 'inscription' | 'verification' | 'oubli' | 'reset';

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
  const {
    inscrire, connecter, connecterAvecGoogle,
    verifierEmail, renvoyerCodeVerification, demanderReinitialisationMotDePasse, reinitialiserMotDePasse,
  } = useAuth();
  const [etape, setEtape] = useState<Etape>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [enCours, setEnCours] = useState(false);

  if (!isOpen) return null;

  const resetMessages = () => { setErreur(''); setInfo(''); };

  const allerA = (prochaine: Etape, messageInfo = '') => {
    resetMessages();
    setInfo(messageInfo);
    setCode('');
    setEtape(prochaine);
  };

  const terminerAvecSucces = () => {
    setEmail('');
    setMotDePasse('');
    setNouveauMotDePasse('');
    setCode('');
    resetMessages();
    onSucces?.();
    onClose();
  };

  const soumettreConnexionOuInscription = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setEnCours(true);
    try {
      if (etape === 'inscription') {
        // Créer un compte ne connecte pas automatiquement (voir AuthContext) : un code de
        // vérification part par e-mail, l'utilisateur doit l'entrer puis se connecter.
        await inscrire(email, motDePasse);
        allerA('verification', `Compte créé — entrez le code reçu à ${email}.`);
      } else {
        await connecter(email, motDePasse);
        terminerAvecSucces();
      }
    } catch (err: any) {
      // E-mail pas encore confirmé (403) : proposer directement la saisie du code plutôt qu'une
      // simple erreur sans issue.
      if (err instanceof ErreurApi && err.status === 403) {
        allerA('verification', '');
        setErreur(err.message);
      } else {
        setErreur(err.message || 'Une erreur est survenue.');
      }
    } finally {
      setEnCours(false);
    }
  };

  const soumettreVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setEnCours(true);
    try {
      await verifierEmail(email, code);
      allerA('connexion', 'E-mail vérifié — connectez-vous.');
    } catch (err: any) {
      setErreur(err.message || 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  };

  const renvoyerCode = async () => {
    resetMessages();
    setEnCours(true);
    try {
      await renvoyerCodeVerification(email);
      setInfo('Nouveau code envoyé.');
    } catch (err: any) {
      setErreur(err.message || 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  };

  const soumettreOubli = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setEnCours(true);
    try {
      await demanderReinitialisationMotDePasse(email);
      allerA('reset', `Si un compte existe pour ${email}, un code vient de lui être envoyé.`);
    } catch (err: any) {
      setErreur(err.message || 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  };

  const soumettreReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setEnCours(true);
    try {
      await reinitialiserMotDePasse(email, code, nouveauMotDePasse);
      setMotDePasse('');
      setNouveauMotDePasse('');
      allerA('connexion', 'Mot de passe modifié — connectez-vous.');
    } catch (err: any) {
      setErreur(err.message || 'Une erreur est survenue.');
    } finally {
      setEnCours(false);
    }
  };

  const avecGoogle = async (idToken: string) => {
    resetMessages();
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

  const titres: Record<Etape, { icone: React.ReactNode; texte: string; sousTitre: string }> = {
    connexion: { icone: <LogIn className="h-5 w-5 text-blue-600" />, texte: 'Connexion', sousTitre: 'Nécessaire pour sauvegarder votre business plan et le reprendre plus tard, à votre rythme.' },
    inscription: { icone: <UserPlus className="h-5 w-5 text-blue-600" />, texte: 'Créer un compte', sousTitre: 'Nécessaire pour sauvegarder votre business plan et le reprendre plus tard, à votre rythme.' },
    verification: { icone: <MailCheck className="h-5 w-5 text-blue-600" />, texte: 'Vérifiez votre e-mail', sousTitre: `Entrez le code à 6 chiffres envoyé à ${email || 'votre adresse'}.` },
    oubli: { icone: <KeyRound className="h-5 w-5 text-blue-600" />, texte: 'Mot de passe oublié', sousTitre: 'Entrez votre adresse e-mail pour recevoir un code de réinitialisation.' },
    reset: { icone: <KeyRound className="h-5 w-5 text-blue-600" />, texte: 'Nouveau mot de passe', sousTitre: `Entrez le code reçu à ${email || 'votre adresse'} et votre nouveau mot de passe.` },
  };
  const { icone, texte, sousTitre } = titres[etape];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>

          <div className="flex items-center gap-2 mb-1">
            {icone}
            <h2 className="text-lg font-black text-slate-900">{texte}</h2>
          </div>
          <p className="text-xs text-slate-500 mb-5">{sousTitre}</p>

          {(etape === 'connexion' || etape === 'inscription') && (
            <>
              <div className="mb-4">
                <BoutonGoogle onCredential={avecGoogle} />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-bold uppercase text-slate-400">ou avec un e-mail</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={soumettreConnexionOuInscription} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">E-mail</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="vous@exemple.com" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Mot de passe</label>
                  <input type="password" required minLength={8} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="8 caractères minimum" />
                  {etape === 'inscription' && <p className="mt-1 text-[11px] text-slate-400">Au moins 8 caractères, avec une lettre et un chiffre.</p>}
                </div>

                {etape === 'connexion' && (
                  <button type="button" onClick={() => allerA('oubli')} className="text-xs text-blue-600 font-bold hover:underline">Mot de passe oublié ?</button>
                )}

                {info && <p className="text-xs font-bold text-emerald-600">{info}</p>}
                {erreur && <p className="text-xs font-bold text-rose-600">{erreur}</p>}

                <button type="submit" disabled={enCours} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                  {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
                  {etape === 'connexion' ? 'Se connecter' : "S'inscrire"}
                </button>
              </form>

              <p className="text-xs text-slate-500 mt-4 text-center">
                {etape === 'connexion' ? (
                  <>Pas encore de compte ? <button onClick={() => allerA('inscription')} className="text-blue-600 font-bold hover:underline">S'inscrire</button></>
                ) : (
                  <>Déjà un compte ? <button onClick={() => allerA('connexion')} className="text-blue-600 font-bold hover:underline">Se connecter</button></>
                )}
              </p>
            </>
          )}

          {etape === 'verification' && (
            <form onSubmit={soumettreVerification} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Code à 6 chiffres</label>
                <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-black tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••" />
              </div>

              {info && <p className="text-xs font-bold text-emerald-600">{info}</p>}
              {erreur && <p className="text-xs font-bold text-rose-600">{erreur}</p>}

              <button type="submit" disabled={enCours || code.length !== 6} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
                Valider le code
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={renvoyerCode} disabled={enCours} className="text-blue-600 font-bold hover:underline disabled:opacity-60">Renvoyer le code</button>
                <button type="button" onClick={() => allerA('connexion')} className="text-slate-500 hover:underline">Retour</button>
              </div>
            </form>
          )}

          {etape === 'oubli' && (
            <form onSubmit={soumettreOubli} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">E-mail</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="vous@exemple.com" />
              </div>

              {erreur && <p className="text-xs font-bold text-rose-600">{erreur}</p>}

              <button type="submit" disabled={enCours} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
                Envoyer le code
              </button>
              <p className="text-xs text-center"><button type="button" onClick={() => allerA('connexion')} className="text-slate-500 hover:underline">Retour à la connexion</button></p>
            </form>
          )}

          {etape === 'reset' && (
            <form onSubmit={soumettreReset} className="space-y-3">
              {info && <p className="text-xs font-bold text-emerald-600">{info}</p>}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Code à 6 chiffres</label>
                <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-black tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nouveau mot de passe</label>
                <input type="password" required minLength={8} value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="8 caractères minimum" />
                <p className="mt-1 text-[11px] text-slate-400">Au moins 8 caractères, avec une lettre et un chiffre.</p>
              </div>

              {erreur && <p className="text-xs font-bold text-rose-600">{erreur}</p>}

              <button type="submit" disabled={enCours || code.length !== 6} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
                Réinitialiser le mot de passe
              </button>
              <p className="text-xs text-center"><button type="button" onClick={() => allerA('connexion')} className="text-slate-500 hover:underline">Retour à la connexion</button></p>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
