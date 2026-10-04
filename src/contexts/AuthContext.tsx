import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface Utilisateur {
  id: number;
  email: string;
}

interface AuthContextValue {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  inscrire: (email: string, motDePasse: string) => Promise<void>;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  connecterAvecGoogle: (idToken: string) => Promise<void>;
  deconnecter: () => Promise<void>;
  verifierEmail: (email: string, code: string) => Promise<void>;
  renvoyerCodeVerification: (email: string) => Promise<void>;
  demanderReinitialisationMotDePasse: (email: string) => Promise<void>;
  reinitialiserMotDePasse: (email: string, code: string, motDePasse: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Une seule route /api/auth (GET = utilisateur courant, POST { action, ... } pour le reste) —
// voir api/auth.ts pour pourquoi (limite de fonctions serverless sur le plan Hobby de Vercel).
// Porte le code HTTP sur l'erreur (pas juste le message) : l'UI a besoin de distinguer un 403
// "e-mail non confirmé" (proposer le code de vérification) d'un 401 classique (juste un message).
export class ErreurApi extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function appelerAuth(action: string, body?: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErreurApi(data.error || "Une erreur est survenue.", res.status);
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => setUtilisateur(u))
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
  }, []);

  // Volontairement sans connexion automatique : créer un compte, vérifier son e-mail ou
  // réinitialiser son mot de passe ne donne jamais accès directement — il faut ensuite se
  // connecter explicitement (voir AuthModal, qui enchaîne sur le formulaire de connexion).
  const inscrireFn = useCallback(async (email: string, motDePasse: string) => {
    await appelerAuth('signup', { email, password: motDePasse });
  }, []);

  const connecterFn = useCallback(async (email: string, motDePasse: string) => {
    const u = await appelerAuth('login', { email, password: motDePasse });
    setUtilisateur(u);
  }, []);

  const connecterAvecGoogleFn = useCallback(async (idToken: string) => {
    const u = await appelerAuth('google', { idToken });
    setUtilisateur(u);
  }, []);

  const deconnecterFn = useCallback(async () => {
    await appelerAuth('logout');
    setUtilisateur(null);
  }, []);

  const verifierEmailFn = useCallback(async (email: string, code: string) => {
    await appelerAuth('verify-email', { email, code });
  }, []);

  const renvoyerCodeVerificationFn = useCallback(async (email: string) => {
    await appelerAuth('resend-verification', { email });
  }, []);

  const demanderReinitialisationFn = useCallback(async (email: string) => {
    await appelerAuth('forgot-password', { email });
  }, []);

  const reinitialiserFn = useCallback(async (email: string, code: string, motDePasse: string) => {
    await appelerAuth('reset-password', { email, code, password: motDePasse });
  }, []);

  return (
    <AuthContext.Provider value={{
      utilisateur, chargement,
      inscrire: inscrireFn, connecter: connecterFn, connecterAvecGoogle: connecterAvecGoogleFn, deconnecter: deconnecterFn,
      verifierEmail: verifierEmailFn, renvoyerCodeVerification: renvoyerCodeVerificationFn,
      demanderReinitialisationMotDePasse: demanderReinitialisationFn, reinitialiserMotDePasse: reinitialiserFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>.');
  return ctx;
}
