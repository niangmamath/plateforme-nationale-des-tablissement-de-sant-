import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../_lib/db.js';
import { extraireEtInserer } from '../../server/extraction.js';

// Déclenché par le Flow Directus (formulaire pays/ville/spécialité) — extrait, nettoie,
// dédoublonne et insère les nouveaux établissements en statut "brouillon".
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

  const { pays, ville, specialite } = req.body ?? {};
  if (!pays || !ville || !specialite) {
    res.status(400).json({ error: 'Paramètres requis : pays, ville, specialite.' });
    return;
  }

  try {
    const resultat = await extraireEtInserer(getPool(), specialite, pays, ville);
    res.status(200).json(resultat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
