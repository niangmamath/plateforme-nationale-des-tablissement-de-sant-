import { Pool } from 'pg';

// Une seule instance par instance de fonction serverless "chaude" (réutilisée entre invocations).
let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
    // Même raison que server/db.ts : sans listener, une déconnexion d'un client idle
    // fait planter l'instance de fonction serverless au lieu de simplement logguer.
    pool.on('error', (err) => {
      console.error('Erreur inattendue sur un client pg idle du pool :', err);
    });
  }
  return pool;
}
