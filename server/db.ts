import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Sans ce listener, une déconnexion transitoire d'un client idle (perte réseau,
// redémarrage Docker/Supabase) fait planter tout le processus : Node relance
// l'événement 'error' du pool comme exception non gérée s'il n'a aucun listener.
pool.on('error', (err) => {
  console.error('Erreur inattendue sur un client pg idle du pool :', err);
});
