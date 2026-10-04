/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity, Map, BarChart3, MapPin, Landmark, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LienNav {
  cible: string; // chemin réel, avec ancre éventuelle : "/", "/#scoring-section", "/simulateur-credit"...
  label: string;
  icone: React.ComponentType<{ className?: string }>;
}

const LIENS: LienNav[] = [
  { cible: '/', label: 'Annuaire & carte', icone: Map },
  { cible: '/#analytics-section', label: 'Analytique & Intelligence Géospatiale', icone: BarChart3 },
  { cible: '/#scoring-section', label: 'Où ouvrir + Business Plan', icone: MapPin },
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
//
// Connexion/compte : aucune page de login/logout dédiée, la connexion se fait via la modale
// ouverte par "Simuler B.P" (voir ScoringSection). Sur grand écran, l'identité connectée tient
// dans un avatar (initiale) avec un petit menu déroulant (e-mail + déconnexion) plutôt que
// d'afficher l'adresse en toutes lettres à côté d'un bouton — ça surchargeait la barre, déjà
// occupée par le logo et 4 liens de nav. Sur téléphone, nav et compte sont tous les deux dans un
// seul menu hamburger : à cette largeur il n'y a de toute façon la place que pour un élément après
// le logo.
export default function SiteHeader({ route, ancre, naviguer }: SiteHeaderProps) {
  const { utilisateur, deconnecter } = useAuth();
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false);
  const [menuCompteOuvert, setMenuCompteOuvert] = useState(false);

  const allerVersEtFermer = (cible: string) => {
    naviguer(cible);
    setMenuMobileOuvert(false);
  };

  return (
    <header className="sticky top-0 z-[1010] bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-4 md:px-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

        {/* Logo Brand / Identity */}
        <a href="/" onClick={(e) => { e.preventDefault(); allerVersEtFermer('/'); }} className="flex items-center gap-3.5 shrink-0">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Activity className="h-5.5 w-5.5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tight mt-1 uppercase">
              Empower Doctor
            </h1>
          </div>
        </a>

        {/* Navigation — visible à partir de sm, repliée dans le panneau hamburger en dessous */}
        <nav aria-label="Navigation principale" className="hidden sm:flex sm:items-center gap-1.5 bg-slate-100/80 border border-slate-200/80 rounded-xl p-1">
          {LIENS.map(({ cible, label, icone: Icone }) => {
            const actif = estActif(cible, route, ancre);
            return (
              <a
                key={cible}
                href={cible}
                onClick={(e) => { e.preventDefault(); naviguer(cible); }}
                aria-current={actif ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide leading-tight transition-colors ${
                  actif ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icone className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>

        {/* Compte — avatar + menu déroulant, visible à partir de sm seulement */}
        {utilisateur && (
          <div className="hidden sm:block relative">
            <button
              onClick={() => setMenuCompteOuvert((o) => !o)}
              className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center transition-colors"
              title={utilisateur.email}
            >
              {utilisateur.email[0]?.toUpperCase()}
            </button>
            {menuCompteOuvert && (
              <>
                <button aria-hidden className="fixed inset-0 z-[1019] cursor-default" onClick={() => setMenuCompteOuvert(false)} />
                <div className="absolute right-0 top-11 z-[1020] w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-2">
                  <p className="px-2.5 py-2 text-xs text-slate-500 truncate border-b border-slate-100 mb-1" title={utilisateur.email}>{utilisateur.email}</p>
                  <button
                    onClick={() => { deconnecter(); setMenuCompteOuvert(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bouton hamburger — téléphone uniquement */}
        <button
          onClick={() => setMenuMobileOuvert((o) => !o)}
          className="sm:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label={menuMobileOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuMobileOuvert}
        >
          {menuMobileOuvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Panneau mobile — nav + compte regroupés, uniquement sous sm */}
      {menuMobileOuvert && (
        <nav aria-label="Navigation principale (mobile)" className="sm:hidden mt-4 pt-4 border-t border-slate-200/80 flex flex-col gap-1">
          {LIENS.map(({ cible, label, icone: Icone }) => {
            const actif = estActif(cible, route, ancre);
            return (
              <a
                key={cible}
                href={cible}
                onClick={(e) => { e.preventDefault(); allerVersEtFermer(cible); }}
                aria-current={actif ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-colors ${
                  actif ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icone className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </a>
            );
          })}
          {utilisateur && (
            <div className="mt-2 pt-3 border-t border-slate-200/80">
              <p className="px-3 pb-2 text-xs text-slate-500 truncate" title={utilisateur.email}>{utilisateur.email}</p>
              <button
                onClick={() => { deconnecter(); setMenuMobileOuvert(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" /> Se déconnecter
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
