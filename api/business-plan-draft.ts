import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db.js';
import { utilisateurDepuisCookies } from '../server/auth.js';
import { sauvegarderBrouillon, recupererBrouillon, ErreurBrouillon } from '../server/businessPlanDrafts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const utilisateur = utilisateurDepuisCookies(req.headers.cookie);
  if (!utilisateur) {
    res.status(401).json({ error: 'Non connecté.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const { zoneId, specialiteId } = req.query;
      const brouillon = await recupererBrouillon(getPool(), utilisateur.id, zoneId, specialiteId);
      res.status(200).json(brouillon);
      return;
    }

    if (req.method === 'POST') {
      const { zoneId, specialiteId, data } = req.body ?? {};
      await sauvegarderBrouillon(getPool(), utilisateur.id, zoneId, specialiteId, data);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (err: any) {
    if (err instanceof ErreurBrouillon) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/business-plan-draft :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
