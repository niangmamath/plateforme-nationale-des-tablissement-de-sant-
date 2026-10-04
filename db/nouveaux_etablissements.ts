// Résumé des établissements ajoutés sur un mois donné (par ville, spécialité, source).
// Usage : npx tsx db/nouveaux_etablissements.ts 2026-09
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const mois = process.argv[2];
  if (!mois || !/^\d{4}-\d{2}$/.test(mois)) {
    console.error('Usage : npx tsx db/nouveaux_etablissements.ts AAAA-MM (ex: 2026-09)');
    process.exit(1);
  }
  const debut = `${mois}-01`;

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const total = await client.query(
    `SELECT count(*) FROM etablissements WHERE date_created >= $1::date AND date_created < ($1::date + interval '1 month')`,
    [debut]
  );
  console.log(`TOTAL ${mois} :`, total.rows[0].count);

  const parVille = await client.query(
    `SELECT ville, count(*) AS n FROM etablissements
     WHERE date_created >= $1::date AND date_created < ($1::date + interval '1 month')
     GROUP BY ville ORDER BY n DESC`,
    [debut]
  );
  console.log('\n--- Par ville ---');
  parVille.rows.forEach((r) => console.log(r.ville, ':', r.n));

  const parCat = await client.query(
    `SELECT categorie, count(*) AS n FROM etablissements
     WHERE date_created >= $1::date AND date_created < ($1::date + interval '1 month')
     GROUP BY categorie ORDER BY n DESC`,
    [debut]
  );
  console.log('\n--- Par catégorie ---');
  parCat.rows.forEach((r) => console.log(r.categorie, ':', r.n));

  const parSource = await client.query(
    `SELECT source, count(*) AS n FROM etablissements
     WHERE date_created >= $1::date AND date_created < ($1::date + interval '1 month')
     GROUP BY source ORDER BY n DESC`,
    [debut]
  );
  console.log('\n--- Par source ---');
  parSource.rows.forEach((r) => console.log(r.source, ':', r.n));

  await client.end();
}

main().catch((e) => {
  console.error('ERREUR', e.message);
  process.exit(1);
});
