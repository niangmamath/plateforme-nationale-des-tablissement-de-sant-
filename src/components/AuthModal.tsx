import { useState } from 'react';
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

export default function AuthModal({ isOpen, onClose, onSucces }: AuthModalProps) {
  const { inscrire, connecter } = useAuth();
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  if (!isOpen) return null;

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      if (mode === 'inscription') await inscrire(email, motDePasse);
      else await connecter(email, motDePasse);
      setEmail('');
      setMotDePasse('');
      onSucces?.();
      onClose();
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
