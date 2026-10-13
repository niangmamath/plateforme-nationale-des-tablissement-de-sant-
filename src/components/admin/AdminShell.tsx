// Shell du dashboard admin. Gère son propre état auth (séparé de AuthContext des médecins) :
// un GET /api/admin-ui/me au montage pour reconnaître le cookie admin_session s'il existe,
// puis affiche Login ou Dashboard selon le résultat. Pas de provider global, pas besoin — seul
// ce composant et ses enfants directs connaissent l'identité admin.

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import AdminLoginPage from './AdminLoginPage';
import AdminDashboard from './AdminDashboard';

export interface AdminMoi {
  id: number;
  email: string;
  role: 'admin';
}

interface AdminAuthCtx {
  moi: AdminMoi;
  deconnexion: () => Promise<void>;
}
const Ctx = createContext<AdminAuthCtx | null>(null);
export function useAdminAuth(): AdminAuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminAuth doit être utilisé dans AdminShell');
  return v;
}

export default function AdminShell() {
  const [moi, setMoi] = useState<AdminMoi | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    fetch('/api/admin-ui/me', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: AdminMoi | null) => setMoi(d))
      .catch(() => setMoi(null))
      .finally(() => setChargement(false));
  }, []);

  const deconnexion = useCallback(async () => {
    await fetch('/api/admin-ui/logout', { method: 'POST', credentials: 'same-origin' });
    setMoi(null);
  }, []);

  if (chargement) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</div>;
  }

  if (!moi) {
    return <AdminLoginPage onConnecte={setMoi} />;
  }

  return (
    <Ctx.Provider value={{ moi, deconnexion }}>
      <AdminDashboard />
    </Ctx.Provider>
  );
}
