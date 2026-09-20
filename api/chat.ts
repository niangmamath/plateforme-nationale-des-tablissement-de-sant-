import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db.js';
import { repondre, ErreurChat, type MessageChat } from '../server/chat.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const { messages } = (req.body ?? {}) as { messages?: MessageChat[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Paramètre requis : messages (tableau non vide).' });
    return;
  }

  try {
    const text = await repondre(getPool(), { openai: process.env.OPENAI_API_KEY, gemini: process.env.GEMINI_API_KEY }, messages);
    res.status(200).json({ text });
  } catch (err: any) {
    if (err instanceof ErreurChat) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Erreur /api/chat :', err);
    res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
