/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { X, FileText, TrendingUp, Calculator, Stethoscope, Building, PhoneCall, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SPECIALTIES_CONFIG } from '../config/specialties';

interface ArrondissementData {
  nom: string;
  ville: string;
  population: number;
  prixM2: number;
  pop15_59: number;
  pop60_plus: number;
  dermatos?: number;
  ophtalmos?: number;
}

interface BusinessPlanGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  arrondissement: ArrondissementData | null;
  specialty: string;
}

export default function BusinessPlanGenerator({ isOpen, onClose, arrondissement, specialty }: BusinessPlanGeneratorProps) {
  
  const financials = useMemo(() => {
    if (!arrondissement || !SPECIALTIES_CONFIG[specialty]) return null;

    const config = SPECIALTIES_CONFIG[specialty];
    const surfaceRequise = 80;
    const prixAchatEstime = surfaceRequise * arrondissement.prixM2;
    const loyerMensuelEstime = Math.round((prixAchatEstime * 0.06) / 12); 

    const ciblePop = Math.round(arrondissement.population * (arrondissement[config.cibleKey] / 100));

    // Déterminer la concurrence (simplifié pour l'exemple)
    const concurrence = specialty === 'Dermatologie' ? (arrondissement.dermatos || 0) : (arrondissement.ophtalmos || 0);

    return {
      loyerMensuelEstime,
      prixAchatEstime,
      equipementCout: config.businessPlan.equipementCout,
      caMensuelProj: config.businessPlan.caMensuelProj,
      equipementsList: config.businessPlan.equipementsList,
      ciblePop,
      cibleLabel: config.cibleLabel,
      concurrence
    };
  }, [arrondissement, specialty]);

  if (!isOpen || !arrondissement || !financials) return null;

  const config = SPECIALTIES_CONFIG[specialty];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 font-sans">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

        <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }} className="relative w-full max-w-4xl max-h-[90vh] bg-slate-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          
          <div className="bg-slate-900 p-6 flex items-start justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest rounded">Confidentiel</span>
                <span className="px-2.5 py-1 bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded">Simulation B2B</span>
              </div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-400" />
                Plan d'Affaires Prévisionnel
              </h2>
              <p className="text-slate-400 text-sm mt-1 font-medium">
                Projet d'installation en <strong className="text-white">{config.label}</strong> — <strong className="text-white">{arrondissement.nom} ({arrondissement.ville})</strong>
              </p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" /> Étude de Marché Locale
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Bassin de Population</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{arrondissement.population.toLocaleString('fr-FR')}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Habitants résidents</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">Cœur de Cible</div>
                  <div className="text-2xl font-black text-blue-900 mt-1">{financials.ciblePop.toLocaleString('fr-FR')}</div>
                  <div className="text-[10px] text-blue-500 mt-1">{financials.cibleLabel}</div>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Concurrence Locale</div>
                  <div className="text-2xl font-black text-amber-900 mt-1">{financials.concurrence}</div>
                  <div className="text-[10px] text-amber-600 mt-1">Cabinets déjà implantés</div>
                </div>
              </div>
            </section>

            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" /> Structure Financière (Basée sur Indice YaK)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Hypothèse Immobilière (80m²)</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-2 font-medium text-slate-600"><Building className="h-4 w-4 text-slate-400"/> Prix moyen au m²</span>
                      <span className="font-black text-slate-900">{arrondissement.prixM2.toLocaleString('fr-FR')} DH</span>
                    </li>
                    <li className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <span className="font-medium text-slate-600">Loyer mensuel estimé</span>
                      <span className="font-black text-slate-900">~ {financials.loyerMensuelEstime.toLocaleString('fr-FR')} DH</span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-600">Acquisition estimée</span>
                      <span className="font-black text-slate-900">{financials.prixAchatEstime.toLocaleString('fr-FR')} DH</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Prévisionnel d'Activité</h4>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 h-full flex flex-col justify-center">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1 flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" /> Chiffre d'Affaires Mensuel Brut (Est.)
                    </div>
                    <div className="text-3xl font-black text-emerald-600">{financials.caMensuelProj.toLocaleString('fr-FR')} DH</div>
                    <div className="text-[10px] text-emerald-600/70 mt-2 leading-tight">
                      Basé sur la densité de population cible et la tarification moyenne de la spécialité.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-purple-600" /> Plan d'Investissement & Partenariats
              </h3>
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Équipement Technique Requis</span>
                    <span className="text-sm font-black text-slate-900">Est. {financials.equipementCout.toLocaleString('fr-FR')} DH</span>
                  </div>
                  <ul className="space-y-2">
                    {financials.equipementsList.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="w-full lg:w-72 bg-slate-900 rounded-xl p-5 text-center shrink-0">
                  <div className="text-white font-black text-sm mb-2">Accélérez votre projet</div>
                  <p className="text-slate-400 text-[10px] leading-relaxed mb-4">
                    Envoyez ce plan d'affaires à nos partenaires bancaires pour obtenir une pré-validation de financement en 48h.
                  </p>
                  <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-wider py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <PhoneCall className="h-4 w-4" /> Demander un Financement
                  </button>
                  <p className="text-slate-500 text-[8px] uppercase tracking-widest mt-3">Générateur de Leads B2B</p>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}