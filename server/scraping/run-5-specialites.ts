import 'dotenv/config';
import { Pool } from 'pg';
import { extraireEtInserer, type ExtractionSummary } from '../extraction';
import { scraperEtInserer, type ScrapingSummary } from './orchestrateur';
import { VILLE_SLUGS, CATEGORIE_SLUGS, VILLES_CIBLES, MEDICALIS_CODE_VILLE, MEDICALIS_CATEGORIE_SLUGS } from './config';
import { notifierDirectus, formatStatsParSource } from './notifier';

// Variante de run-generalisation.ts limitée aux 5 spécialités récemment ajoutées (peu
// d'établissements constaté par l'équipe) — évite de re-scraper inutilement les 9 autres
// catégories déjà couvertes lors d'un précédent balayage complet.
const CATEGORIES_5_SPECIALITES = ['Gynécologue', 'Gastro-entérologue', 'ORL', 'Oncologue', 'Néphrologue'];

// Argument CLI optionnel pour ne relancer qu'une ou plusieurs catégories précises (séparées par
// une virgule, ex. `tsx run-5-specialites.ts Endocrinologue,Anatomopathologiste,Pédiatre`) plutôt
// que de re-scraper les 5 spécialités d'origine à chaque fois — accepte n'importe quelle catégorie
// connue de CATEGORIE_SLUGS, pas seulement les 5 d'origine.
const categoriesCiblees = process.argv[2]?.split(',');
if (categoriesCiblees) {
  const inconnues = categoriesCiblees.filter((c) => !(c in CATEGORIE_SLUGS));
  if (inconnues.length > 0) {
    console.error(`Catégorie(s) inconnue(s) : ${inconnues.join(', ')}. Connues : ${Object.keys(CATEGORIE_SLUGS).join(', ')}.`);
    process.exit(1);
  }
}

// Le harness local réinjecte DATABASE_URL depuis .env (pointant sur une base locale) même en cas
// de surcharge shell explicite — on cible donc directement la même connexion prod utilisée partout
// ailleurs dans cette session plutôt que de dépendre de ../db (qui, lui, lit DATABASE_URL).
const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL_SESSION });

interface ResultatCombine {
  categorie: string;
  ville: string;
  google: ExtractionSummary | null;
  scraping: ScrapingSummary | null;
  erreur?: string;
}

async function main() {
  const resultats: ResultatCombine[] = [];

  const categories = categoriesCiblees ?? CATEGORIES_5_SPECIALITES;
  for (const ville of VILLES_CIBLES) {
    for (const categorie of categories) {
      const sources = CATEGORIE_SLUGS[categorie];

      console.log(`\n########## ${categorie} / ${ville} ##########`);
      const resultat: ResultatCombine = { categorie, ville, google: null, scraping: null };
      try {
        console.log('--- Google Maps ---');
        resultat.google = await extraireEtInserer(pool, categorie, 'Maroc', ville);
        console.log('Résumé Google Maps :', resultat.google);

        console.log('--- Scraping externe ---');
        const medicalisCategorieSlug = MEDICALIS_CATEGORIE_SLUGS[categorie];
        const medicalisCodeVille = MEDICALIS_CODE_VILLE[ville];
        resultat.scraping = await scraperEtInserer(pool, {
          categorie,
          pays: 'Maroc',
          ville,
          villeSlug: VILLE_SLUGS[ville],
          sources,
          medicalis: medicalisCategorieSlug && medicalisCodeVille
            ? { categorieSlug: medicalisCategorieSlug, codeVille: medicalisCodeVille }
            : undefined,
        });
        console.log('Résumé scraping externe :', resultat.scraping);
      } catch (e: any) {
        console.error(`Erreur sur ${categorie}/${ville} :`, e.message);
        resultat.erreur = e.message;
      }
      resultats.push(resultat);
    }
  }

  console.log(`\n\n================ RÉCAPITULATIF (${categories.join(', ')}) ================`);
  let totalDoublons = 0, totalIncertains = 0, totalNouveaux = 0;
  let googleNouveaux = 0, googleIncertains = 0, scrapingNouveaux = 0, scrapingIncertains = 0;
  let googleExtraitsTotal = 0;
  const parSourceTotal: Record<string, number> = {};
  const erreurs: string[] = [];
  for (const r of resultats) {
    const g = r.google;
    const s = r.scraping;
    const doublons = (g?.doublons ?? 0) + (s?.doublonsConfirmes ?? 0);
    const incertains = (g?.incertains ?? 0) + (s?.incertains ?? 0);
    const nouveaux = (g?.nombreNouveaux ?? 0) + (s?.nouveaux ?? 0);
    console.log(
      `${r.categorie.padEnd(20)} ${r.ville.padEnd(12)} google(doublons=${g?.doublons ?? '-'} incertains=${g?.incertains ?? '-'} nouveaux=${g?.nombreNouveaux ?? '-'})  scraping(doublons=${s?.doublonsConfirmes ?? '-'} incertains=${s?.incertains ?? '-'} nouveaux=${s?.nouveaux ?? '-'})${r.erreur ? `  ERREUR: ${r.erreur}` : ''}`
    );
    totalDoublons += doublons;
    totalIncertains += incertains;
    totalNouveaux += nouveaux;
    googleNouveaux += g?.nombreNouveaux ?? 0;
    googleIncertains += g?.incertains ?? 0;
    scrapingNouveaux += s?.nouveaux ?? 0;
    scrapingIncertains += s?.incertains ?? 0;
    googleExtraitsTotal += g?.extraits ?? 0;
    for (const [source, n] of Object.entries(s?.parSource ?? {})) {
      parSourceTotal[source] = (parSourceTotal[source] ?? 0) + n;
    }
    if (r.erreur) erreurs.push(`${r.categorie}/${r.ville} : ${r.erreur}`);
  }
  console.log(`\nTotal (Google Maps + scraping externe) : ${totalDoublons} doublons confirmés, ${totalIncertains} incertains, ${totalNouveaux} nouveaux sur ${resultats.length} combinaisons.`);

  await notifierDirectus(
    `Scraping (${categories.join(', ')}) terminé : ${totalNouveaux + totalIncertains} fiches ajoutées`,
    `**${totalNouveaux + totalIncertains} fiches ajoutées en brouillon** sur ${resultats.length} combinaisons ville × catégorie (${totalNouveaux} nouvelles, ${totalIncertains} à vérifier, ${totalDoublons} déjà connues, exclues).\n\n` +
    `Par source (candidats bruts trouvés, toutes combinaisons cumulées) : ${formatStatsParSource(googleExtraitsTotal, parSourceTotal)}\n\n` +
    `Google Maps : ${googleNouveaux} nouvelles, ${googleIncertains} à vérifier.\n` +
    `Scraping externe (DabaDoc, Doctori.ma, Télécontact/PagesJaunes, Med.ma) : ${scrapingNouveaux} nouvelles, ${scrapingIncertains} à vérifier.` +
    (erreurs.length > 0 ? `\n\n⚠️ ${erreurs.length} combinaison(s) en erreur :\n${erreurs.join('\n')}` : '')
  );

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
