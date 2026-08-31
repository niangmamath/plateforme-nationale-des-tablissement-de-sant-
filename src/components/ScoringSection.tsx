/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Target, Info, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// LE GÉNÉRATEUR UNIVERSEL ET SES CONFIGURATIONS (L'ADN)
import BusinessPlanGenerator from './BusinessPlanGenerator';
import { Etablissement, VilleGeo } from '../types';
import { ICONES, ICONE_DEFAUT } from '../config/specialiteVisuels';

interface SpecialitePoids {
  prix: number;
  population: number;
  densite: number;
  pop1559: number;
  pop60plus: number;
  concurrence: number;
  autresSpecialites: number; // NOUVEAU CRITÈRE
}

interface SpecialiteApi {
  id: string;
  nom: string;
  couleur: string;
  icone: string;
  categorieEtablissement: string;
  titre: string;
  specialiteNom: string;
  cibleKey: string | null;
  cibleLabel: string | null;
  poids: SpecialitePoids;
  fraisPreliminaires: number;
  surfaceDefaut: number;
  bfr: number;
  amenagements: { id: number; nom: string; prix: number }[];
  effectifs: { id: number; nom: string; qte: number; salaire: number }[];
  machines: { id: number; nom: string; prix: number }[];
  actes: { id: number; type: string | null; nom: string; nbrJour: number; prixUnitaire: number }[];
}

type CritereKey = keyof SpecialitePoids;

// 7 critères communs à toutes les spécialités
const CRITERES: { key: CritereKey; label: string }[] = [
  { key: 'prix', label: "Pouvoir d'achat (Prix/m²)" },
  { key: 'population', label: 'Population totale' },
  { key: 'densite', label: 'Densité de population' },
  { key: 'pop1559', label: 'Population active (15-59 ans)' },
  { key: 'pop60plus', label: 'Population sénior (60+ ans)' },
  { key: 'concurrence', label: 'Faible concurrence' },
  { key: 'autresSpecialites', label: "Présence d'autres spécialités" }, // NOUVEAU CURSEUR
];

const COULEURS: Record<string, { actif: string; icone: string }> = {
  blue: { actif: 'bg-blue-600/20 border-blue-500', icone: 'text-blue-400' },
  emerald: { actif: 'bg-emerald-600/20 border-emerald-500', icone: 'text-emerald-400' },
  purple: { actif: 'bg-purple-600/20 border-purple-500', icone: 'text-purple-400' },
  rose: { actif: 'bg-rose-600/20 border-rose-500', icone: 'text-rose-400' },
  amber: { actif: 'bg-amber-600/20 border-amber-500', icone: 'text-amber-400' },
  cyan: { actif: 'bg-cyan-600/20 border-cyan-500', icone: 'text-cyan-400' },
};

interface ScoringSectionProps {
  villes: VilleGeo[];
  etablissements: Etablissement[];
  initialVilleId?: string;
  currency?: string;
}

export default function ScoringSection({ villes, etablissements, initialVilleId, currency = "DH" }: ScoringSectionProps) {
  const [activeVilleId, setActiveVilleId] = useState<string | undefined>(initialVilleId ?? villes[0]?.id);

  useEffect(() => {
    setActiveVilleId(initialVilleId ?? villes[0]?.id);
  }, [initialVilleId, villes]);

  const activeVille = villes.find((v) => v.id === activeVilleId) ?? villes[0];
  const villeName = activeVille?.nom ?? '';
  const zones = activeVille?.zones ?? [];

  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [selectedAreaForBP, setSelectedAreaForBP] = useState<any | null>(null);
  const [isExpertMode, setIsExpertMode] = useState(false);

  // Distribution initiale par défaut (total = ~100)
  const [weights, setWeights] = useState<SpecialitePoids>({ 
    prix: 14, population: 14, densite: 14, pop1559: 14, pop60plus: 14, concurrence: 15, autresSpecialites: 15 
  });

  const [specialites, setSpecialites] = useState<SpecialiteApi[]>([]);

  useEffect(() => {
    fetch('/api/specialites')
      .then((r) => r.json())
      .then(setSpecialites)
      .catch(() => setSpecialites([]));
  }, []);

  const handleSelectSpecialty = (spec: string) => {
    setSelectedSpecialty(spec);
    setIsExpertMode(false);

    const found = specialites.find((s) => s.id === spec);
    if (found) {
      // Sécurité au cas où la base de données ne contient pas encore le champ "autresSpecialites"
      setWeights({
        ...found.poids,
        autresSpecialites: (found.poids as any).autresSpecialites ?? 15
      });
    }
  };

  // 1. Calcul des Concurrents Directs
  const concurrenceParZone = useMemo(() => {
    const categorie = specialites.find((s) => s.id === selectedSpecialty)?.categorieEtablissement;
    if (!categorie) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const e of etablissements) {
      if (e.categorie !== categorie || e.ville !== villeName || !e.arrondissement) continue;
      counts[e.arrondissement] = (counts[e.arrondissement] ?? 0) + 1;
    }
    return counts;
  }, [etablissements, selectedSpecialty, specialites, villeName]);

  // 2. Calcul des Autres Spécialités (Effet de Synergie / Pôle médical)
  const autresSpecialitesParZone = useMemo(() => {
    const categorie = specialites.find((s) => s.id === selectedSpecialty)?.categorieEtablissement;
    if (!categorie) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const e of etablissements) {
      // On compte ceux qui sont dans la même ville, mais qui NE SONT PAS de la même catégorie
      if (e.categorie === categorie || e.ville !== villeName || !e.arrondissement) continue;
      counts[e.arrondissement] = (counts[e.arrondissement] ?? 0) + 1;
    }
    return counts;
  }, [etablissements, selectedSpecialty, specialites, villeName]);

  const rankedAreas = useMemo(() => {
    if (!selectedSpecialty || !zones || zones.length === 0) return [];

    const enrichedZones = zones.map(zone => ({
      ...zone,
      ville: villeName,
      pop1559: zone.pop15_59 ?? 60,
      pop60plus: zone.pop60_plus ?? 15,
      densiteVal: zone.densite ?? 0,
      concurrenceCount: concurrenceParZone[zone.nom] ?? 0,
      autresSpecCount: autresSpecialitesParZone[zone.nom] ?? 0, // Ajout aux zones
    }));

    const getMinMax = (key: keyof typeof enrichedZones[0]) => {
      const vals = enrichedZones.map(a => Number(a[key]) || 0);
      return { min: Math.min(...vals), max: Math.max(...vals) };
    };

    const mmPrix = getMinMax('prixM2');
    const mmPop1559 = getMinMax('pop1559');
    const mmPop60plus = getMinMax('pop60plus');
    const mmPop = getMinMax('population');
    const mmDensite = getMinMax('densiteVal');
    const mmConcurrence = getMinMax('concurrenceCount');
    const mmAutresSpec = getMinMax('autresSpecCount');

    const normalize = (val: number, min: number, max: number) => {
      if (max === min) return 50;
      return ((val - min) / (max - min)) * 100;
    };

    const totalW = weights.prix + weights.population + weights.densite + weights.pop1559 + weights.pop60plus + weights.concurrence + weights.autresSpecialites || 1;
    const pPrix = weights.prix / totalW;
    const pPop = weights.population / totalW;
    const pDensite = weights.densite / totalW;
    const pPop1559 = weights.pop1559 / totalW;
    const pPop60plus = weights.pop60plus / totalW;
    const pConcurrence = weights.concurrence / totalW;
    const pAutresSpec = weights.autresSpecialites / totalW;

    return enrichedZones.map(arr => {
      const normPrix = normalize(arr.prixM2, mmPrix.min, mmPrix.max);
      const normPop1559 = normalize(arr.pop1559, mmPop1559.min, mmPop1559.max);
      const normPop60plus = normalize(arr.pop60plus, mmPop60plus.min, mmPop60plus.max);
      const normPop = normalize(arr.population, mmPop.min, mmPop.max);
      const normDensite = normalize(arr.densiteVal, mmDensite.min, mmDensite.max);
      const normConcurrence = 100 - normalize(arr.concurrenceCount, mmConcurrence.min, mmConcurrence.max);
      
      // Plus il y a d'autres spécialités, meilleur est le score de ce critère (synergie)
      const normAutresSpec = normalize(arr.autresSpecCount, mmAutresSpec.min, mmAutresSpec.max);

      const score = (normPrix * pPrix) + (normPop * pPop) + (normDensite * pDensite) + (normPop1559 * pPop1559) + (normPop60plus * pPop60plus) + (normConcurrence * pConcurrence) + (normAutresSpec * pAutresSpec);

      return { ...arr, finalScore: Math.round(score) };
    }).sort((a, b) => b.finalScore - a.finalScore).slice(0, 10);
  }, [selectedSpecialty, weights, zones, villeName, concurrenceParZone, autresSpecialitesParZone]);

  const totalW = weights.prix + weights.population + weights.densite + weights.pop1559 + weights.pop60plus + weights.concurrence + weights.autresSpecialites || 1;

  const getActiveConfig = () => specialites.find((s) => s.id === selectedSpecialty) || null;

  return (
    <section className="bg-slate-900 rounded-3xl p-5 md:p-8 shadow-2xl border border-slate-800 text-white">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-4">
          <Target className="h-8 w-8 text-blue-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-3">Où ouvrir à {villeName} ?</h2>
        <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed">
          Notre algorithme croise la démographie du HCP, le pouvoir d'achat estimé et la saturation concurrentielle.
        </p>

        {villes.length > 1 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ville analysée</span>
            <select
              value={activeVilleId}
              onChange={(e) => setActiveVilleId(e.target.value)}
              className="bg-transparent text-sm font-bold text-blue-300 outline-none cursor-pointer"
            >
              {villes.map((v) => (
                <option key={v.id} value={v.id} className="bg-slate-800 text-white">{v.nom}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {specialites.map((s) => {
          const Icone = ICONES[s.icone] ?? ICONE_DEFAUT;
          const couleurs = COULEURS[s.couleur] ?? COULEURS.blue;
          const actif = selectedSpecialty === s.id;
          return (
            <button key={s.id} onClick={() => handleSelectSpecialty(s.id)} className={`flex flex-col items-center p-5 md:p-6 rounded-2xl border-2 transition-all ${actif ? couleurs.actif : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
              <Icone className={`h-7 w-7 md:h-8 md:w-8 mb-3 ${actif ? couleurs.icone : 'text-slate-400'}`} />
              <span className="font-bold text-xs md:text-sm uppercase tracking-wider">{s.nom}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {selectedSpecialty && (
          <motion.div key={selectedSpecialty} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 p-4 bg-slate-800/50 rounded-xl mb-6 border border-slate-700/50">
              <div className="flex gap-4">
                <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5 hidden sm:block" />
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-300 mb-1 flex items-center gap-2">Méthodologie Standard</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
                    L'algorithme pondère les données géographiques de {villeName}. Ajustez les critères avec le mode expert.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsExpertMode(!isExpertMode)} className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border ${isExpertMode ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
                <SlidersHorizontal className="h-4 w-4" />
                {isExpertMode ? "Fermer les réglages" : "Personnaliser"}
              </button>
            </div>

            <AnimatePresence>
              {isExpertMode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8 overflow-hidden">
                  <div className="p-5 border border-blue-500/30 bg-blue-900/10 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {CRITERES.map(({ key, label }) => {
                      const realPercentage = Math.round((weights[key] / totalW) * 100);
                      return (
                        <div key={key}>
                          <div className="flex justify-between items-end mb-2">
                            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{label}</label>
                            <span className="text-sm font-black text-blue-400">{realPercentage}%</span>
                          </div>
                          <input type="range" min="0" max="100" value={weights[key]} onChange={(e) => setWeights({ ...weights, [key]: parseInt(e.target.value) })} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-500">
                    <th className="pb-3 pl-4">Rang</th>
                    <th className="pb-3">Zone géographique</th>
                    <th className="pb-3 text-center">Score Géospatial</th>
                    <th className="pb-3 text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {rankedAreas.map((area, index) => (
                    <tr key={area.nom} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 pl-4">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : index === 1 ? 'bg-slate-300/20 text-slate-300' : index === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-slate-800 text-slate-500'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-sm text-slate-200">{area.nom} <span className="text-[10px] font-normal text-slate-500 ml-1">({area.ville})</span></div>
                        <div className="text-[10px] text-slate-500">{area.population.toLocaleString('fr-FR')} hab. • {area.prixM2.toLocaleString('fr-FR')} {currency}/m²</div>
                      </td>
                      <td className="py-4 text-center">
                        <div className="inline-flex items-baseline gap-1">
                          <span className="text-xl font-black text-blue-400">{area.finalScore}</span>
                          <span className="text-[10px] text-slate-500 font-bold">/ 100</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full mx-auto mt-1 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${area.finalScore}%` }}></div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <button onClick={() => setSelectedAreaForBP(area)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-[10px] font-bold uppercase tracking-wider text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20">
                          <TrendingUp className="h-3 w-3" /> Simuler B.P
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAreaForBP && selectedSpecialty && getActiveConfig() && (
          <BusinessPlanGenerator 
            isOpen={!!selectedAreaForBP} 
            onClose={() => setSelectedAreaForBP(null)} 
            area={selectedAreaForBP} 
            config={getActiveConfig()} 
          />
        )}
      </AnimatePresence>
    </section>
  );
}