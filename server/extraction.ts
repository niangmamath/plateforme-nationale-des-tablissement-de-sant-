import { Pool } from 'pg';

interface SpecialiteExtractionConfig {
  requete: string;
  inclus: string[];
  exclus: string[];
  typesRequis: string[];
}

interface ZoneCentroid {
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
  nombreNouveaux: number;
  nouveaux: ExtractionResultItem[];
}

function cleZonesParVille(pays: string, ville: string): string {
  return `${pays.trim().toLowerCase()}::${ville.trim().toLowerCase()}`;
}

// Clé composite pays+ville : deux pays peuvent avoir une ville du même nom (ex. Fès/Maroc
// vs une éventuelle ville homonyme ailleurs), donc on ne peut pas se fier au nom de ville seul.
async function chargerZonesParVille(pool: Pool): Promise<Record<string, ZoneCentroid[]>> {
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

async function chargerConfigSpecialite(pool: Pool, specialite: string): Promise<SpecialiteExtractionConfig | null> {
  const { rows } = await pool.query(
    'SELECT requete, mots_inclus, mots_exclus, types_google FROM specialite_extraction WHERE id = $1',
    [specialite]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { requete: r.requete, inclus: r.mots_inclus, exclus: r.mots_exclus, typesRequis: r.types_google };
}

async function chargerPlaceIdsExistants(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query('SELECT place_id FROM etablissements WHERE place_id IS NOT NULL');
  return new Set(rows.map((r) => r.place_id));
}

// Les établissements saisis à la main suivent le schéma "etab-N" — on continue cette
// numérotation pour les établissements extraits automatiquement, au lieu d'y mettre le
// place_id Google (déjà stocké séparément dans la colonne place_id, utilisée pour le dédoublonnage).
async function prochainNumeroEtablissement(pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX((substring(id from '^etab-(\\d+)$'))::int), -1) + 1 AS suivant FROM etablissements`
  );
  return Number(rows[0].suivant);
}

function trouverArrondissementLePlusProche(lat: number, lng: number, pays: string, ville: string, zonesParVille: Record<string, ZoneCentroid[]>): string {
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

export async function extraireEtInserer(
  pool: Pool,
  specialite: string,
  pays: string,
  ville: string
): Promise<ExtractionSummary> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY non définie.');

  const [config, zonesParVille, placeIdsExistants, prochainNumero] = await Promise.all([
    chargerConfigSpecialite(pool, specialite),
    chargerZonesParVille(pool),
    chargerPlaceIdsExistants(pool),
    prochainNumeroEtablissement(pool),
  ]);

  if (!config) {
    throw new Error(
      `Spécialité inconnue : "${specialite}". Ajoutez-la d'abord dans Directus (collection "Spécialités — extraction") ` +
      `avec sa requête de recherche et ses mots-clés inclus/exclus, puis relancez l'extraction.`
    );
  }

  if (!zonesParVille[cleZonesParVille(pays, ville)]) {
    throw new Error(
      `Aucune zone connue pour "${ville}" (${pays}) — impossible de calculer l'arrondissement. ` +
      `Ajoutez d'abord le pays, la ville et ses zones (avec centroïdes) dans Directus, publiez-les, puis relancez l'extraction.`
    );
  }

  const query = `${config.requete} ${ville}, ${pays}`;
  const placesResults = await rechercherGooglePlaces(query, apiKey);

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
  const nouveaux = candidats.filter((c) => !placeIdsExistants.has(c.placeId));
  const doublons = extraits - nouveaux.length;

  nouveaux.forEach((etab, i) => {
    etab.id = `etab-${prochainNumero + i}`;
  });

  for (const etab of nouveaux) {
    await pool.query(
      `INSERT INTO etablissements (id, nom, categorie, ville, quartier, arrondissement, adresse, latitude, longitude, source, place_id, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'brouillon')
       ON CONFLICT (id) DO NOTHING`,
      [etab.id, etab.nom, etab.categorie, etab.ville, etab.arrondissement, etab.arrondissement, etab.adresse, etab.latitude, etab.longitude, 'Google Maps (automatisé)', etab.placeId]
    );
  }

  return { specialite, pays, ville, extraits, doublons, nombreNouveaux: nouveaux.length, nouveaux };
}
