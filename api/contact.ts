import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envoyerContact, ErreurContact } from '../server/contact.js';
import { ipDeRequete } from '../server/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }
  try {
    const ip = ipDeRequete(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
    await envoyerContact(req.body, ip);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    if (err instanceof ErreurContact) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/contact :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
