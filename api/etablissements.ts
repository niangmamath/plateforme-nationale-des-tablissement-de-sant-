import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from './_lib/db';
import { getEtablissements } from '../server/queries';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const rows = await getEtablissements(getPool());
  res.status(200).json(rows);
}
