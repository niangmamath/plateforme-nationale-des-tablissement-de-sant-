import { useState } from 'react';
import {
  LayoutGrid, Building2, Map, Stethoscope, Users as UsersIcon,
  FileText, AlertTriangle, Shield, LogOut, Menu, X,
} from 'lucide-react';
import { useAdminAuth } from './AdminShell';
import {
  TabVueEnsemble, TabEtablissements, TabZones, TabSpecialites,
  TabUtilisateurs, TabBusinessPlans, TabSignalements, TabAcces,
} from './AdminTabs';

type OngletId = 'overview' | 'etablissements' | 'zones' | 'specialites' | 'utilisateurs' | 'business-plans' | 'signalements' | 'acces';

interface Onglet { id: OngletId; label: string; Icone: typeof LayoutGrid; adminSeul?: boolean }

const ONGLETS: Onglet[] = [
  { id: 'overview', label: "Vue d'ensemble", Icone: LayoutGrid },
  { id: 'etablissements', label: 'Établissements', Icone: Building2 },
  { id: 'zones', label: 'Zones', Icone: Map },
  { id: 'specialites', label: 'Spécialités', Icone: Stethoscope },
  { id: 'utilisateurs', label: 'Utilisateurs', Icone: UsersIcon },
  { id: 'business-plans', label: 'Business plans', Icone: FileText },
  { id: 'signalements', label: 'Signalements', Icone: AlertTriangle },
  { id: 'acces', label: 'Accès', Icone: Shield, adminSeul: true },
];

function initiales(email: string): string {
  const local = email.split('@')[0];
  const parts = local.split(/[.\-_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export default function AdminDashboard() {
  const { moi, deconnexion } = useAdminAuth();
  const [actif, setActif] = useState<OngletId>('overview');
  const [menuMobile, setMenuMobile] = useState(false);

  const ongletsVisibles = ONGLETS.filter(o => !o.adminSeul || moi.role === 'admin');
  const ongletCourant = ongletsVisibles.find(o => o.id === actif) || ongletsVisibles[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* --- Sidebar (desktop) + overlay mobile ---
          lg:sticky lg:top-0 lg:h-screen : reste visible en permanence sur desktop, même si le main
          scrolle. Le profil et le bouton déconnexion sont dans un bloc en bas (border-t), donc
          toujours accessibles sans scroll — seule la liste des onglets (flex-1 overflow-y-auto)
          scrolle si elle dépasse la hauteur. */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 flex flex-col
        transform transition-transform lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0
        ${menuMobile ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-6 py-5 border-b border-slate-700/60 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] font-bold text-blue-400 uppercase">Empower Doctor</p>
            <h1 className="text-base font-bold text-white mt-0.5">Dashboard</h1>
          </div>
          <button onClick={() => setMenuMobile(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {ongletsVisibles.map(o => {
            const Icone = o.Icone;
            const estActif = actif === o.id;
            return (
              <button
                key={o.id}
                onClick={() => { setActif(o.id); setMenuMobile(false); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${estActif
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-900/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}
                `}
              >
                <Icone className="w-4 h-4 shrink-0" />
                <span>{o.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Profil + déconnexion */}
        <div className="border-t border-slate-700/60 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initiales(moi.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{moi.email}</div>
              <div className="text-xs text-slate-400 capitalize">{moi.role === 'admin' ? 'Administrateur' : 'Lecteur'}</div>
            </div>
          </div>
          <button
            onClick={deconnexion}
            className="w-full inline-flex items-center justify-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 rounded-xl px-3 py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Overlay sombre quand menu mobile ouvert */}
      {menuMobile && (
        <div onClick={() => setMenuMobile(false)} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden" />
      )}

      {/* --- Contenu principal --- */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 lg:border-none sticky top-0 z-20 backdrop-blur bg-white/80">
          <div className="px-4 lg:px-8 py-4 flex items-center gap-4">
            <button onClick={() => setMenuMobile(true)} className="lg:hidden text-slate-700 hover:text-slate-900">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-600/20`}>
                <ongletCourant.Icone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 truncate">{ongletCourant.label}</h2>
                <p className="text-xs text-slate-500 hidden sm:block">Dashboard interne Empower Doctor</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8">
          <div className="max-w-7xl mx-auto">
            {actif === 'overview' && <TabVueEnsemble />}
            {actif === 'etablissements' && <TabEtablissements />}
            {actif === 'zones' && <TabZones />}
            {actif === 'specialites' && <TabSpecialites />}
            {actif === 'utilisateurs' && <TabUtilisateurs role={moi.role} />}
            {actif === 'business-plans' && <TabBusinessPlans />}
            {actif === 'signalements' && <TabSignalements role={moi.role} />}
            {actif === 'acces' && moi.role === 'admin' && <TabAcces moiId={moi.id} />}
          </div>
        </main>
      </div>
    </div>
  );
}
