/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';
import { calculerRecapCredit } from '../utils/projectionBP';
import { formatDH } from './TableauAmortissementCredit';

// Reproduction du simulateur "Al Moukawil Chaabi" (Banque Populaire) —
// https://www.almoukawilchaabi.ma/MoukawilChaabi/fr/simulateurs — indépendante de notre propre
// SimulateurCredit : 3 produits de financement réels à taux fixe pour créateurs d'entreprise au
// Maroc, chacun avec son propre taux et ses propres bornes de montant/différé/durée.
//
// Modélisation du différé : leur site affiche une seule mensualité malgré un champ "Différé" — en
// recalculant avec un différé total à intérêts simples (capitalisés une fois, sans effet boule de
// neige — cf. le commentaire sur TypeDiffere dans projectionBP.ts) et amortissement sur durée −
// différé, on reproduit leur valeur affichée au centime près (100 000 DH, 2 %, différé 24 mois,
// durée 84 mois → 1 822,89 DH, identique).
//
// Volontairement absent : leur bouton "Demander ce crédit" (collecte de coordonnées pour la
// banque) — nous ne sommes pas la banque et ne pouvons pas traiter une demande de prêt, le
// reproduire serait trompeur.
interface ProduitChaabi {
  id: string;
  nom: string;
  tauxPct: number;
  montantDefaut: number;
  montantMin: number;
  montantMax: number;
  differeDefaut: number; // mois
  differeMin: number;
  differeMax: number;
  dureeDefaut: number; // mois, différé inclus
  dureeMin: number;
  dureeMax: number;
}

const PRODUITS: ProduitChaabi[] = [
  { id: 'INTELAK_INVEST', nom: 'Intelak Invest', tauxPct: 2, montantDefaut: 100000, montantMin: 5000, montantMax: 1200000, differeDefaut: 24, differeMin: 12, differeMax: 60, dureeDefaut: 84, dureeMin: 12, dureeMax: 114 },
  { id: 'INTELAK_AL_QARAOUI', nom: 'Intelak Al Qarawi Invest', tauxPct: 1.75, montantDefaut: 100000, montantMin: 5000, montantMax: 1200000, differeDefaut: 24, differeMin: 12, differeMax: 60, dureeDefaut: 84, dureeMin: 12, dureeMax: 114 },
  { id: 'BP_START_UP', nom: 'BP Start-Up', tauxPct: 5, montantDefaut: 100000, montantMin: 5000, montantMax: 1200000, differeDefaut: 36, differeMin: 12, differeMax: 60, dureeDefaut: 84, dureeMin: 12, dureeMax: 114 },
];

export default function SimulateurChaabiIntelak() {
  const [produitId, setProduitId] = useState(PRODUITS[0].id);
  const produit = PRODUITS.find((p) => p.id === produitId)!;

  const [montant, setMontant] = useState(produit.montantDefaut);
  const [differeMois, setDiffereMois] = useState(produit.differeDefaut);
  const [dureeMois, setDureeMois] = useState(produit.dureeDefaut);

  const choisirProduit = (p: ProduitChaabi) => {
    setProduitId(p.id);
    setMontant(p.montantDefaut);
    setDiffereMois(p.differeDefaut);
    setDureeMois(p.dureeDefaut);
  };

  const differeEff = Math.min(differeMois, Math.max(0, dureeMois - 1));
  const recap = useMemo(
    () => calculerRecapCredit(montant, produit.tauxPct, dureeMois / 12, differeEff, 'interetCapital'),
    [montant, produit.tauxPct, dureeMois, differeEff]
  );
  const dureeAns = Math.round((dureeMois / 12) * 10) / 10;

  return (
    <section className="mt-8 bg-white rounded-3xl p-5 md:p-8 shadow-2xl border border-slate-200">
      <div className="text-center max-w-2xl mx-auto mb-6">
        <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-4">
          <Landmark className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-2 text-slate-900">Offres de Financement Intelak</h2>
        <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed">
          Simulation indicative, pas un simulateur officiel de la banque.
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {PRODUITS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choisirProduit(p)}
              aria-pressed={p.id === produitId}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
                p.id === produitId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.nom}
            </button>
          ))}
        </div>

        <div className="text-center mb-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-black text-blue-800">
            Taux fixe {produit.tauxPct.toString().replace('.', ',')} %/an
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Paramètres */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6">
            <div className="grid grid-cols-1 gap-5">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <span>Montant</span>
                  <span className="text-slate-900">{formatDH(montant)}</span>
                </div>
                <input
                  type="range"
                  min={produit.montantMin}
                  max={produit.montantMax}
                  step={1000}
                  value={montant}
                  onChange={(e) => setMontant(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{formatDH(produit.montantMin)}</span>
                  <span>{formatDH(produit.montantMax)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <span>Différé</span>
                  <span className="text-slate-900">{differeMois} Mois</span>
                </div>
                <input
                  type="range"
                  min={produit.differeMin}
                  max={produit.differeMax}
                  step={1}
                  value={differeMois}
                  onChange={(e) => setDiffereMois(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{produit.differeMin} Mois</span>
                  <span>{produit.differeMax} Mois</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <span>Durée</span>
                  <span className="text-slate-900">{dureeMois} Mois</span>
                </div>
                <input
                  type="range"
                  min={produit.dureeMin}
                  max={produit.dureeMax}
                  step={1}
                  value={dureeMois}
                  onChange={(e) => setDureeMois(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{produit.dureeMin} Mois</span>
                  <span>{produit.dureeMax} Mois</span>
                </div>
              </div>
            </div>
          </div>

          {/* Récapitulatif */}
          <div className="bg-blue-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-black uppercase tracking-wider text-blue-100 mb-4">Récapitulatif</p>
            <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Paiement mensuel (hors assurance)</p>
            <p className="text-4xl font-black text-white mb-1">{formatDH(recap.mensualiteApres)}</p>
            <p className="text-xs text-blue-200">Pendant {dureeAns} ans{differeEff > 0 ? `, dont ${differeEff} mois de différé` : ''}</p>
          </div>
        </div>

        <p className="mt-6 text-[10px] text-slate-400 italic leading-relaxed text-center">
          Le résultat de cette simulation est donné à titre indicatif. Il ne constituera en aucun cas un engagement contractuel de la part de la Banque Populaire.
          Produits, taux et conditions inspirés de l'offre réelle de la Banque Populaire, à titre informatif et de comparaison — ceci n'est ni un outil officiel ni affilié à la banque ; vérifiez les conditions actuelles directement auprès d'elle avant toute décision.
        </p>
      </div>
    </section>
  );
}
