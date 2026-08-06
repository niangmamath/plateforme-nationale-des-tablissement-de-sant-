import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../_lib/db.js';
import { extraireEtInsererZone } from '../../server/demographie.js';

// Déclenché par le Flow Directus (formulaire pays/ville/zone) — récupère population, pop15-59,
// pop60+, densité (HCP + OpenStreetMap) et prix_m2 (Yakeey) pour une nouvelle zone, crée la
// ville si besoin, refuse une zone déjà enregistrée, et insère en statut "brouillon".
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const secret = process.env.ADMIN_EXTRACTION_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    res.status(401).json({ error: 'Non autorisé.' });
    return;
  }

  const { pays, ville, zone } = req.body ?? {};
  if (!pays || !ville || !zone) {
    res.status(400).json({ error: 'Paramètres requis : pays, ville, zone.' });
    return;
  }

  try {
    const resultat = await extraireEtInsererZone(getPool(), pays, ville, zone);
    res.status(200).json(resultat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
