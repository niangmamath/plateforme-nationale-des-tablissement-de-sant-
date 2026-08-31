import { Pool } from 'pg';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import {
  cleZonesParVille,
  chargerZonesParVille,
  trouverArrondissementLePlusProche,
  prochainNumeroEtablissement,
} from '../extraction';
import { scrapeDabaDoc, scrapeDoctori, scrapeTelecontact, scrapeMedMa, scrapeMedicalis } from './sources';
import { fusionnerParScore, classifierContreExistants, distanceGpsMetres, chargerExistants, chargerExistantsAutresCategories, scoreCorrespondance, SEUIL_DOUBLON_CONFIRME, estNomPersonnel, type FicheScrapee, type FicheExistante } from './dedup';
import type { CategorieSlugs } from './config';

export interface ScrapingConfig {
  categorie: string;
  pays: string;
  ville: string;
  villeSlug: string;
  sources: CategorieSlugs;
  // Optionnel : Medicalis.ma a un schéma d'URL à part (un identifiant de ville interne au site,
  // pas l'indicatif téléphonique régional — voir MEDICALIS_CODE_VILLE dans config.ts) et sa
  // couverture par catégorie est trop inégale pour être généralisée sans vérification manuelle
  // (certaines catégories du site ne listent que des cliniques, pas des praticiens individuels).
  // run-cible.ts et run-generalisation.ts ne le renseignent que pour les catégories vérifiées
  // (MEDICALIS_CATEGORIE_SLUGS) ; absent pour les autres. categorieSlug peut être plusieurs slugs
  // (constaté pour Neurologue : "Neurologue" et "Neurologie" renvoient des listes qui se recoupent
  // sans être identiques — même mécanisme de fragmentation que DabaDoc/Doctori.ma ailleurs).
  medicalis?: { categorieSlug: string | string[]; codeVille: string };
}

export interface ScrapingSummary {
  categorie: string;
  ville: string;
  brut: number;
  parSource: Record<string, number>;
  fusionnes: number;
  doublonsConfirmes: number;
  incertains: number;
  nouveaux: number;
  geocodageEchecs: string[];
}

async function chargerCentroideVille(pool: Pool, ville: string): Promise<{ lat: number; lng: number } | null> {
  const { rows } = await pool.query(`SELECT lat, lng FROM villes WHERE nom = $1`, [ville]);
  if (rows.length === 0) return null;
  return { lat: Number(rows[0].lat), lng: Number(rows[0].lng) };
}

// Les sources scrapées ne fournissent presque jamais de coordonnées GPS (Télécontact/PagesJaunes
// et Medicalis.ma n'en donnent jamais ; Med.ma non plus dans notre scraper) — latitude/longitude
// sont NOT NULL en base, donc on géocode l'adresse via l'API déjà utilisée pour l'extraction
// Google Places (même clé, même compte de facturation), plutôt que d'introduire une 2e clé API.
async function geocoderAdresse(nom: string, adresse: string | null | undefined, ville: string, pays: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const requete = adresse ? `${nom}, ${adresse}` : `${nom}, ${ville}, ${pays}`;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', requete);
  url.searchParams.set('key', apiKey);
  const res = await fetch(url);
  const data: any = await res.json();
  const loc = data.results?.[0]?.geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
}

async function scraperToutesSources(config: ScrapingConfig): Promise<{ enregistrements: FicheScrapee[]; parSource: Record<string, number> }> {
  const { dabadoc, doctori, telecontact, medma } = config.sources;

  console.log(`Scraping HTTP pour ${config.categorie}/${config.ville}...`);
  // dabadoc peut être plusieurs slugs (catégories DabaDoc distinctes qui se recoupent partiellement
  // — voir config.ts pour Oncologue) : on les scrape tous et on concatène brut, la fusion
  // multi-sources plus loin (fusionnerParScore) élimine déjà les doublons entre eux comme pour
  // n'importe quelle autre source.
  const slugsDabadoc = dabadoc ? (Array.isArray(dabadoc) ? dabadoc : [dabadoc]) : [];
  const slugsDoctori = doctori ? (Array.isArray(doctori) ? doctori : [doctori]) : [];
  const [dabaRParSlug, doctoriRParSlug, tcR] = await Promise.all([
    Promise.all(slugsDabadoc.map((slug) => scrapeDabaDoc(slug, config.villeSlug))),
    Promise.all(slugsDoctori.map((slug) => scrapeDoctori(slug, config.villeSlug))),
    telecontact ? scrapeTelecontact(telecontact, config.villeSlug) : Promise.resolve([]),
  ]);
  const dabaR = dabaRParSlug.flat();
  const doctoriR = doctoriRParSlug.flat();
  console.log(`  DabaDoc=${dabadoc ? dabaR.length : '—'}, Doctori.ma=${doctori ? doctoriR.length : '—'}, Télécontact/PagesJaunes=${telecontact ? tcR.length : '—'}`);

  let medmaR: Awaited<ReturnType<typeof scrapeMedMa>> = [];
  let medicalisR: Awaited<ReturnType<typeof scrapeMedicalis>> = [];
  if (medma || config.medicalis) {
    console.log(`Scraping navigateur (${medma ? 'Med.ma' : ''}${medma && config.medicalis ? ', ' : ''}${config.medicalis ? 'Medicalis.ma' : ''})...`);
    const options = new chrome.Options();
    options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1440,900');
    const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    try {
      if (medma) medmaR = await scrapeMedMa(driver, medma, config.villeSlug);
      if (config.medicalis) {
        const slugsMedicalis = Array.isArray(config.medicalis.categorieSlug) ? config.medicalis.categorieSlug : [config.medicalis.categorieSlug];
        for (const slug of slugsMedicalis) {
          medicalisR.push(...(await scrapeMedicalis(driver, slug, config.ville, config.medicalis.codeVille)));
        }
      }
    } finally {
      await driver.quit();
    }
    console.log(`  Med.ma=${medma ? medmaR.length : '—'}${config.medicalis ? `, Medicalis.ma=${medicalisR.length}` : ''}`);
  }

  const parSource: Record<string, number> = {};
  if (dabadoc) parSource['DabaDoc'] = dabaR.length;
  if (doctori) parSource['Doctori.ma'] = doctoriR.length;
  if (telecontact) parSource['Télécontact / PagesJaunes'] = tcR.length;
  if (medma) parSource['Med.ma'] = medmaR.length;
  if (config.medicalis) parSource['Medicalis.ma'] = medicalisR.length;

  return { enregistrements: [...dabaR, ...doctoriR, ...tcR, ...medmaR, ...medicalisR], parSource };
}

// Scrape les sources externes (hors Google Maps), fusionne, dédoublonne contre la base, géocode
// les nouveaux candidats manquant de coordonnées, puis insère en statut "brouillon" — les
// doublons confirmés sont exclus ; les cas incertains sont insérés aussi (rien n'est publié sans
// relecture humaine dans Directus) mais avec une note explicite dans le champ source, pour que
// l'admin sache qu'il faut trancher avant de publier.
export async function scraperEtInserer(pool: Pool, config: ScrapingConfig): Promise<ScrapingSummary> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY non définie (nécessaire pour géocoder les adresses sans coordonnées).');

  const [existants, existantsAutresCategories, zonesParVille, prochainNumero] = await Promise.all([
    chargerExistants(pool, config.categorie, config.ville),
    chargerExistantsAutresCategories(pool, config.categorie, config.ville),
    chargerZonesParVille(pool),
    prochainNumeroEtablissement(pool),
  ]);

  if (!zonesParVille[cleZonesParVille(config.pays, config.ville)]) {
    throw new Error(`Aucune zone connue pour "${config.ville}" (${config.pays}) — impossible de calculer l'arrondissement.`);
  }

  const centroideVille = await chargerCentroideVille(pool, config.ville);

  const { enregistrements: brutBrut, parSource } = await scraperToutesSources(config);
  console.log(`Total brut, toutes sources confondues : ${brutBrut.length} enregistrements`);

  // Certaines sources (constaté sur DabaDoc) retournent, pour des fiches mal géocodées de leur
  // côté, le centroïde de la ville plutôt que l'adresse réelle — deux personnes différentes se
  // retrouvent alors avec des coordonnées identiques à quelques mètres près. Sans ce nettoyage,
  // ce faux signal "GPS très proche" fausserait la fusion ET le dédoublonnage contre la base, en
  // plus de produire une coordonnée trompeuse en cas d'insertion. On traite ces coordonnées comme
  // absentes ; le géocodage par adresse prend le relais plus loin.
  //
  // DabaDoc et Doctori.ma fournissent parfois directement un lat/lng dans leur propre réponse
  // (voir scrapeDabaDoc/scrapeDoctori) — on leur fait confiance par défaut pour éviter un appel de
  // géocodage inutile. Mais constaté en prod : DabaDoc a renvoyé des coordonnées au fin fond de
  // l'Arctique et à New York, et Doctori.ma un lat/lng strictement identiques (impossible pour de
  // vraies coordonnées) pour des médecins marocains — mauvaise donnée côté SOURCE, pas un bug de
  // notre géocodage. Un lat/lng hors du Maroc ou avec lat === lng est donc traité comme absent,
  // pour forcer le géocodage par adresse (fiable, voir plus bas) plutôt que d'insérer une position
  // trompeuse telle quelle.
  const dansLeMaroc = (lat: number, lng: number) => lat >= 20.5 && lat <= 36.5 && lng >= -17.5 && lng <= -0.5 && lat !== lng;
  const brut = brutBrut.map((f) => {
    if (f.lat != null && f.lng != null && !dansLeMaroc(f.lat, f.lng)) {
      return { ...f, lat: null, lng: null };
    }
    if (centroideVille && f.lat != null && f.lng != null) {
      const distCentroide = distanceGpsMetres(f.lat, f.lng, centroideVille.lat, centroideVille.lng);
      if (distCentroide < 100) return { ...f, lat: null, lng: null };
    }
    return f;
  });

  const fusionnes = fusionnerParScore(brut);
  console.log(`Après fusion multi-sources : ${fusionnes.length} entités distinctes`);

  const resultats = classifierContreExistants(fusionnes, existants, existantsAutresCategories);
  const doublons = resultats.filter((r) => r.statut === 'doublon_confirme');
  const aInserer = resultats.filter((r) => r.statut !== 'doublon_confirme');

  console.log(`${doublons.length} doublons confirmés exclus, ${aInserer.length} à insérer (brouillon)`);

  const geocodageEchecs: string[] = [];
  let numero = prochainNumero;
  // Fiches "nouveau" tout juste insérées, coordonnées définitives (post-géocodage) — voir le
  // rattrapage anti-doublon plus bas : c'est justement pour CES fiches que fusionnerParScore, plus
  // haut, tourne à l'aveugle côté GPS (Télécontact/Med.ma/Medicalis ne fournissent jamais leurs
  // propres coordonnées, donc la comparaison intra-lot se fait sans ce signal tant que le
  // géocodage n'a pas eu lieu).
  const nouveauxInseres: { id: string; nom: string; adresse: string | null; lat: number; lng: number }[] = [];
  // Fiches "incertain" tout juste insérées — leur doublon_possible_id a été choisi AVANT
  // géocodage, sur le même signal incomplet ; voir revaliderIncertains plus bas.
  const incertainsInseres: { id: string; nom: string; adresse: string | null; lat: number; lng: number; categorie: string; doublonPossibleId: string | null }[] = [];

  for (const candidat of aInserer) {
    let lat = candidat.lat, lng = candidat.lng;
    if (lat == null || lng == null) {
      const geo = await geocoderAdresse(candidat.nom, candidat.adresse, config.ville, config.pays, apiKey);
      // Le garde-fou plus haut (dansLeMaroc) ne validait que les coordonnées fournies telles
      // quelles par la source — pas le résultat de NOTRE PROPRE géocodage. Constaté en prod :
      // Google Geocoding a renvoyé le Bangladesh pour une adresse à Mediouna (Casablanca), et le
      // Qatar pour une adresse contenant "Doha" comme nom de quartier marocain — une requête mal
      // formée ou ambiguë peut faire dériver la recherche n'importe où dans le monde, pas
      // seulement échouer proprement. Même validation qu'à la ligne ~140, appliquée cette fois au
      // résultat du géocodage plutôt qu'à l'entrée.
      //
      // dansLeMaroc seule ne suffit pas non plus : un nom de rue générique partagé par plusieurs
      // villes ("Boulevard Mohammed V", "Rue Moussa Ibn Noussair") fait dériver Google Geocoding
      // vers la même rue d'UNE AUTRE ville marocaine — toujours "dans le Maroc", donc invisible
      // pour ce garde-fou. Constaté en prod : des dizaines de fiches "Tanger" (adresse text
      // correcte) géocodées à Tétouan, Larache, Al Hoceima, voire Nador — jamais détecté avant
      // insertion. On rejette donc aussi tout résultat à plus de 30km du centroïde de la ville
      // ciblée (même seuil de repli qu'extraction.ts pour la recherche Google Places).
      const horsVilleCible =
        centroideVille != null && geo != null && distanceGpsMetres(geo.lat, geo.lng, centroideVille.lat, centroideVille.lng) > 30000;
      if (!geo || !dansLeMaroc(geo.lat, geo.lng) || horsVilleCible) {
        geocodageEchecs.push(candidat.nom);
        continue; // pas de coordonnées fiables = pas d'insertion possible (latitude/longitude NOT NULL)
      }
      lat = geo.lat;
      lng = geo.lng;
    }

    const arrondissement = trouverArrondissementLePlusProche(lat, lng, config.pays, config.ville, zonesParVille);
    const id = `etab-${numero}`;
    numero += 1;

    await pool.query(
      `INSERT INTO etablissements (id, nom, categorie, ville, quartier, arrondissement, adresse, latitude, longitude, source, statut, verification_requise, doublon_possible_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'brouillon',$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        id, candidat.nom, config.categorie, config.ville, arrondissement, arrondissement, candidat.adresse ?? '', lat, lng,
        candidat.sources.join(', '),
        candidat.statut === 'incertain', candidat.statut === 'incertain' ? candidat.matchExistant?.id ?? null : null,
      ]
    );

    if (candidat.statut === 'nouveau') {
      nouveauxInseres.push({ id, nom: candidat.nom, adresse: candidat.adresse ?? null, lat, lng });
    } else if (candidat.statut === 'incertain') {
      incertainsInseres.push({
        id, nom: candidat.nom, adresse: candidat.adresse ?? null, lat, lng,
        categorie: config.categorie, doublonPossibleId: candidat.matchExistant?.id ?? null,
      });
    }
  }

  const doublonsPostGeocodage = await nettoyerDoublonsPostGeocodage(pool, nouveauxInseres);
  if (doublonsPostGeocodage > 0) {
    console.log(`${doublonsPostGeocodage} doublon(s) rattrapé(s) après géocodage (GPS absent des deux côtés au moment de la fusion).`);
  }

  const { corriges, confirmes } = await revaliderIncertains(pool, incertainsInseres, existants, existantsAutresCategories);
  if (corriges > 0) console.log(`${corriges} doublon_possible_id corrigé(s) après géocodage (le candidat suggéré n'était pas le bon).`);
  if (confirmes > 0) console.log(`${confirmes} fiche(s) "incertain" en fait confirmée(s) doublon après géocodage.`);

  return {
    categorie: config.categorie,
    ville: config.ville,
    brut: brut.length,
    parSource,
    fusionnes: fusionnes.length,
    doublonsConfirmes: doublons.length + doublonsPostGeocodage + confirmes,
    incertains: resultats.filter((r) => r.statut === 'incertain').length - confirmes,
    nouveaux: resultats.filter((r) => r.statut === 'nouveau').length - doublonsPostGeocodage,
    geocodageEchecs,
  };
}

// Deux fiches "nouveau" du même lot peuvent être le même établissement scrapé par deux sources
// dont une seule fournit son propre GPS (Télécontact/Med.ma/Medicalis ne le font jamais) — au
// moment de fusionnerParScore, la comparaison tourne alors sans ce signal et le score reste sous
// le seuil, donc rien n'est fusionné. Une fois les DEUX fiches insérées avec leurs coordonnées
// définitives (post-géocodage), ce rattrapage les recompare avec le signal complet et supprime le
// doublon le moins complet — constaté en prod : "Fouzia BENKHRABA" (Doctori.ma, GPS natif) et
// "Benkhraba Laaboudi Faouzia" (Télécontact, geocodée après coup) insérées séparément, jamais
// comparées avec GPS des deux côtés avant cette passe.
async function nettoyerDoublonsPostGeocodage(
  pool: Pool,
  candidats: { id: string; nom: string; adresse: string | null; lat: number; lng: number }[]
): Promise<number> {
  const aSupprimer = new Set<string>();
  for (let i = 0; i < candidats.length; i++) {
    if (aSupprimer.has(candidats[i].id)) continue;
    for (let j = i + 1; j < candidats.length; j++) {
      if (aSupprimer.has(candidats[j].id)) continue;
      const { score } = scoreCorrespondance(candidats[i], candidats[j]);
      if (score >= SEUIL_DOUBLON_CONFIRME) {
        const a = candidats[i], b = candidats[j];
        const scoreA = (a.adresse ? 1 : 0) + a.nom.length / 1000;
        const scoreB = (b.adresse ? 1 : 0) + b.nom.length / 1000;
        aSupprimer.add(scoreA >= scoreB ? b.id : a.id);
      }
    }
  }
  if (aSupprimer.size > 0) {
    await pool.query(`DELETE FROM etablissements WHERE id = ANY($1)`, [[...aSupprimer]]);
  }
  return aSupprimer.size;
}

// Le doublon_possible_id d'une fiche "incertain" est choisi AU MOMENT DU CLASSEMENT, avant
// géocodage — pour les candidats sans coordonnées natives, la comparaison tourne alors sans le
// signal GPS et peut retenir, à tort, le candidat avec la meilleure coïncidence purement
// textuelle plutôt que le vrai doublon. Constaté en prod : "Mohamed Bergi" suggéré comme doublon
// possible de "Jamal Berrada Mohamed" (simple coïncidence de lettres) alors que "Dr Mohamed
// BERGI" — la vraie même personne — existait déjà en base, jamais retenu faute de GPS au moment
// du calcul. Une fois les coordonnées définitives connues, on relance la recherche du meilleur
// match en entier (pas seulement une revérification du candidat déjà suggéré) : si un candidat
// plus proche existe, doublon_possible_id est corrigé ; si le nouveau score dépasse le seuil de
// confirmation, la fiche est un vrai doublon et supprimée plutôt que laissée en attente.
async function revaliderIncertains(
  pool: Pool,
  candidats: { id: string; nom: string; adresse: string | null; lat: number; lng: number; categorie: string; doublonPossibleId: string | null }[],
  existants: FicheExistante[],
  existantsAutresCategories: FicheExistante[]
): Promise<{ corriges: number; confirmes: number }> {
  let corriges = 0;
  const aConfirmer: string[] = [];

  for (const candidat of candidats) {
    const pool2 = estNomPersonnel(candidat.nom) ? [...existants, ...existantsAutresCategories] : existants;
    let meilleur: FicheExistante | null = null, meilleurScore = 0;
    for (const e of pool2) {
      const { score } = scoreCorrespondance(e, candidat);
      if (score > meilleurScore) { meilleurScore = score; meilleur = e; }
    }
    if (!meilleur) continue;

    if (meilleurScore >= SEUIL_DOUBLON_CONFIRME) {
      aConfirmer.push(candidat.id);
    } else if (meilleur.id !== candidat.doublonPossibleId) {
      await pool.query(`UPDATE etablissements SET doublon_possible_id = $1 WHERE id = $2`, [meilleur.id, candidat.id]);
      corriges++;
    }
  }

  if (aConfirmer.length > 0) {
    await pool.query(`DELETE FROM etablissements WHERE id = ANY($1)`, [aConfirmer]);
  }

  return { corriges, confirmes: aConfirmer.length };
}
