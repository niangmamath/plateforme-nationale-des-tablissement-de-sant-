/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSyncExternalStore } from 'react';
import { Etablissement } from '../types';
import SignalementModal from './SignalementModal';

// L'état "quel formulaire est ouvert" vit ICI, pas dans App : App porte tout l'état de la page
// (filtres, sélection, ~9 400 fiches passées à la liste, à la carte, aux stats...), donc y mettre
// un useState faisait refaire le rendu de toute la page à l'ouverture et à la fermeture du
// formulaire — mesuré ~450 ms de fil principal bloqué avant que la modale n'apparaisse.
type Etat = { mode: 'correction' | 'absence'; etablissement?: Etablissement } | null;

let courant: Etat = null;
const ecouteurs = new Set<() => void>();
const notifier = () => ecouteurs.forEach((l) => l());
const abonner = (l: () => void) => {
  ecouteurs.add(l);
  return () => { ecouteurs.delete(l); };
};

export function signalerCorrection(etablissement: Etablissement) {
  courant = { mode: 'correction', etablissement };
  notifier();
}

export function signalerAbsence() {
  courant = { mode: 'absence' };
  notifier();
}

function fermer() {
  courant = null;
  notifier();
}

export default function SignalementHost() {
  const etat = useSyncExternalStore(abonner, () => courant);
  if (!etat) return null;
  return <SignalementModal mode={etat.mode} etablissement={etat.etablissement} onClose={fermer} />;
}
