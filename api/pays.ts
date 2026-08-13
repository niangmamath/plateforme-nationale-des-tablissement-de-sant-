import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db.js';
import { getPays } from '../server/queries.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const rows = await getPays(getPool());
  // Données publiques, identiques pour tout le monde — mise en cache CDN pour éviter de
  // ré-exécuter la fonction (et de retaper Supabase) à chaque visite.
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).json(rows);
}
