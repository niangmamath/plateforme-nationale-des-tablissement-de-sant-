import 'dotenv/config';
import { pool } from '../db';
import { extraireEtInserer } from '../extraction';
import { scraperEtInserer } from './orchestrateur';
import { VILLE_SLUGS, CATEGORIE_SLUGS } from './config';

// Lance, pour une seule combinaison ville/catégorie passée en arguments CLI
// (`tsx run-cible.ts "Casablanca" "Ophtalmologie"`), Google Maps PUIS le scraping externe —
// utilisé par le workflow GitHub Actions pour un déclenchement ciblé (Flow Directus) sans devoir
// rejouer les 42 combinaisons à chaque fois. Google en premier n'est qu'une convention : les deux
// pipelines rechargent l'état actuel de la base à leur propre appel et appliquent le même scoring
// nom/adresse/GPS contre l'existant, donc l'ordre n'affecte pas la justesse du dédoublonnage.
//
// Les deux étapes sont indépendantes : Google Maps marche pour n'importe quelle ville/catégorie
// ayant une config `specialites` publiée + des zones publiées (voir extraireEtInserer, qui valide
// et explique lui-même le problème sinon) — server/scraping/config.ts, en revanche, ne couvre que
// les 6 villes × 7 catégories dont les slugs par site ont été vérifiés manuellement (voir
// conversation). Une ville/catégorie hors de cette liste doit donc toujours bénéficier de
// l'extraction Google Maps ; seul le scraping externe est alors sauté, pas toute la commande.
async function main() {
  const [ville, categorie] = process.argv.slice(2);

  if (!ville || !categorie) {
    console.error('Usage : tsx run-cible.ts "<Ville>" "<Catégorie>"');
    process.exit(1);
  }

  console.log(`\n### Google Maps — ${categorie}/${ville} ###`);
  const resumeGoogle = await extraireEtInserer(pool, categorie, 'Maroc', ville);
  console.log('Résumé Google Maps :', resumeGoogle);

  const sources = CATEGORIE_SLUGS[categorie];
  const villeSlug = VILLE_SLUGS[ville];
  if (!sources || !villeSlug) {
    console.log(`\n### Scraping externe — sauté ###\nAucune source de scraping externe vérifiée pour "${categorie}"/"${ville}" (couverture actuelle : ${Object.keys(CATEGORIE_SLUGS).join(', ')} × ${Object.keys(VILLE_SLUGS).join(', ')}). Seul Google Maps a tourné.`);
  } else {
    console.log(`\n### Scraping externe — ${categorie}/${ville} ###`);
    const resumeScraping = await scraperEtInserer(pool, { categorie, pays: 'Maroc', ville, villeSlug, sources });
    console.log('Résumé scraping externe :', resumeScraping);
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
