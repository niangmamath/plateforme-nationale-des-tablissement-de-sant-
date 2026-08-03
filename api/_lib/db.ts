import { Pool } from 'pg';

// Une seule instance par instance de fonction serverless "chaude" (réutilisée entre invocations).
let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  }
  return pool;
}
