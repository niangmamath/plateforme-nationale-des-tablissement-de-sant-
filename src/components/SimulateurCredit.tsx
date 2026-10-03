/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';
import TableauAmortissementCredit, { formatDH } from './TableauAmortissementCredit';
import { calculerRecapCredit, type TypeDiffere } from '../utils/projectionBP';

const OPTIONS_DIFFERE: { value: TypeDiffere; label: string }[] = [
  { value: 'aucun', label: 'Aucun différé' },
  { value: 'capital', label: 'Différé capital (intérêts seuls payés)' },
  { value: 'interet', label: 'Différé intérêt (capital seul payé)' },
  { value: 'interetCapital', label: 'Différé intérêt & capital (rien payé)' },
];

// Simulateur de crédit autonome : utilisable sans passer par un business plan, pour n'importe quel
// projet (achat de local, équipement...). Même calcul et même composant d'affichage que le détail
// mensuel du business plan (TableauAmortissementCredit), mais ici avec ses propres champs de
// saisie — les deux usages ne sont pas synchronisés entre eux.
export default function SimulateurCredit() {
  const [montant, setMontant] = useState(500000);
  const [tauxPct, setTauxPct] = useState(4.65);
  const [dureeAnnees, setDureeAnnees] = useState(7);
  const [typeDiffere, setTypeDiffere] = useState<TypeDiffere>('aucun');
  const [dureeDiffereMois, setDureeDiffereMois] = useState(24);

  const recap = useMemo(
    () => calculerRecapCredit(montant, tauxPct, dureeAnnees, dureeDiffereMois, typeDiffere),
    [montant, tauxPct, dureeAnnees, dureeDiffereMois, typeDiffere]
  );
  const dureeAns = Math.round(dureeAnnees * 10) / 10;

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

      <div className="max-w-5xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Paramètres */}
          <div className="flex flex-col gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-type-differe" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Différé de remboursement</label>
              <select
                id="sim-type-differe"
                value={typeDiffere}
                onChange={(e) => setTypeDiffere(e.target.value as TypeDiffere)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-black text-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {OPTIONS_DIFFERE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {typeDiffere !== 'aucun' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="sim-duree-differe" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Durée du différé (mois)</label>
                <input
                  id="sim-duree-differe"
                  type="number"
                  min={0}
                  max={Math.max(0, dureeAnnees * 12 - 1)}
                  value={dureeDiffereMois}
                  onChange={(e) => setDureeDiffereMois(Math.max(0, Number(e.target.value) || 0))}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl font-black text-blue-300 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Récapitulatif */}
          <div className="bg-blue-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-black uppercase tracking-wider text-blue-100 mb-4">Récapitulatif</p>
            <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">{recap.nbDiffere > 0 ? 'Mensualité après différé' : 'Paiement mensuel'}</p>
            <p className="text-4xl font-black text-white mb-1">{formatDH(recap.mensualiteApres)}</p>
            <p className="text-xs text-blue-200 mb-4">Pendant {dureeAns} ans{recap.nbDiffere > 0 ? `, dont ${recap.nbDiffere} mois de différé` : ''}</p>
            <div className="w-full border-t border-blue-500/50 pt-4 grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[10px] text-blue-200 uppercase tracking-wide">Coût total</p>
                <p className="text-sm font-black text-white">{formatDH(recap.coutTotalCredit)}</p>
              </div>
              <div>
                <p className="text-[10px] text-blue-200 uppercase tracking-wide">Total remboursé</p>
                <p className="text-sm font-black text-white">{formatDH(recap.totalRembourse)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white text-slate-900 rounded-xl p-4 md:p-5">
          <TableauAmortissementCredit montant={montant} tauxPct={tauxPct} dureeAnnees={dureeAnnees} dureeDiffereMois={dureeDiffereMois} typeDiffere={typeDiffere} reploiParDefaut={false} masquerRecap titre="Tableau d'amortissement" />
        </div>
      </div>
    </section>
  );
}
