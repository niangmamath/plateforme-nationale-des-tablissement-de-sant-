import 'dotenv/config';
import { Client } from 'pg';
import { recupererHCP } from '../server/demographie';

// Relit chez HCP (RGPH 2024) la population et les trois tranches d'âge de chaque zone. Sans
// --apply, affiche seulement les écarts avec la base. Une zone que HCP ne renvoie pas est laissée
// telle quelle et signalée : aucune valeur n'est jamais estimée.
const appliquer = process.argv.includes('--apply');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows: zones } = await client.query(
    `SELECT z.id, z.nom, v.nom AS ville, z.population, z.pop0_14, z.pop15_59, z.pop60_plus
     FROM zones z JOIN villes v ON v.id = z.ville_id ORDER BY v.nom, z.nom`
  );

  let modifiees = 0;
  const introuvables: string[] = [];
  const incoherentes: string[] = [];
  for (const z of zones) {
    const h = await recupererHCP(z.ville, z.nom);
    if (h.population == null || h.pop0_14 == null || h.pop15_59 == null || h.pop60_plus == null) {
      introuvables.push(`${z.ville}/${z.nom}`);
      continue;
    }
    const somme = h.pop0_14 + h.pop15_59 + h.pop60_plus;
    if (Math.abs(somme - 100) > 0.5) {
      incoherentes.push(`${z.ville}/${z.nom} (somme ${somme.toFixed(1)})`);
      continue;
    }
    const ecart = (a: unknown, b: number) => a == null || Math.abs(Number(a) - b) > 0.05;
    const change = ecart(z.pop0_14, h.pop0_14) || ecart(z.pop15_59, h.pop15_59) || ecart(z.pop60_plus, h.pop60_plus) || Number(z.population) !== h.population;
    if (!change) continue;
    modifiees++;
    console.log(`${z.ville}/${z.nom}: pop ${z.population}→${h.population} | <15 ${z.pop0_14}→${h.pop0_14} | 15-59 ${z.pop15_59}→${h.pop15_59} | 60+ ${z.pop60_plus}→${h.pop60_plus}`);
    if (appliquer) {
      await client.query('UPDATE zones SET population = $2, pop0_14 = $3, pop15_59 = $4, pop60_plus = $5 WHERE id = $1', [z.id, h.population, h.pop0_14, h.pop15_59, h.pop60_plus]);
    }
  }
  console.log(`\n${zones.length} zones, ${modifiees} ${appliquer ? 'mises à jour' : 'à mettre à jour (dry-run)'}`);
  if (introuvables.length) console.log('Introuvables chez HCP :', introuvables.join(' ; '));
  if (incoherentes.length) console.log('Ignorées (parts ≠ 100 %) :', incoherentes.join(' ; '));
  await client.end();
}
main();
