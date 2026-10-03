/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { calculerRecapCredit, type TypeDiffere } from '../utils/projectionBP';

// L'espace fine insécable (U+202F) que produit fr-FR pour les milliers est absente de la police du
// site ("1824 00" sans séparateur visible) : on la remplace par l'espace insécable ordinaire
// (U+00A0), même correctif que dans BusinessPlanGenerator/projectionBP. Décimales conservées (pas
// d'arrondi à l'entier) pour pouvoir comparer nos chiffres au centime près à ceux d'une banque.
export const formatDH = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ') + ' DH';

export const LIBELLE_DIFFERE: Record<Exclude<TypeDiffere, 'aucun'>, string> = {
  capital: 'intérêts seuls payés',
  interet: 'capital seul payé, intérêts capitalisés',
  interetCapital: 'rien payé, intérêts capitalisés',
};

interface TableauAmortissementCreditProps {
  montant: number;
  tauxPct: number;
  dureeAnnees: number;
  /** Durée du différé en mois, incluse dans dureeAnnees (ex. 7 ans dont 24 mois de différé). */
  dureeDiffereMois?: number;
  typeDiffere?: TypeDiffere;
  /** Replié par défaut (usage dans le business plan) ; déplié par défaut sur la page autonome. */
  reploiParDefaut?: boolean;
  /** Titre du résumé, adapté au contexte où le composant est posé. */
  titre?: string;
  /** Masque les cartes de résumé (mensualité/coût/total) : pour les pages qui affichent déjà leur
   *  propre bandeau récapitulatif et ne veulent que le tableau détaillé en dessous. */
  masquerRecap?: boolean;
}

// Résultat d'un crédit (mensualité, coût total, tableau mois par mois) — calcul pur dans
// utils/projectionBP.ts, ce composant n'est que l'affichage. Utilisé à la fois par la page
// autonome "Simulateur de crédit" (avec ses propres champs de saisie autour) et par le business
// plan (en lecture seule, à partir du crédit déjà calculé dans le plan de financement) : les deux
// usages restent indépendants, sans synchronisation entre eux.
export default function TableauAmortissementCredit({
  montant,
  tauxPct,
  dureeAnnees,
  dureeDiffereMois = 0,
  typeDiffere = 'aucun',
  reploiParDefaut = true,
  titre = 'Détail mois par mois',
  masquerRecap = false,
}: TableauAmortissementCreditProps) {
  const [ouvert, setOuvert] = useState(!reploiParDefaut);
  const recap = useMemo(
    () => calculerRecapCredit(montant, tauxPct, dureeAnnees, dureeDiffereMois, typeDiffere),
    [montant, tauxPct, dureeAnnees, dureeDiffereMois, typeDiffere]
  );
  const { lignes, nbDiffere, mensualiteDiffere, mensualiteApres, coutTotalCredit, totalRembourse } = recap;
  // Id unique par instance (le composant est monté à deux endroits qui peuvent coexister : page
  // autonome + business plan ouvert par-dessus), pour garder aria-controls valide pour chacune.
  const idBase = useId();
  const idDetail = `${idBase}-detail`;

  if (montant <= 0 || dureeAnnees <= 0) {
    return <p className="text-sm text-slate-500 italic">Renseignez un montant et une durée pour calculer l'échéancier.</p>;
  }

  return (
    <div>
      {!masquerRecap && (
        <div className={`grid grid-cols-1 ${nbDiffere > 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 mb-4`}>
          {nbDiffere > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Pendant le différé ({nbDiffere} mois)</p>
              <p data-champ="mensualite-differe" className="text-lg font-black text-amber-900">{formatDH(mensualiteDiffere ?? 0)}</p>
              <p className="text-[10px] text-amber-700 mt-0.5">{LIBELLE_DIFFERE[typeDiffere as Exclude<TypeDiffere, 'aucun'>]}</p>
            </div>
          )}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">{nbDiffere > 0 ? 'Mensualité après différé' : 'Mensualité'}</p>
            <p data-champ="mensualite" className="text-lg font-black text-blue-900">{formatDH(mensualiteApres)}</p>
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
      )}

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
                <tr key={l.mois} className={`border-b border-slate-100 hover:bg-slate-50 ${l.mois <= nbDiffere ? 'bg-amber-50/40' : ''}`}>
                  <td className="p-2 text-slate-600">{l.mois}{l.mois <= nbDiffere ? ' (différé)' : ''}</td>
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
