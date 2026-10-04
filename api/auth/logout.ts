import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cookieDeconnexion } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }
  res.setHeader('Set-Cookie', cookieDeconnexion());
  res.status(200).json({ ok: true });
}
