// Rate limiting en base — partagé entre toutes les instances serverless Vercel. Le RateLimit
// in-memory de rateLimit.ts se perd au cold-start d'une λ : un attaquant qui bombe l'API finit
// par tomber sur une instance "neuve" dont le Map est vide. Ici on écrit en DB : vérité partagée.
//
// Format : une ligne par (admin_id, route, minute). INSERT ... ON CONFLICT DO UPDATE RETURNING
// count = un seul round-trip. Lazy GC : on efface les lignes de plus d'une heure quand on écrit.
//
// Limites recommandées (par admin, par minute) :
// - lecture générale (/stats, /signalements GET, /messages GET)   : 120 (navigation + polling 5s)
// - écriture légère (/messages POST, /messages/lu)                 : 30
// - écriture lourde (/signalements PATCH, /signalements/.../repondre, /password) : 10

import type { Pool } from 'pg';

export interface ResultatRateLimit {
  autorise: boolean;
  retryAfterSec: number; // 0 si autorisé
  compteur: number;      // nombre d'appels dans la fenêtre courante
  seuil: number;
}

export async function verifierRateLimitAdmin(
  pool: Pool,
  adminId: number,
  route: string,
  seuilParMinute: number,
): Promise<ResultatRateLimit> {
  // Fenêtre d'une minute, arrondie DANS Postgres pour éviter tout décalage d'horloge entre serveur
  // Node et DB (compte à la seconde près : la fenêtre doit être la MÊME pour tous les callers).
  const { rows } = await pool.query<{ nouveau_count: number; window_end: string }>(
    `WITH upsert AS (
       INSERT INTO admin_rate_limits (admin_id, route, window_start, count)
       VALUES ($1, $2, date_trunc('minute', now()), 1)
       ON CONFLICT (admin_id, route, window_start)
       DO UPDATE SET count = admin_rate_limits.count + 1
       RETURNING count AS nouveau_count,
                 (admin_rate_limits.window_start + interval '1 minute')::text AS window_end
     )
     SELECT * FROM upsert`,
    [adminId, route],
  );

  const compteur = rows[0].nouveau_count;
  const autorise = compteur <= seuilParMinute;

  // Secondes jusqu'à la fin de la fenêtre, pour le header Retry-After.
  const windowEnd = new Date(rows[0].window_end);
  const retryAfterSec = autorise ? 0 : Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000));

  // Lazy GC : purge probabiliste pour ne pas que la table enfle. 1 chance sur 100 par appel.
  if (Math.random() < 0.01) {
    pool.query(
      `DELETE FROM admin_rate_limits WHERE window_start < now() - interval '1 hour'`,
    ).catch(err => console.warn('[admin] GC admin_rate_limits échoué :', err?.message));
  }

  return { autorise, retryAfterSec, compteur, seuil: seuilParMinute };
}
