import type { Pool } from 'pg';

export class ErreurBrouillon extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TAILLE_MAX_OCTETS = 2 * 1024 * 1024; // 2 Mo — large marge au-delà d'un brouillon réel (texte + tableaux, pas d'images), garde-fou contre un payload aberrant.

export async function sauvegarderBrouillon(
  pool: Pool,
  userId: number,
  zoneId: unknown,
  specialiteId: unknown,
  data: unknown
): Promise<void> {
  if (typeof zoneId !== 'string' || !zoneId) throw new ErreurBrouillon(400, 'Paramètre requis : zoneId.');
  if (typeof specialiteId !== 'string' || !specialiteId) throw new ErreurBrouillon(400, 'Paramètre requis : specialiteId.');
  if (typeof data !== 'object' || data === null) throw new ErreurBrouillon(400, 'Paramètre requis : data (objet).');

  const serialise = JSON.stringify(data);
  if (Buffer.byteLength(serialise, 'utf8') > TAILLE_MAX_OCTETS) {
    throw new ErreurBrouillon(413, 'Brouillon trop volumineux.');
  }

  try {
    await pool.query(
      `INSERT INTO business_plan_drafts (user_id, zone_id, specialite_id, data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (user_id, zone_id, specialite_id)
       DO UPDATE SET data = EXCLUDED.data`,
      [userId, zoneId, specialiteId, serialise]
    );
  } catch (err: any) {
    // Clé étrangère violée (zone_id / specialite_id inconnus) -> entrée invalide, pas une panne serveur.
    if (err.code === '23503') throw new ErreurBrouillon(400, 'Zone ou spécialité inconnue.');
    throw err;
  }
}

export async function recupererBrouillon(
  pool: Pool,
  userId: number,
  zoneId: unknown,
  specialiteId: unknown
): Promise<{ data: unknown; dateMaj: string } | null> {
  if (typeof zoneId !== 'string' || !zoneId) throw new ErreurBrouillon(400, 'Paramètre requis : zoneId.');
  if (typeof specialiteId !== 'string' || !specialiteId) throw new ErreurBrouillon(400, 'Paramètre requis : specialiteId.');

  const { rows } = await pool.query<{ data: unknown; date_maj: string }>(
    'SELECT data, date_maj FROM business_plan_drafts WHERE user_id = $1 AND zone_id = $2 AND specialite_id = $3',
    [userId, zoneId, specialiteId]
  );
  if (rows.length === 0) return null;
  return { data: rows[0].data, dateMaj: rows[0].date_maj };
}
