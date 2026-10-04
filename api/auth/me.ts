import type { VercelRequest, VercelResponse } from '@vercel/node';
import { utilisateurDepuisCookies } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const utilisateur = utilisateurDepuisCookies(req.headers.cookie);
  if (!utilisateur) {
    res.status(401).json({ error: 'Non connecté.' });
    return;
  }
  res.status(200).json(utilisateur);
}
