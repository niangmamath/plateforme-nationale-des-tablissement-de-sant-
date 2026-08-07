/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Rendu visuel partagé pour une spécialité (KPI, carte, panneau de résultats), dérivé des champs
// "icone"/"couleur" de la table specialites — une seule source de vérité pour ne plus avoir à
// coder en dur une liste fermée de spécialités dans chaque composant qui les affiche.

import { Stethoscope, Eye, Building2, HeartPulse, Brain, Activity, Bone, Syringe, Microscope, HelpCircle, type LucideIcon } from 'lucide-react';

export const ICONES: Record<string, LucideIcon> = { Stethoscope, Eye, Building2, HeartPulse, Brain, Activity, Bone, Syringe, Microscope };
export const ICONE_DEFAUT: LucideIcon = HelpCircle;

// Couleur hexadécimale par valeur du champ "couleur" — utilisée pour les marqueurs Leaflet
// (style inline, pas de classes Tailwind possibles dans le HTML généré pour la carte).
export const HEX_PAR_COULEUR: Record<string, string> = {
  blue: '#2563eb',
  emerald: '#059669',
  purple: '#9333ea',
  rose: '#e11d48',
  amber: '#d97706',
  cyan: '#0891b2',
};
export const HEX_DEFAUT = '#475569'; // gris (catégories sans spécialité correspondante, ex. Cabinet Médical)

// Chemins SVG (viewBox 24x24, style lucide) par valeur du champ "icone" — pour les marqueurs
// Leaflet, qui ont besoin d'un fragment SVG brut plutôt que d'un composant React.
export const SVG_PAR_ICONE: Record<string, string> = {
  Stethoscope: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  Eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/>',
  Building2: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
  HeartPulse: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/><path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  Brain: '<path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>',
  Activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  Bone: '<path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"/>',
  Syringe: '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
  Microscope: '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
};
export const SVG_DEFAUT = '<circle cx="12" cy="12" r="10"/>';

// Classes Tailwind complètes par couleur — écrites en toutes lettres pour que le scanner
// Tailwind les détecte à la compilation même si le choix se fait dynamiquement à l'exécution.
export const BADGE_PAR_COULEUR: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
};
export const BADGE_DEFAUT = { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' };

export const KPI_TEXTE_PAR_COULEUR: Record<string, string> = {
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  purple: 'text-purple-600',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
  cyan: 'text-cyan-600',
};
export const KPI_ICONE_PAR_COULEUR: Record<string, string> = {
  blue: 'text-blue-500',
  emerald: 'text-emerald-500',
  purple: 'text-purple-500',
  rose: 'text-rose-500',
  amber: 'text-amber-500',
  cyan: 'text-cyan-500',
};
