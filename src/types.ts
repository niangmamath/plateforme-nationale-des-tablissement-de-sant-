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