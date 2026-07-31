import { MAROC } from './locations/maroc';
import { PaysGeo } from '../types';

// La liste globale qui alimentera automatiquement ton futur sélecteur en haut
export const AVAILABLE_COUNTRIES: PaysGeo[] = [
  MAROC,
  // Demain, tu pourras ajouter ici : SENEGAL, COTE_D_IVOIRE, etc.
];