import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../_lib/db.js';
import { inscrire, creerJeton, cookieSession, ErreurAuth } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  try {
    const { email, password } = req.body ?? {};
    const utilisateur = await inscrire(getPool(), email, password);
    res.setHeader('Set-Cookie', cookieSession(creerJeton(utilisateur)));
    res.status(201).json(utilisateur);
  } catch (err: any) {
    if (err instanceof ErreurAuth) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/auth/signup :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
