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
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function appelerJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((u) => setUtilisateur(u))
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
  }, []);

  const inscrireFn = useCallback(async (email: string, motDePasse: string) => {
    const u = await appelerJson('/api/auth/signup', { email, password: motDePasse });
    setUtilisateur(u);
  }, []);

  const connecterFn = useCallback(async (email: string, motDePasse: string) => {
    const u = await appelerJson('/api/auth/login', { email, password: motDePasse });
    setUtilisateur(u);
  }, []);

  const connecterAvecGoogleFn = useCallback(async (idToken: string) => {
    const u = await appelerJson('/api/auth/google', { idToken });
    setUtilisateur(u);
  }, []);

  const deconnecterFn = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUtilisateur(null);
  }, []);

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, inscrire: inscrireFn, connecter: connecterFn, connecterAvecGoogle: connecterAvecGoogleFn, deconnecter: deconnecterFn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>.');
  return ctx;
}
