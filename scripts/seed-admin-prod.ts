// Seed one-shot des 2 comptes fondateurs du dashboard admin.
//
// Pourquoi ce script existe : en prod, l'API /api/* est servie par les fonctions serverless Vercel,
// pas par server/index.ts (qui n'y tourne pas, voir memory/project_render_directus_uniquement).
// Les fonctions serverless ne font pas de boot (chaque invocation est froide puis meurt), donc le
// seedFondateurs() appelé dans server/index.ts au app.listen ne s'exécute jamais en prod. Résultat :
// sans ce script, la table admin_users resterait vide en prod et le login dashboard échouerait.
//
// Idempotent : si les comptes existent déjà avec leur hash, aucune écriture (ON CONFLICT dans
// seedFondateurs). Tu peux donc le relancer sans risque, par ex. si tu changes les mdp.
//
// Comment l'exécuter :
//   Pointé sur la PROD Supabase (ce que tu veux faire après chaque rotation de mdp) :
//     DATABASE_URL=$(grep '^SUPABASE_DATABASE_URL=' .env | cut -d'=' -f2- | sed 's/^"//;s/"$//') \
//       npx tsx scripts/seed-admin-prod.ts
//
//   Pointé sur la base locale (dev) :
//     npx tsx scripts/seed-admin-prod.ts
//
// Attention : les mots de passe en clair sont lus depuis les variables d'env (ADMIN_FOUNDER_PASSWORD_1
// et _2 dans ton .env local). Ils ne sont jamais écrits en base — seul le hash bcrypt est persisté.

import 'dotenv/config';
import { Pool } from 'pg';
import { seedFondateurs } from '../server/adminAuth';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ÉCHEC : DATABASE_URL non définie.');
    process.exit(1);
  }

  // Garde-fou : afficher clairement sur quelle base on va écrire, pour éviter de pointer la prod
  // en pensant être en local (ou l'inverse). On n'imprime pas l'URL complète (contient le mot de
  // passe), juste l'hôte.
  try {
    const u = new URL(url);
    console.log(`[seed-admin-prod] cible : ${u.host}${u.pathname}`);
  } catch {
    console.log('[seed-admin-prod] cible : (URL non parsable)');
  }

  if (!process.env.ADMIN_FOUNDER_EMAILS) {
    console.error('ÉCHEC : ADMIN_FOUNDER_EMAILS non définie.');
    process.exit(1);
  }
  if (!process.env.ADMIN_FOUNDER_PASSWORD_1) {
    console.error('ÉCHEC : ADMIN_FOUNDER_PASSWORD_1 non définie.');
    process.exit(1);
  }
  if (!process.env.ADMIN_FOUNDER_PASSWORD_2) {
    console.error('ATTENTION : ADMIN_FOUNDER_PASSWORD_2 non définie — seul le 1er fondateur sera seedé.');
  }

  const pool = new Pool({ connectionString: url });
  try {
    await seedFondateurs(pool);
    console.log('[seed-admin-prod] terminé.');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[seed-admin-prod] erreur :', err);
  process.exit(1);
});
