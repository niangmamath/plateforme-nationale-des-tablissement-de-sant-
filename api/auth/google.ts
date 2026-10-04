import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../_lib/db.js';
import { connecterAvecGoogle, creerJeton, cookieSession, ErreurAuth } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  try {
    const { idToken } = req.body ?? {};
    const utilisateur = await connecterAvecGoogle(getPool(), idToken);
    res.setHeader('Set-Cookie', cookieSession(creerJeton(utilisateur)));
    res.status(200).json(utilisateur);
  } catch (err: any) {
    if (err instanceof ErreurAuth) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/auth/google :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
