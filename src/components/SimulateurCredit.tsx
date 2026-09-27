/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Landmark } from 'lucide-react';
import TableauAmortissementCredit from './TableauAmortissementCredit';

// Simulateur de crédit autonome : utilisable sans passer par un business plan, pour n'importe quel
// projet (achat de local, équipement...). Même calcul et même composant d'affichage que le détail
// mensuel du business plan (TableauAmortissementCredit), mais ici avec ses propres champs de
// saisie — les deux usages ne sont pas synchronisés entre eux.
export default function SimulateurCredit() {
  const [montant, setMontant] = useState(500000);
  const [tauxPct, setTauxPct] = useState(4.65);
  const [dureeAnnees, setDureeAnnees] = useState(7);

  return (
    <section id="credit-section" className="mt-8 bg-slate-900 rounded-3xl p-5 md:p-8 shadow-2xl border border-slate-800 text-white">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-4">
          <Landmark className="h-8 w-8 text-blue-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-3">Simulateur de crédit</h2>
        <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed">
          Estimez la mensualité et le coût total d'un crédit (local, équipement…), avec le détail mois par mois.
        </p>
      </div>

      <div className="max-w-3xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <label htmlFor="sim-montant" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Montant emprunté (DH)</label>
            <input
              id="sim-montant"
              type="number"
              min={0}
              value={montant}
              onChange={(e) => setMontant(Math.max(0, Number(e.target.value) || 0))}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-black text-blue-300 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sim-taux" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Taux annuel (%)</label>
            <input
              id="sim-taux"
              type="number"
              step="0.05"
              min={0}
              value={tauxPct}
              onChange={(e) => setTauxPct(Math.max(0, Number(e.target.value) || 0))}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-black text-blue-300 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sim-duree" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Durée (années)</label>
            <input
              id="sim-duree"
              type="number"
              min={0}
              value={dureeAnnees}
              onChange={(e) => setDureeAnnees(Math.max(0, Number(e.target.value) || 0))}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-black text-blue-300 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white text-slate-900 rounded-xl p-4 md:p-5">
          <TableauAmortissementCredit montant={montant} tauxPct={tauxPct} dureeAnnees={dureeAnnees} reploiParDefaut={false} titre="Tableau d'amortissement" />
        </div>
      </div>
    </section>
  );
}
