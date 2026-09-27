/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, Map, BarChart3, MapPin, Landmark } from 'lucide-react';

interface LienNav {
  cible: string; // chemin réel, avec ancre éventuelle : "/", "/#scoring-section", "/simulateur-credit"...
  label: string;
  icone: React.ComponentType<{ className?: string }>;
}

const LIENS: LienNav[] = [
  { cible: '/', label: 'Annuaire & carte', icone: Map },
  { cible: '/#analytics-section', label: 'Analytique & Intelligence Géospatiale', icone: BarChart3 },
  { cible: '/#scoring-section', label: 'Où ouvrir', icone: MapPin },
  { cible: '/simulateur-credit', label: 'Simulateur de crédit', icone: Landmark },
];

function estActif(cible: string, route: string, ancre: string): boolean {
  const url = new URL(cible, window.location.origin);
  return url.pathname === route && url.hash.replace(/^#/, '') === ancre;
}

interface SiteHeaderProps {
  route: string;
  ancre: string;
  naviguer: (cible: string) => void;
}

// En-tête partagé par toutes les pages/sections — même logo, même navigation. "Analytique &
// Intelligence Géospatiale" et "Où ouvrir" pointent vers une ancre de la page d'accueil (pas une
// page à part) : le clic navigue vers l'accueil si besoin, puis défile jusqu'à la section une fois
// ses données chargées (effet dans App.tsx) ; si on y est déjà, ça défile directement, sans
// re-déclencher de chargement.
export default function SiteHeader({ route, ancre, naviguer }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-[1010] bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-4 md:px-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

        {/* Logo Brand / Identity */}
        <a href="/" onClick={(e) => { e.preventDefault(); naviguer('/'); }} className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Activity className="h-5.5 w-5.5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tight mt-1 uppercase">
              Empower Doctor
            </h1>
          </div>
        </a>

        {/* Sur petit écran : grille sur toute la largeur, libellés visibles (2 colonnes, texte
            centré, peut passer sur deux lignes). À partir de sm : rangée compacte comme avant. */}
        <nav aria-label="Navigation principale" className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto bg-slate-100/80 border border-slate-200/80 rounded-xl p-1">
          {LIENS.map(({ cible, label, icone: Icone }) => {
            const actif = estActif(cible, route, ancre);
            return (
              <a
                key={cible}
                href={cible}
                onClick={(e) => { e.preventDefault(); naviguer(cible); }}
                aria-current={actif ? 'page' : undefined}
                className={`flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 rounded-lg text-center text-[11px] sm:text-xs font-bold uppercase tracking-wide leading-tight transition-colors ${
                  actif ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icone className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
