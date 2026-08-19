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
import { fusionnerParScore, classifierContreExistants, distanceGpsMetres, chargerExistants } from './dedup';
import type { CategorieSlugs } from './config';

export interface ScrapingConfig {
  categorie: string;
  pays: string;
  ville: string;
  villeSlug: string;
  sources: CategorieSlugs;
  // Optionnel : Medicalis.ma a un schéma d'URL à part (indicatif téléphonique régional au lieu
  // d'un slug de ville) et une couverture trop inégale par catégorie pour être généralisée sans
  // vérification ville par ville — voir conversation. Omis par défaut, activable au cas par cas.
  medicalis?: { categorieSlug: string; codeVille: string };
}

export interface ScrapingSummary {
  categorie: string;
  ville: string;
  brut: number;
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

async function scraperToutesSources(config: ScrapingConfig) {
  const { dabadoc, doctori, telecontact, medma } = config.sources;

  console.log(`Scraping HTTP pour ${config.categorie}/${config.ville}...`);
  const [dabaR, doctoriR, tcR] = await Promise.all([
    dabadoc ? scrapeDabaDoc(dabadoc, config.villeSlug) : Promise.resolve([]),
    doctori ? scrapeDoctori(doctori, config.villeSlug) : Promise.resolve([]),
    telecontact ? scrapeTelecontact(telecontact, config.villeSlug) : Promise.resolve([]),
  ]);
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
      if (config.medicalis) medicalisR = await scrapeMedicalis(driver, config.medicalis.categorieSlug, config.ville, config.medicalis.codeVille);
    } finally {
      await driver.quit();
    }
    console.log(`  Med.ma=${medma ? medmaR.length : '—'}${config.medicalis ? `, Medicalis.ma=${medicalisR.length}` : ''}`);
  }

  return [...dabaR, ...doctoriR, ...tcR, ...medmaR, ...medicalisR];
}

// Scrape les sources externes (hors Google Maps), fusionne, dédoublonne contre la base, géocode
// les nouveaux candidats manquant de coordonnées, puis insère en statut "brouillon" — les
// doublons confirmés sont exclus ; les cas incertains sont insérés aussi (rien n'est publié sans
// relecture humaine dans Directus) mais avec une note explicite dans le champ source, pour que
// l'admin sache qu'il faut trancher avant de publier.
export async function scraperEtInserer(pool: Pool, config: ScrapingConfig): Promise<ScrapingSummary> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY non définie (nécessaire pour géocoder les adresses sans coordonnées).');

  const [existants, zonesParVille, prochainNumero] = await Promise.all([
    chargerExistants(pool, config.categorie, config.ville),
    chargerZonesParVille(pool),
    prochainNumeroEtablissement(pool),
  ]);

  if (!zonesParVille[cleZonesParVille(config.pays, config.ville)]) {
    throw new Error(`Aucune zone connue pour "${config.ville}" (${config.pays}) — impossible de calculer l'arrondissement.`);
  }

  const centroideVille = await chargerCentroideVille(pool, config.ville);

  const brutBrut = await scraperToutesSources(config);
  console.log(`Total brut, toutes sources confondues : ${brutBrut.length} enregistrements`);

  // Certaines sources (constaté sur DabaDoc) retournent, pour des fiches mal géocodées de leur
  // côté, le centroïde de la ville plutôt que l'adresse réelle — deux personnes différentes se
  // retrouvent alors avec des coordonnées identiques à quelques mètres près. Sans ce nettoyage,
  // ce faux signal "GPS très proche" fausserait la fusion ET le dédoublonnage contre la base, en
  // plus de produire une coordonnée trompeuse en cas d'insertion. On traite ces coordonnées comme
  // absentes ; le géocodage par adresse prend le relais plus loin.
  const brut = brutBrut.map((f) => {
    if (centroideVille && f.lat != null && f.lng != null) {
      const distCentroide = distanceGpsMetres(f.lat, f.lng, centroideVille.lat, centroideVille.lng);
      if (distCentroide < 100) return { ...f, lat: null, lng: null };
    }
    return f;
  });

  const fusionnes = fusionnerParScore(brut);
  console.log(`Après fusion multi-sources : ${fusionnes.length} entités distinctes`);

  const resultats = classifierContreExistants(fusionnes, existants);
  const doublons = resultats.filter((r) => r.statut === 'doublon_confirme');
  const aInserer = resultats.filter((r) => r.statut !== 'doublon_confirme');

  console.log(`${doublons.length} doublons confirmés exclus, ${aInserer.length} à insérer (brouillon)`);

  const geocodageEchecs: string[] = [];
  let numero = prochainNumero;

  for (const candidat of aInserer) {
    let lat = candidat.lat, lng = candidat.lng;
    if (lat == null || lng == null) {
      const geo = await geocoderAdresse(candidat.nom, candidat.adresse, config.ville, config.pays, apiKey);
      if (!geo) {
        geocodageEchecs.push(candidat.nom);
        continue; // pas de coordonnées = pas d'insertion possible (latitude/longitude NOT NULL)
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
  }

  return {
    categorie: config.categorie,
    ville: config.ville,
    brut: brut.length,
    fusionnes: fusionnes.length,
    doublonsConfirmes: doublons.length,
    incertains: resultats.filter((r) => r.statut === 'incertain').length,
    nouveaux: resultats.filter((r) => r.statut === 'nouveau').length,
    geocodageEchecs,
  };
}
