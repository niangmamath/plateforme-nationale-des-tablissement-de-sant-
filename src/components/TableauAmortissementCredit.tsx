/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { tableauAmortissement } from '../utils/projectionBP';

const formatDH = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ') + ' DH';

interface TableauAmortissementCreditProps {
  montant: number;
  tauxPct: number;
  dureeAnnees: number;
  /** Replié par défaut (usage dans le business plan) ; déplié par défaut sur la page autonome. */
  reploiParDefaut?: boolean;
  /** Titre du résumé, adapté au contexte où le composant est posé. */
  titre?: string;
}

// Résultat d'un crédit (mensualité, coût total, tableau mois par mois) — calcul pur dans
// utils/projectionBP.ts, ce composant n'est que l'affichage. Utilisé à la fois par la page
// autonome "Simulateur de crédit" (avec ses propres champs de saisie autour) et par le business
// plan (en lecture seule, à partir du crédit déjà calculé dans le plan de financement) : les deux
// usages restent indépendants, sans synchronisation entre eux.
export default function TableauAmortissementCredit({ montant, tauxPct, dureeAnnees, reploiParDefaut = true, titre = 'Détail mois par mois' }: TableauAmortissementCreditProps) {
  const [ouvert, setOuvert] = useState(!reploiParDefaut);
  const lignes = useMemo(() => tableauAmortissement(montant, tauxPct, dureeAnnees), [montant, tauxPct, dureeAnnees]);
  // Le composant est monté à deux endroits qui peuvent coexister (page autonome + business plan
  // ouvert par-dessus) : des id fixes seraient dupliqués dans le DOM. useId() donne un identifiant
  // unique par instance, tout en gardant aria-controls valide pour chacune.
  const idBase = useId();
  const idDetail = `${idBase}-detail`;

  if (montant <= 0 || dureeAnnees <= 0) {
    return <p className="text-sm text-slate-500 italic">Renseignez un montant et une durée pour calculer l'échéancier.</p>;
  }

  const mensualite = lignes[0]?.mensualite ?? 0;
  const coutTotalCredit = lignes.reduce((acc, l) => acc + l.interets, 0);
  const totalRembourse = montant + coutTotalCredit;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Mensualité</p>
          <p data-champ="mensualite" className="text-lg font-black text-blue-900">{formatDH(mensualite)}</p>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Coût total du crédit</p>
          <p data-champ="cout-total" className="text-lg font-black text-slate-800">{formatDH(coutTotalCredit)}</p>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total remboursé</p>
          <p data-champ="total-rembourse" className="text-lg font-black text-slate-800">{formatDH(totalRembourse)}</p>
        </div>
      </div>

      <button
        type="button"
        data-role="tableau-amortissement-toggle"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls={idDetail}
        className="print:hidden inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900"
      >
        {ouvert ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {titre} ({lignes.length} mensualités)
      </button>

      {ouvert && (
        <div id={idDetail} data-role="tableau-amortissement-detail" className="mt-3 overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-xl print:hidden">
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="p-2 text-left border-b border-slate-200">Mois</th>
                <th className="p-2 text-right border-b border-slate-200">Mensualité</th>
                <th className="p-2 text-right border-b border-slate-200">Intérêts</th>
                <th className="p-2 text-right border-b border-slate-200">Capital</th>
                <th className="p-2 text-right border-b border-slate-200">Capital restant dû</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.mois} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2 text-slate-600">{l.mois}</td>
                  <td className="p-2 text-right font-semibold text-slate-800">{formatDH(l.mensualite)}</td>
                  <td className="p-2 text-right text-rose-600">{formatDH(l.interets)}</td>
                  <td className="p-2 text-right text-emerald-700">{formatDH(l.capital)}</td>
                  <td className="p-2 text-right text-slate-500">{formatDH(l.capitalRestantDu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
