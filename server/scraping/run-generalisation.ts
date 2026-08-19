import 'dotenv/config';
import { pool } from '../db';
import { extraireEtInserer, type ExtractionSummary } from '../extraction';
import { scraperEtInserer, type ScrapingSummary } from './orchestrateur';
import { VILLE_SLUGS, CATEGORIE_SLUGS, VILLES_CIBLES, CATEGORIES_CIBLES } from './config';
import { notifierDirectus } from './notifier';

interface ResultatCombine {
  categorie: string;
  ville: string;
  google: ExtractionSummary | null;
  scraping: ScrapingSummary | null;
  erreur?: string;
}

// Généralisation aux 6 villes × 7 catégories couvertes par au moins une source de scraping
// (Clinique Privée exclue, voir config.ts — aucune source externe fiable, reste sur Google Maps
// seul). Pour chaque combinaison : Google Maps d'abord, puis le scraping externe (DabaDoc,
// Doctori.ma, Télécontact/PagesJaunes, Med.ma) — l'ordre est une convention, pas une nécessité :
// les deux pipelines rechargent l'état actuel de la base à leur propre appel et appliquent le même
// scoring nom/adresse/GPS contre l'existant (server/scraping/dedup.ts), donc un médecin déjà
// inséré par l'un est correctement reconnu comme doublon par l'autre, quel que soit l'ordre.
// Tourne combinaison par combinaison plutôt qu'en parallèle : Med.ma nécessite un nouveau
// navigateur Selenium par appel, et lancer plusieurs instances Chrome en parallèle saturerait la
// machine locale pour un gain de temps marginal (le goulot est surtout le géocodage séquentiel).
async function main() {
  const resultats: ResultatCombine[] = [];

  for (const ville of VILLES_CIBLES) {
    for (const categorie of CATEGORIES_CIBLES) {
      const sources = CATEGORIE_SLUGS[categorie];
      // Au moins une source doit couvrir cette catégorie, sinon inutile de lancer un cycle vide.
      if (!sources.dabadoc && !sources.doctori && !sources.telecontact && !sources.medma) continue;

      console.log(`\n########## ${categorie} / ${ville} ##########`);
      const resultat: ResultatCombine = { categorie, ville, google: null, scraping: null };
      try {
        console.log('--- Google Maps ---');
        resultat.google = await extraireEtInserer(pool, categorie, 'Maroc', ville);
        console.log('Résumé Google Maps :', resultat.google);

        console.log('--- Scraping externe ---');
        resultat.scraping = await scraperEtInserer(pool, {
          categorie,
          pays: 'Maroc',
          ville,
          villeSlug: VILLE_SLUGS[ville],
          sources,
        });
        console.log('Résumé scraping externe :', resultat.scraping);
      } catch (e: any) {
        console.error(`Erreur sur ${categorie}/${ville} :`, e.message);
        resultat.erreur = e.message;
      }
      resultats.push(resultat);
    }
  }

  console.log('\n\n================ RÉCAPITULATIF GÉNÉRAL ================');
  let totalDoublons = 0, totalIncertains = 0, totalNouveaux = 0;
  let googleNouveaux = 0, googleIncertains = 0, scrapingNouveaux = 0, scrapingIncertains = 0;
  const erreurs: string[] = [];
  for (const r of resultats) {
    const g = r.google;
    const s = r.scraping;
    const doublons = (g?.doublons ?? 0) + (s?.doublonsConfirmes ?? 0);
    const incertains = (g?.incertains ?? 0) + (s?.incertains ?? 0);
    const nouveaux = (g?.nombreNouveaux ?? 0) + (s?.nouveaux ?? 0);
    console.log(
      `${r.categorie.padEnd(35)} ${r.ville.padEnd(12)} google(doublons=${g?.doublons ?? '-'} incertains=${g?.incertains ?? '-'} nouveaux=${g?.nombreNouveaux ?? '-'})  scraping(doublons=${s?.doublonsConfirmes ?? '-'} incertains=${s?.incertains ?? '-'} nouveaux=${s?.nouveaux ?? '-'})${r.erreur ? `  ERREUR: ${r.erreur}` : ''}`
    );
    totalDoublons += doublons;
    totalIncertains += incertains;
    totalNouveaux += nouveaux;
    googleNouveaux += g?.nombreNouveaux ?? 0;
    googleIncertains += g?.incertains ?? 0;
    scrapingNouveaux += s?.nouveaux ?? 0;
    scrapingIncertains += s?.incertains ?? 0;
    if (r.erreur) erreurs.push(`${r.categorie}/${r.ville} : ${r.erreur}`);
  }
  console.log(`\nTotal (Google Maps + scraping externe) : ${totalDoublons} doublons confirmés, ${totalIncertains} incertains, ${totalNouveaux} nouveaux sur ${resultats.length} combinaisons.`);

  await notifierDirectus(
    `Balayage complet terminé : ${totalNouveaux + totalIncertains} fiches ajoutées`,
    `**${totalNouveaux + totalIncertains} fiches ajoutées en brouillon** sur ${resultats.length} combinaisons ville × catégorie (${totalNouveaux} nouvelles, ${totalIncertains} à vérifier, ${totalDoublons} déjà connues, exclues).\n\n` +
    `Google Maps : ${googleNouveaux} nouvelles, ${googleIncertains} à vérifier.\n` +
    `Scraping externe (DabaDoc, Doctori.ma, Télécontact, Med.ma) : ${scrapingNouveaux} nouvelles, ${scrapingIncertains} à vérifier.` +
    (erreurs.length > 0 ? `\n\n⚠️ ${erreurs.length} combinaison(s) en erreur :\n${erreurs.join('\n')}` : '')
  );

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
