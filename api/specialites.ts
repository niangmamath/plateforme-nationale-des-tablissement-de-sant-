import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db.js';
import { getSpecialites } from '../server/queries.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const rows = await getSpecialites(getPool());
  res.status(200).json(rows);
}
