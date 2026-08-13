/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Etablissement, Specialite } from '../types';
import { MapPin, ChevronRight } from 'lucide-react';
import { List, type RowComponentProps } from 'react-window';
import { ICONES, ICONE_DEFAUT, BADGE_PAR_COULEUR, BADGE_DEFAUT } from '../config/specialiteVisuels';

interface SidebarListProps {
  establishments: Etablissement[];
  selectedId: string | null;
  onSelectEstablishment: (establishment: Etablissement) => void;
  specialites: Specialite[];
}

// Hauteur fixe par carte (px) — la liste est virtualisée (react-window) car elle peut
// contenir plusieurs milliers d'établissements non filtrés ; sans virtualisation,
// React devait monter un nœud DOM animé par établissement d'un coup, ce qui rendait
// le premier affichage extrêmement lent (mesuré : plusieurs dizaines de secondes).
const HAUTEUR_CARTE = 148;

interface RowProps {
  establishments: Etablissement[];
  selectedId: string | null;
  onSelectEstablishment: (establishment: Etablissement) => void;
  getCategoryClasses: (category: string) => string;
  getCategoryIcon: (category: string) => React.ReactElement;
}

function Row({
  index,
  style,
  establishments,
  selectedId,
  onSelectEstablishment,
  getCategoryClasses,
  getCategoryIcon,
}: RowComponentProps<RowProps>) {
  const etab = establishments[index];
  const isSelected = etab.id === selectedId;

  return (
    <div style={style} className="px-0">
      <div
        id={`etab-item-${etab.id}`}
        className={`h-full p-4 border-b border-slate-100 transition-all duration-150 cursor-pointer text-left relative ${
          isSelected
            ? 'bg-slate-50 border-l-4 border-l-slate-900 shadow-sm'
            : 'hover:bg-slate-50/50 border-l-4 border-l-transparent'
        }`}
        onClick={() => onSelectEstablishment(etab)}
      >
        <div className="flex flex-col gap-1.5">
          {/* Category */}
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getCategoryClasses(etab.categorie)}`}>
              {getCategoryIcon(etab.categorie)}
              {etab.categorie}
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${isSelected ? 'text-blue-500 translate-x-1' : 'text-slate-300'}`} />
          </div>

          {/* Establishment Name */}
          <h3 className={`text-xs font-black tracking-tight leading-snug transition-colors line-clamp-2 ${
            isSelected ? 'text-slate-950 text-sm' : 'text-slate-800'
          }`}>
            {etab.nom}
          </h3>

          {/* Location Info */}
          <div className="flex items-start gap-1 text-[11px] text-slate-500 leading-normal">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
            <div className="min-w-0">
              <span className="font-bold text-slate-800">{etab.quartier}</span>, {etab.ville}
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[230px]" title={etab.adresse}>
                {etab.adresse}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SidebarList({
  establishments,
  selectedId,
  onSelectEstablishment,
  specialites
}: SidebarListProps) {

  // Badge/icône par catégorie, dérivés des spécialités publiées (icone/couleur en base) — les
  // catégories sans spécialité correspondante (ex. "Cabinet Médical") retombent sur un badge neutre.
  const findSpecialite = (category: string) => specialites.find((s) => s.categorieEtablissement === category);

  const getCategoryClasses = (category: string) => {
    const spec = findSpecialite(category);
    const badge = spec ? (BADGE_PAR_COULEUR[spec.couleur] ?? BADGE_DEFAUT) : BADGE_DEFAUT;
    return `${badge.bg} ${badge.text} ${badge.border}`;
  };

  const getCategoryIcon = (category: string) => {
    const spec = findSpecialite(category);
    const Icone = (spec ? ICONES[spec.icone] : undefined) ?? ICONE_DEFAUT;
    return <Icone className="h-3 w-3 mr-1" />;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header of Sidebar List */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <span>RÉSULTATS</span>
            <span className="px-2 py-0.5 bg-slate-900 text-white rounded-md text-[10px] font-black">
              {establishments.length}
            </span>
          </h2>
          <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Établissements correspondants</p>
        </div>
        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
          TRI PAR PERTINENCE
        </div>
      </div>

      {/* List container */}
      <div className="flex-1 min-h-0">
        {establishments.length === 0 ? (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-slate-50 rounded-full text-slate-400 border border-slate-100">
                <MapPin className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-xs font-black uppercase text-slate-700">Aucun établissement</h3>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto font-semibold leading-relaxed">
              Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.
            </p>
          </div>
        ) : (
          <List
            rowComponent={Row}
            rowCount={establishments.length}
            rowHeight={HAUTEUR_CARTE}
            rowProps={{ establishments, selectedId, onSelectEstablishment, getCategoryClasses, getCategoryIcon }}
            rowKey={(index, data) => data.establishments[index].id}
            overscanCount={6}
            style={{ height: '100%', width: '100%' }}
            className="scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
          />
        )}
      </div>
    </div>
  );
}
