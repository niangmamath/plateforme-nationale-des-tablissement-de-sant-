/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Target, Info, Stethoscope, Eye, Building2, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// LE GÉNÉRATEUR UNIVERSEL ET SES CONFIGURATIONS (L'ADN)
import BusinessPlanGenerator from './BusinessPlanGenerator';
import { VilleGeo } from '../types';

interface SpecialitePoids {
  valeur: number;
  label: string;
}

interface SpecialiteApi {
  id: string;
  nom: string;
  couleur: string;
  titre: string;
  specialiteNom: string;
  cibleKey: string | null;
  cibleLabel: string | null;
  poids: SpecialitePoids[];
  fraisPreliminaires: number;
  surfaceDefaut: number;
  bfr: number;
  amenagements: { id: number; nom: string; prix: number }[];
  effectifs: { id: number; nom: string; qte: number; salaire: number }[];
  machines: { id: number; nom: string; prix: number }[];
  actes: { id: number; type: string | null; nom: string; nbrJour: number; prixUnitaire: number }[];
}

// TON ANCIENNE BASE DE DONNÉES (Conservée comme "Dictionnaire" de statistiques médicales)
const SANTE_DATA_DICTIONARY = [
  { nom: "Ben-M'sick", pop15_59: 60.00, pop60_plus: 17.40, dermatos: 3, ophtalmos: 4, acces: 60 },
  { nom: "Al-Fida", pop15_59: 59.10, pop60_plus: 15.80, dermatos: 4, ophtalmos: 5, acces: 65 },
  { nom: "Mers Sultan", pop15_59: 58.90, pop60_plus: 13.90, dermatos: 9, ophtalmos: 8, acces: 80 },
  { nom: "Sidi Othmane", pop15_59: 61.10, pop60_plus: 20.10, dermatos: 2, ophtalmos: 4, acces: 55 },
  { nom: "Hay Mohammadi", pop15_59: 59.90, pop60_plus: 17.00, dermatos: 3, ophtalmos: 4, acces: 60 },
  { nom: "Moulay Rachid", pop15_59: 62.20, pop60_plus: 23.40, dermatos: 2, ophtalmos: 3, acces: 50 },
  { nom: "Sbata", pop15_59: 60.90, pop60_plus: 18.20, dermatos: 2, ophtalmos: 3, acces: 55 },
  { nom: "Sidi Moumen", pop15_59: 63.30, pop60_plus: 24.80, dermatos: 2, ophtalmos: 4, acces: 65 },
  { nom: "Roches Noires", pop15_59: 61.60, pop60_plus: 21.50, dermatos: 5, ophtalmos: 6, acces: 75 },
  { nom: "Sidi Belyout", pop15_59: 59.70, pop60_plus: 16.40, dermatos: 12, ophtalmos: 10, acces: 85 },
  { nom: "Hay Hassani", pop15_59: 64.30, pop60_plus: 29.60, dermatos: 6, ophtalmos: 8, acces: 75 },
  { nom: "Sidi Bernoussi", pop15_59: 62.00, pop60_plus: 22.20, dermatos: 3, ophtalmos: 4, acces: 65 },
  { nom: "Aïn Chock", pop15_59: 63.00, pop60_plus: 23.70, dermatos: 5, ophtalmos: 6, acces: 75 },
  { nom: "El Maarif", pop15_59: 61.20, pop60_plus: 21.00, dermatos: 18, ophtalmos: 14, acces: 85 },
  { nom: "Anfa", pop15_59: 58.90, pop60_plus: 14.70, dermatos: 22, ophtalmos: 16, acces: 90 },
  { nom: "Aïn Sebaâ", pop15_59: 62.50, pop60_plus: 23.50, dermatos: 4, ophtalmos: 5, acces: 70 },
  { nom: "Agdal", pop15_59: 61.90, pop60_plus: 23.70, dermatos: 8, ophtalmos: 7, acces: 80 },
  { nom: "Saïss", pop15_59: 60.30, pop60_plus: 14.40, dermatos: 5, ophtalmos: 5, acces: 70 },
  { nom: "Zouagha", pop15_59: 59.10, pop60_plus: 10.80, dermatos: 1, ophtalmos: 2, acces: 50 },
  { nom: "Méchouar Fès Jdid", pop15_59: 61.80, pop60_plus: 19.80, dermatos: 2, ophtalmos: 2, acces: 60 }
];

type SpecialtyType = 'Dermatologie' | 'Ophtalmologie' | 'Clinique' | null;

interface ScoringSectionProps {
  villes: VilleGeo[];
  initialVilleId?: string;
  currency?: string;
}

export default function ScoringSection({ villes, initialVilleId, currency = "DH" }: ScoringSectionProps) {
  // Ville active pour cette section : suit la ville sélectionnée globalement quand il y en a une,
  // sinon repli sur la première ville du pays + sélecteur local pour en choisir une autre ici.
  const [activeVilleId, setActiveVilleId] = useState<string | undefined>(initialVilleId ?? villes[0]?.id);

  useEffect(() => {
    setActiveVilleId(initialVilleId ?? villes[0]?.id);
  }, [initialVilleId, villes]);

  const activeVille = villes.find((v) => v.id === activeVilleId) ?? villes[0];
  const villeName = activeVille?.nom ?? '';
  const zones = activeVille?.zones ?? [];

  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyType>(null);
  const [selectedAreaForBP, setSelectedAreaForBP] = useState<any | null>(null);
  const [isExpertMode, setIsExpertMode] = useState(false);

  const [weights, setWeights] = useState({ w1: 50, w2: 30, w3: 20 });

  // Config des spécialités (poids de scoring + templates de business plan) chargée depuis Postgres
  const [specialites, setSpecialites] = useState<SpecialiteApi[]>([]);

  useEffect(() => {
    fetch('/api/specialites')
      .then((r) => r.json())
      .then(setSpecialites)
      .catch(() => setSpecialites([]));
  }, []);

  const handleSelectSpecialty = (spec: SpecialtyType) => {
    setSelectedSpecialty(spec);
    setIsExpertMode(false);

    const found = specialites.find((s) => s.id === spec);
    if (found) {
      setWeights({ w1: found.poids[0].valeur, w2: found.poids[1].valeur, w3: found.poids[2].valeur });
    }
  };

  const rankedAreas = useMemo(() => {
    if (!selectedSpecialty || !zones || zones.length === 0) return [];

    const enrichedZones = zones.map(zone => {
      const stats = SANTE_DATA_DICTIONARY.find(s => s.nom === zone.nom);
      return {
        ...zone,
        ville: villeName,
        pop15_59: stats?.pop15_59 || 60,
        pop60_plus: stats?.pop60_plus || 15,
        dermatos: stats?.dermatos || Math.max(1, Math.round(zone.population / 40000)),
        ophtalmos: stats?.ophtalmos || Math.max(1, Math.round(zone.population / 35000)),
        acces: stats?.acces || 65
      };
    });

    const getMinMax = (key: keyof typeof enrichedZones[0]) => {
      const vals = enrichedZones.map(a => Number(a[key]) || 0);
      return { min: Math.min(...vals), max: Math.max(...vals) };
    };

    const mmPrix = getMinMax('prixM2');
    const mmPop1559 = getMinMax('pop15_59');
    const mmPop60 = getMinMax('pop60_plus');
    const mmPop = getMinMax('population');
    const mmAcces = getMinMax('acces');

    const normalize = (val: number, min: number, max: number) => {
      if (max === min) return 50; 
      return ((val - min) / (max - min)) * 100;
    };

    const totalW = weights.w1 + weights.w2 + weights.w3 || 1;
    const p1 = weights.w1 / totalW;
    const p2 = weights.w2 / totalW;
    const p3 = weights.w3 / totalW;

    return enrichedZones.map(arr => {
      let score = 0;

      const normPrix = normalize(arr.prixM2, mmPrix.min, mmPrix.max);
      const normPop1559 = normalize(arr.pop15_59, mmPop1559.min, mmPop1559.max);
      const normPop60 = normalize(arr.pop60_plus, mmPop60.min, mmPop60.max);
      const normPop = normalize(arr.population, mmPop.min, mmPop.max);
      const normAcces = normalize(arr.acces, mmAcces.min, mmAcces.max);

      if (selectedSpecialty === 'Dermatologie') {
        const densiteDerm = (arr.dermatos / arr.population) * 100000;
        const normConcurrence = Math.max(0, 100 - (densiteDerm * 5)); 
        score = (normPrix * p1) + (normPop1559 * p2) + (normConcurrence * p3);
      } 
      else if (selectedSpecialty === 'Ophtalmologie') {
        const densiteOpht = (arr.ophtalmos / arr.population) * 100000;
        const normConcurrence = Math.max(0, 100 - (densiteOpht * 5));
        const prixMoyenOptimise = 100 - Math.abs(normPrix - 50) * 2; 
        score = (normPop60 * p1) + (normConcurrence * p2) + (Math.max(0, prixMoyenOptimise) * p3);
      }
      else if (selectedSpecialty === 'Clinique') {
        const scorePrixInverse = 100 - normPrix;
        score = (normPop * p1) + (normAcces * p2) + (scorePrixInverse * p3);
      }

      return { ...arr, finalScore: Math.round(score) };
    }).sort((a, b) => b.finalScore - a.finalScore).slice(0, 10);
  }, [selectedSpecialty, weights, zones, villeName]);

  const getLabels = () => {
    const found = specialites.find((s) => s.id === selectedSpecialty);
    return found ? found.poids.map((p) => p.label) : ['', '', ''];
  };

  const totalW = weights.w1 + weights.w2 + weights.w3 || 1;

  // SÉLECTION DYNAMIQUE DE LA CONFIGURATION (L'ADN DU BUSINESS PLAN), chargée depuis Postgres
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button onClick={() => handleSelectSpecialty('Dermatologie')} className={`flex flex-col items-center p-5 md:p-6 rounded-2xl border-2 transition-all ${selectedSpecialty === 'Dermatologie' ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
          <Stethoscope className={`h-7 w-7 md:h-8 md:w-8 mb-3 ${selectedSpecialty === 'Dermatologie' ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="font-bold text-xs md:text-sm uppercase tracking-wider">Dermatologie</span>
        </button>

        <button onClick={() => handleSelectSpecialty('Ophtalmologie')} className={`flex flex-col items-center p-5 md:p-6 rounded-2xl border-2 transition-all ${selectedSpecialty === 'Ophtalmologie' ? 'bg-emerald-600/20 border-emerald-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
          <Eye className={`h-7 w-7 md:h-8 md:w-8 mb-3 ${selectedSpecialty === 'Ophtalmologie' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span className="font-bold text-xs md:text-sm uppercase tracking-wider">Ophtalmologie</span>
        </button>

        <button onClick={() => handleSelectSpecialty('Clinique')} className={`flex flex-col items-center p-5 md:p-6 rounded-2xl border-2 transition-all ${selectedSpecialty === 'Clinique' ? 'bg-purple-600/20 border-purple-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
          <Building2 className={`h-7 w-7 md:h-8 md:w-8 mb-3 ${selectedSpecialty === 'Clinique' ? 'text-purple-400' : 'text-slate-400'}`} />
          <span className="font-bold text-xs md:text-sm uppercase tracking-wider">Clinique Privée</span>
        </button>
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
                  <div className="p-5 border border-blue-500/30 bg-blue-900/10 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((num) => {
                      const key = `w${num}` as keyof typeof weights;
                      const label = getLabels()[num - 1];
                      const realPercentage = Math.round((weights[key] / totalW) * 100);
                      return (
                        <div key={key}>
                          <div className="flex justify-between items-end mb-2">
                            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{label}</label>
                            <span className="text-sm font-black text-blue-400">{realPercentage}%</span>
                          </div>
                          <input type="range" min="0" max="100" value={weights[key]} onChange={(e) => setWeights({...weights, [key]: parseInt(e.target.value)})} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
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

      {/* LE GÉNÉRATEUR UNIVERSEL EST LÀ, TOUT PROPRE ! */}
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