import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db.js';
import { repondre, type MessageChat } from '../server/chat.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY n'est pas configurée côté serveur." });
    return;
  }

  const { messages } = (req.body ?? {}) as { messages?: MessageChat[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Paramètre requis : messages (tableau non vide).' });
    return;
  }

  try {
    const text = await repondre(getPool(), apiKey, messages);
    res.status(200).json({ text });
  } catch (err: any) {
    console.error('Erreur /api/chat :', err);
    res.status(500).json({ error: err.message ?? 'Erreur inconnue.' });
  }
}
