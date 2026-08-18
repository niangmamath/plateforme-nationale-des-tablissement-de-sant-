import 'dotenv/config';
import { pool } from '../db';
import { extraireEtInserer } from '../extraction';
import { scraperEtInserer } from './orchestrateur';
import { VILLE_SLUGS, CATEGORIE_SLUGS, VILLES_CIBLES, CATEGORIES_CIBLES } from './config';

// Lance, pour une seule combinaison ville/catégorie passée en arguments CLI
// (`tsx run-cible.ts "Casablanca" "Ophtalmologie"`), Google Maps PUIS le scraping externe —
// utilisé par le workflow GitHub Actions pour un déclenchement ciblé (Flow Directus) sans devoir
// rejouer les 42 combinaisons à chaque fois. Google en premier n'est qu'une convention : les deux
// pipelines rechargent l'état actuel de la base à leur propre appel et appliquent le même scoring
// nom/adresse/GPS contre l'existant, donc l'ordre n'affecte pas la justesse du dédoublonnage.
async function main() {
  const [ville, categorie] = process.argv.slice(2);

  if (!ville || !categorie) {
    console.error('Usage : tsx run-cible.ts "<Ville>" "<Catégorie>"');
    process.exit(1);
  }
  if (!VILLES_CIBLES.includes(ville)) {
    console.error(`Ville inconnue : "${ville}". Villes valides : ${VILLES_CIBLES.join(', ')}`);
    process.exit(1);
  }
  const sources = CATEGORIE_SLUGS[categorie];
  if (!sources) {
    console.error(`Catégorie inconnue ou non couverte par le scraping externe : "${categorie}". Catégories valides : ${CATEGORIES_CIBLES.join(', ')}`);
    process.exit(1);
  }

  console.log(`\n### Google Maps — ${categorie}/${ville} ###`);
  const resumeGoogle = await extraireEtInserer(pool, categorie, 'Maroc', ville);
  console.log('Résumé Google Maps :', resumeGoogle);

  console.log(`\n### Scraping externe — ${categorie}/${ville} ###`);
  const resumeScraping = await scraperEtInserer(pool, {
    categorie,
    pays: 'Maroc',
    ville,
    villeSlug: VILLE_SLUGS[ville],
    sources,
  });
  console.log('Résumé scraping externe :', resumeScraping);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
