import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db.js';
import { enregistrerSignalement, extraireIp, ErreurSignalement } from '../server/signalements.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  try {
    await enregistrerSignalement(getPool(), req.body, extraireIp(req.headers['x-forwarded-for']));
    res.status(201).json({ ok: true });
  } catch (err: any) {
    if (err instanceof ErreurSignalement) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/signalements :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
