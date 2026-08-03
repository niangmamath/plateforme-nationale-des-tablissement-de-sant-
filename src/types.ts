/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Etablissement {
  id: string;
  nom: string;
  categorie: string;
  ville: string;
  quartier: string;
  arrondissement?: string;
  adresse: string;
  latitude: number;
  longitude: number;
  source: string;
  placeId: string;
}

export type MapStyle = 'google-streets' | 'google-hybrid' | 'light-carto' | 'dark-carto' | 'satellite';

export interface FilterState {
  search: string;
  ville: string;
  quartier: string;
  categorie: string;
  source: string;
}

export interface KpiData {
  totalEtablissements: number;
  totalVilles: number;
  totalQuartiers: number;
  totalCliniques: number;
  totalOphtalmologues: number;
  totalDermatologues: number;
  totalCabinets: number;
}

// =========================================================
// --- HIERARCHIE GÉOGRAPHIQUE SCALABLE (NOUVEAU) ---
// =========================================================

export interface ZoneGeo {
  id: string;
  nom: string;
  lat: number;         // Pour la carte interactive
  lng: number;         // Pour la carte interactive
  population: number;
  prixM2: number;      // Indice à l'achat (utilisé par la carte / le module de scoring)
  loyerM2: number;     // Indice à la location
  pop15_59?: number | null;
  pop60_plus?: number | null;
  densite?: number | null;
}

export interface VilleGeo {
  id: string;
  nom: string;
  lat: number;         // Centre de la ville
  lng: number;         // Centre de la ville
  zoomBase: number;    // Zoom de la carte par défaut
  zones: ZoneGeo[];
}

export interface PaysGeo {
  id: string;
  nom: string;
  devise: string;      // Ex: "DH", "FCFA", "€"
  villes: VilleGeo[];
}