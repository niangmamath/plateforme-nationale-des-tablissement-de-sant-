/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, Map, Landmark } from 'lucide-react';

const LIENS = [
  { route: '/', label: 'Annuaire & carte', icone: Map },
  { route: '/simulateur-credit', label: 'Simulateur de crédit', icone: Landmark },
];

// En-tête partagé par la page d'accueil et le simulateur de crédit — même logo, même navigation,
// pour que passer de l'une à l'autre reste cohérent. Navigation par fragment d'URL (#/...), voir
// hooks/useHashRoute.ts.
export default function SiteHeader({ route }: { route: string }) {
  return (
    <header className="sticky top-0 z-[1010] bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-4 md:px-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

        {/* Logo Brand / Identity */}
        <a href="#/" className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Activity className="h-5.5 w-5.5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tight mt-1 uppercase">
              Empower Doctor
            </h1>
          </div>
        </a>

        <nav aria-label="Navigation principale" className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/80 rounded-xl p-1">
          {LIENS.map(({ route: cible, label, icone: Icone }) => {
            const actif = route === cible;
            return (
              <a
                key={cible}
                href={`#${cible}`}
                aria-current={actif ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                  actif ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icone className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
