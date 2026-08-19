import { Pool } from 'pg';
import { chargerExistants, chargerExistantsAutresCategories, scoreCorrespondance, classifierScore, estNomPersonnel, type FicheExistante } from './scraping/dedup';

interface SpecialiteExtractionConfig {
  requete: string;
  variantes: string[];
  inclus: string[];
  exclus: string[];
  typesRequis: string[];
}

export interface ZoneCentroid {
  nom: string;
  lat: number;
  lng: number;
}

interface GooglePlaceResult {
  name: string;
  place_id: string;
  types?: string[];
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
}

interface ExtractionResultItem {
  id: string;
  nom: string;
  categorie: string;
  ville: string;
  arrondissement: string;
  adresse: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

export interface ExtractionSummary {
  specialite: string;
  pays: string;
  ville: string;
  extraits: number;
  doublons: number;
  incertains: number;
  nombreNouveaux: number;
  inseres: ExtractionResultItem[];
}

export function cleZonesParVille(pays: string, ville: string): string {
  return `${pays.trim().toLowerCase()}::${ville.trim().toLowerCase()}`;
}

// Clé composite pays+ville : deux pays peuvent avoir une ville du même nom (ex. Fès/Maroc
// vs une éventuelle ville homonyme ailleurs), donc on ne peut pas se fier au nom de ville seul.
export async function chargerZonesParVille(pool: Pool): Promise<Record<string, ZoneCentroid[]>> {
  const { rows } = await pool.query(`
    SELECT p.nom AS pays, v.nom AS ville, z.nom, z.lat, z.lng
    FROM zones z
    JOIN villes v ON v.id = z.ville_id
    JOIN pays p ON p.id = v.pays_id
    WHERE z.statut = 'publie'
    ORDER BY p.nom, v.nom, z.nom
  `);
  const parVille: Record<string, ZoneCentroid[]> = {};
  for (const r of rows) {
    const cle = cleZonesParVille(r.pays, r.ville);
    (parVille[cle] ??= []).push({ nom: r.nom, lat: Number(r.lat), lng: Number(r.lng) });
  }
  return parVille;
}

// La config d'extraction vit directement dans specialites (categorie_etablissement = la valeur
// que l'admin tape/choisit et qui devient etablissements.categorie) — une seule table, un seul
// statut à publier pour activer à la fois le scoring et l'extraction.
async function chargerConfigSpecialite(pool: Pool, specialite: string): Promise<SpecialiteExtractionConfig | null> {
  const { rows } = await pool.query(
    "SELECT requete, variantes, mots_inclus, mots_exclus, types_google FROM specialites WHERE categorie_etablissement = $1 AND statut = 'publie'",
    [specialite]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { requete: r.requete, variantes: r.variantes ?? [], inclus: r.mots_inclus, exclus: r.mots_exclus, typesRequis: r.types_google };
}

async function chargerPlaceIdsExistants(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query('SELECT place_id FROM etablissements WHERE place_id IS NOT NULL');
  return new Set(rows.map((r) => r.place_id));
}

// Les établissements saisis à la main suivent le schéma "etab-N" — on continue cette
// numérotation pour les établissements extraits automatiquement, au lieu d'y mettre le
// place_id Google (déjà stocké séparément dans la colonne place_id, utilisée pour le dédoublonnage).
export async function prochainNumeroEtablissement(pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX((substring(id from '^etab-(\\d+)$'))::int), -1) + 1 AS suivant FROM etablissements`
  );
  return Number(rows[0].suivant);
}

export function trouverArrondissementLePlusProche(lat: number, lng: number, pays: string, ville: string, zonesParVille: Record<string, ZoneCentroid[]>): string {
  const centroides = zonesParVille[cleZonesParVille(pays, ville)] ?? [];
  if (centroides.length === 0) return '';
  let distanceMin = Infinity;
  let plusProche = '';
  for (const z of centroides) {
    const dist = Math.sqrt((lat - z.lat) ** 2 + (lng - z.lng) ** 2);
    if (dist < distanceMin) {
      distanceMin = dist;
      plusProche = z.nom;
    }
  }
  return plusProche;
}

async function rechercherGooglePlaces(query: string, apiKey: string): Promise<GooglePlaceResult[]> {
  const results: GooglePlaceResult[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', query);
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pagetoken', pageToken);

    const res = await fetch(url);
    const data: any = await res.json();
    results.push(...(data.results ?? []));

    pageToken = data.next_page_token;
    if (pageToken) await new Promise((r) => setTimeout(r, 2000)); // délai requis par Google avant que le token soit valide
  } while (pageToken);

  return results;
}

async function rechercherNearbyPlaces(lat: number, lng: number, radius: number, type: string, keyword: string, apiKey: string): Promise<GooglePlaceResult[]> {
  const results: GooglePlaceResult[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('type', type);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pagetoken', pageToken);

    const res = await fetch(url);
    const data: any = await res.json();
    results.push(...(data.results ?? []));

    pageToken = data.next_page_token;
    if (pageToken) await new Promise((r) => setTimeout(r, 2000));
  } while (pageToken);

  return results;
}

function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Centre + rayon de la ville pour le Nearby Search complémentaire : le rayon est déduit de la
// distance entre le centre de la ville et sa zone la plus éloignée (+ 20% de marge), plutôt
// qu'une valeur fixe qui serait trop petite pour une grande ville ou trop grande pour une petite.
async function centreEtRayonVille(pool: Pool, pays: string, ville: string): Promise<{ lat: number; lng: number; rayon: number } | null> {
  const { rows } = await pool.query(
    `SELECT v.lat, v.lng FROM villes v JOIN pays p ON p.id = v.pays_id WHERE v.nom = $1 AND p.nom = $2`,
    [ville, pays]
  );
  if (rows.length === 0) return null;
  const lat = Number(rows[0].lat);
  const lng = Number(rows[0].lng);

  const { rows: zoneRows } = await pool.query(
    `SELECT z.lat, z.lng FROM zones z
     JOIN villes v ON v.id = z.ville_id JOIN pays p ON p.id = v.pays_id
     WHERE v.nom = $1 AND p.nom = $2 AND z.statut = 'publie'`,
    [ville, pays]
  );
  const distances = zoneRows.map((z) => distanceMetres(lat, lng, Number(z.lat), Number(z.lng)));
  const distanceMax = distances.length > 0 ? Math.max(...distances) : 5000;
  const rayon = Math.min(Math.max(Math.round(distanceMax * 1.2), 5000), 20000);

  return { lat, lng, rayon };
}

export async function extraireEtInserer(
  pool: Pool,
  specialite: string,
  pays: string,
  ville: string
): Promise<ExtractionSummary> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY non définie.');

  const [config, zonesParVille, placeIdsExistants, existantsDetailles, existantsAutresCategories, prochainNumero] = await Promise.all([
    chargerConfigSpecialite(pool, specialite),
    chargerZonesParVille(pool),
    chargerPlaceIdsExistants(pool),
    chargerExistants(pool, specialite, ville),
    chargerExistantsAutresCategories(pool, specialite, ville),
    prochainNumeroEtablissement(pool),
  ]);

  if (!config) {
    throw new Error(
      `Spécialité inconnue ou non publiée : "${specialite}". Vérifiez dans Directus (collection Spécialités) qu'une spécialité a bien ` +
      `ce "categorie_etablissement", une requête de recherche renseignée, et le statut "publié", puis relancez l'extraction.`
    );
  }

  if (!zonesParVille[cleZonesParVille(pays, ville)]) {
    throw new Error(
      `Aucune zone connue pour "${ville}" (${pays}) — impossible de calculer l'arrondissement. ` +
      `Ajoutez d'abord le pays, la ville et ses zones (avec centroïdes) dans Directus, publiez-les, puis relancez l'extraction.`
    );
  }

  // Plusieurs formulations de la requête (synonymes) + une recherche Nearby Search
  // complémentaire (type + mot-clé, pas une grille) : chaque formulation a son propre
  // classement de pertinence Google, donc des synonymes font ressortir des fiches différentes.
  // Gain mesuré empiriquement : +13% à +175% de résultats selon les cas, voir conversation.
  const requetes = [config.requete, ...config.variantes];
  const lotsResultats = await Promise.all(requetes.map((r) => rechercherGooglePlaces(`${r} ${ville}, ${pays}`, apiKey)));

  const centre = await centreEtRayonVille(pool, pays, ville);
  if (centre) {
    const nearbyResults = await rechercherNearbyPlaces(centre.lat, centre.lng, centre.rayon, config.typesRequis[0], config.requete, apiKey);
    lotsResultats.push(nearbyResults);
  }

  const placesUniques = new Map<string, GooglePlaceResult>();
  for (const lot of lotsResultats) {
    for (const place of lot) placesUniques.set(place.place_id, place);
  }
  const placesResults = [...placesUniques.values()];

  const candidats: ExtractionResultItem[] = [];
  for (const place of placesResults) {
    const nomLower = (place.name || '').toLowerCase();

    if (config.exclus.some((mot) => nomLower.includes(mot))) continue;
    const types = place.types ?? [];
    if (!config.typesRequis.some((t) => types.includes(t))) continue;
    if (!config.inclus.some((mot) => nomLower.includes(mot))) continue;

    const lat = place.geometry?.location?.lat;
    const lng = place.geometry?.location?.lng;
    if (lat == null || lng == null) continue;

    candidats.push({
      id: '', // affecté après dédoublonnage, voir plus bas
      nom: place.name,
      categorie: specialite,
      ville,
      arrondissement: trouverArrondissementLePlusProche(lat, lng, pays, ville, zonesParVille),
      adresse: place.formatted_address ?? '',
      latitude: lat,
      longitude: lng,
      placeId: place.place_id,
    });
  }

  const extraits = candidats.length;
  candidats.forEach((c, i) => { c.id = `etab-${prochainNumero + i}`; });

  // Trois couches de dédoublonnage : le place_id (signal exact propre à Google, court-circuite
  // le reste) PUIS le même scoring nom/adresse/GPS que le scraping externe — contre TOUTES les
  // fiches existantes de cette ville/catégorie, ET contre les candidats DÉJÀ acceptés plus tôt
  // dans CE MÊME lot. Sans ce second point, Google peut renvoyer deux fiches distinctes
  // (place_id différents) pour le même lieu réel — ni l'une ni l'autre n'est "existante" au sens
  // de la base, donc aucune des deux ne reconnaît l'autre comme doublon (constaté en prod : 3
  // paires publiées en double, voir conversation).
  type CandidatClasse = ExtractionResultItem & { statut: 'doublon_confirme' | 'incertain' | 'nouveau'; matchExistant: FicheExistante | null };
  const classes: CandidatClasse[] = [];
  const poolComparaison: FicheExistante[] = [...existantsDetailles];
  for (const c of candidats) {
    if (placeIdsExistants.has(c.placeId)) {
      classes.push({ ...c, statut: 'doublon_confirme', matchExistant: null });
      continue;
    }
    // Comparaison inter-catégories (voir chargerExistantsAutresCategories) uniquement quand le
    // candidat lui-même est un nom de personne — une clinique/labo ne doit jamais être comparée
    // à un médecin d'une autre spécialité, trop ambigu pour être tranché par nom+GPS seuls.
    const poolElargi = estNomPersonnel(c.nom) ? [...poolComparaison, ...existantsAutresCategories] : poolComparaison;
    let meilleur: FicheExistante | null = null, meilleurScore = 0;
    for (const e of poolElargi) {
      const { score } = scoreCorrespondance(e, { nom: c.nom, adresse: c.adresse, lat: c.latitude, lng: c.longitude });
      if (score > meilleurScore) { meilleurScore = score; meilleur = e; }
    }
    const statut = classifierScore(meilleurScore);
    classes.push({ ...c, statut, matchExistant: meilleur });
    if (statut !== 'doublon_confirme') {
      poolComparaison.push({ id: c.id, nom: c.nom, adresse: c.adresse, lat: c.latitude, lng: c.longitude });
    }
  }

  const doublons = classes.filter((c) => c.statut === 'doublon_confirme');
  const aInserer = classes.filter((c) => c.statut !== 'doublon_confirme');
  const incertains = aInserer.filter((c) => c.statut === 'incertain');

  for (const etab of aInserer) {
    await pool.query(
      `INSERT INTO etablissements (id, nom, categorie, ville, quartier, arrondissement, adresse, latitude, longitude, source, place_id, statut, verification_requise, doublon_possible_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'brouillon',$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        etab.id, etab.nom, etab.categorie, etab.ville, etab.arrondissement, etab.arrondissement, etab.adresse, etab.latitude, etab.longitude,
        'Google Maps (automatisé)', etab.placeId,
        etab.statut === 'incertain', etab.statut === 'incertain' ? etab.matchExistant?.id ?? null : null,
      ]
    );
  }

  return {
    specialite, pays, ville, extraits,
    doublons: doublons.length,
    incertains: incertains.length,
    nombreNouveaux: aInserer.length - incertains.length,
    inseres: aInserer,
  };
}
