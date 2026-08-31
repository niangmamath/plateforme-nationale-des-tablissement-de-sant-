import 'dotenv/config';
import { Pool } from 'pg';
import { scraperEtInserer, type ScrapingSummary } from './orchestrateur';
import { VILLE_SLUGS, VILLES_CIBLES, MEDICALIS_CODE_VILLE, MEDICALIS_CATEGORIE_SLUGS } from './config';

// Scraping ciblé Medicalis.ma seul (aucune autre source) pour les catégories nouvellement
// configurées dans MEDICALIS_CATEGORIE_SLUGS — évite de re-scraper DabaDoc/Doctori/Télécontact/
// Google Maps déjà confirmés quasi épuisés pour ces spécialités lors des passages précédents.
const CATEGORIES = ['Endocrinologue', 'Gastro-entérologue', 'Gynécologue', 'Néphrologue', 'ORL', 'Oncologue', 'Pédiatre'];

const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL_SESSION });

async function main() {
  const resultats: { categorie: string; ville: string; scraping: ScrapingSummary | null; erreur?: string }[] = [];

  for (const ville of VILLES_CIBLES) {
    for (const categorie of CATEGORIES) {
      const medicalisCategorieSlug = MEDICALIS_CATEGORIE_SLUGS[categorie];
      const medicalisCodeVille = MEDICALIS_CODE_VILLE[ville];
      console.log(`\n########## ${categorie} / ${ville} (Medicalis.ma seul) ##########`);
      const resultat: { categorie: string; ville: string; scraping: ScrapingSummary | null; erreur?: string } = { categorie, ville, scraping: null };
      try {
        resultat.scraping = await scraperEtInserer(pool, {
          categorie,
          pays: 'Maroc',
          ville,
          villeSlug: VILLE_SLUGS[ville],
          sources: { dabadoc: null, doctori: null, telecontact: null, medma: null },
          medicalis: medicalisCategorieSlug && medicalisCodeVille ? { categorieSlug: medicalisCategorieSlug, codeVille: medicalisCodeVille } : undefined,
        });
        console.log('Résumé :', resultat.scraping);
      } catch (e: any) {
        console.error(`Erreur sur ${categorie}/${ville} :`, e.message);
        resultat.erreur = e.message;
      }
      resultats.push(resultat);
    }
  }

  console.log(`\n\n================ RÉCAPITULATIF (Medicalis.ma seul, ${CATEGORIES.join(', ')}) ================`);
  let totalDoublons = 0, totalIncertains = 0, totalNouveaux = 0;
  for (const r of resultats) {
    const s = r.scraping;
    console.log(`${r.categorie.padEnd(20)} ${r.ville.padEnd(12)} doublons=${s?.doublonsConfirmes ?? '-'} incertains=${s?.incertains ?? '-'} nouveaux=${s?.nouveaux ?? '-'}${r.erreur ? `  ERREUR: ${r.erreur}` : ''}`);
    totalDoublons += s?.doublonsConfirmes ?? 0;
    totalIncertains += s?.incertains ?? 0;
    totalNouveaux += s?.nouveaux ?? 0;
  }
  console.log(`\nTotal : ${totalDoublons} doublons confirmés, ${totalIncertains} incertains, ${totalNouveaux} nouveaux sur ${resultats.length} combinaisons.`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
