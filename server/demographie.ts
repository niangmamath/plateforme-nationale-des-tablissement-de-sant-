import { Pool } from 'pg';

// Script d'extraction démographique par zone — teste la faisabilité de remplacer la
// recherche manuelle de l'admin par 3 sources automatisées : HCP (population, pop15-59,
// pop60+), OpenStreetMap (surface -> densité) et Yakeey (prix_m2). loyer_m2 reste manuel
// (fincasa.ma n'est pas un outil paramétrable, voir conversation).

export interface DemographieZone {
  population: number | null;
  pop15_59: number | null;
  pop60_plus: number | null;
  densite: number | null;
  prixM2: number | null;
  lat: number | null;
  lng: number | null;
}

function enleverAccents(s: string): string {
  return s.normalize('NFD').replace(new RegExp('[̀-ͯ]', 'g'), '');
}

function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '') // enlève les accents
    .toLowerCase()
    .replace(/[-'\s]/g, ''); // enlève tirets, apostrophes, espaces
}

function slugifier(s: string): string {
  return s
    .normalize('NFD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Pas de config par ville : on interroge la table HCP sans filtre géographique (elle couvre
// tout le Maroc), puis on désambiguïse nous-mêmes en exigeant que la commune corresponde à la
// zone ET qu'un des segments (région/province) mentionne la ville — générique pour toute ville
// déjà présente dans notre table `villes`, sans code à ajouter pour chaque nouvelle ville.
async function recupererHCP(ville: string, nomZone: string): Promise<{ population: number | null; pop15_59: number | null; pop60_plus: number | null }> {
  const body = {
    datasource: { id: 84, type: 'table' },
    queries: [
      {
        columns: [
          { label: 'Zone', sqlExpression: "COALESCE(libelle_fr, '') || COALESCE(' -> ' || libelle_prov, '') || COALESCE(' -> ' || libelle_commune, '')" },
          'Milieu',
          'Sexe',
          'Key(Nom indicateur)',
        ],
        metrics: [{ expressionType: 'SIMPLE', column: { column_name: 'Value(valeur indicateur)' }, aggregate: 'SUM' }],
        filters: [
          { col: 'Key(Nom indicateur)', op: 'IN', val: ['Population municipale', 'Part de la population de 15-59 ans (%)', 'Part de la population de 60 ans et plus (%)'] },
          // "Ensemble" (urbain + rural) plutôt que "Urbain" seul : certaines zones bien réelles
          // (ex. Tassoultante à Marrakech, 106 000 hab.) sont classées 100% rurales par HCP et
          // renvoyaient "null" à tort avec le filtre précédent.
          { col: 'Milieu', op: 'IN', val: ['Ensemble'] },
          { col: 'Sexe', op: 'IN', val: ['Ensemble'] },
        ],
        row_limit: 20000,
        orderby: [],
      },
    ],
    result_format: 'json',
    result_type: 'full',
  };

  const res = await fetch('https://resultats2024.rgphapps.ma/api/v1/chart/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: any = await res.json();
  const rows: any[] = data.result?.[0]?.data ?? [];

  const cible = normaliser(nomZone);
  const villeCible = normaliser(ville);
  const candidats = rows.filter((r) => {
    const segments = String(r.Zone || '').split(' -> ');
    return segments.some((seg) => normaliser(seg).includes(villeCible));
  });

  // Certaines zones ont un préfixe ("El Maarif" chez nous vs "Maârif" chez HCP) qu'une
  // correspondance exacte rate — on retombe sur une correspondance approximative (l'un contient
  // l'autre) si l'exacte échoue. Ne corrige pas les vrais renommages (ex. "Roches Noires" vs
  // "Asoukhour Assawda"), qui n'ont aucune sous-chaîne commune : ça nécessite une table d'alias.
  let lignes = candidats.filter((r) => {
    const segments = String(r.Zone || '').split(' -> ');
    const commune = segments[segments.length - 1] || '';
    return normaliser(commune) === cible;
  });
  if (lignes.length === 0) {
    // Seuil de longueur : un nom court (ex. "Fès", la ville elle-même en tant que commune
    // agrégée) apparaît comme sous-chaîne de beaucoup de zones sans rapport (ex. "Méchouar
    // Fès Jdid") — on l'exclut pour éviter un faux positif qui donnerait des chiffres absurdes.
    lignes = candidats.filter((r) => {
      const segments = String(r.Zone || '').split(' -> ');
      const commune = normaliser(segments[segments.length - 1] || '');
      if (commune.length < 5) return false;
      return commune.includes(cible) || cible.includes(commune);
    });
  }

  const valeur = (indicateur: string) => {
    const ligne = lignes.find((r) => r['Key(Nom indicateur)'] === indicateur);
    return ligne ? Number(ligne['SUM(Value(valeur indicateur))']) : null;
  };

  return {
    population: valeur('Population municipale'),
    pop15_59: valeur('Part de la population de 15-59 ans (%)'),
    pop60_plus: valeur('Part de la population de 60 ans et plus (%)'),
  };
}

// Nominatim renvoie parfois un simple point (le nœud "place=suburb") au lieu du vrai contour
// administratif pour la même requête, de façon non déterministe d'un appel à l'autre (OSM a
// souvent les deux entités). On ne garde que les résultats avec un vrai polygone, et on
// retente quelques fois si besoin — plus simple et plus fiable qu'Overpass (API précise mais
// souvent surchargée sur les instances publiques) pour ce cas précis.
async function chercherPolygoneOSM(nomZone: string, ville: string, pays: string): Promise<any | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${nomZone}, ${ville}, ${pays}`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('polygon_geojson', '1');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'ma');

  const res = await fetch(url, { headers: { 'User-Agent': 'PlateformeNationaleSante-test/1.0 (usage ponctuel, contact admin du projet)' } });
  const results: any[] = await res.json();
  // Un nom de zone peut correspondre à un monument, un arrêt de bus, une école... (ex. "Hassan"
  // = aussi la Tour Hassan à Rabat) qui ont parfois eux-mêmes un petit polygone (empreinte du
  // bâtiment) — accepter n'importe quel polygone donnerait une surface ridiculement petite et
  // une densité absurde. On n'accepte que les résultats dont le type indique une vraie zone
  // administrative/quartier, pas un POI ponctuel qui a la forme d'un polygone par coïncidence.
  const TYPES_VALIDES = new Set(['administrative', 'suburb', 'city_district', 'quarter', 'neighbourhood', 'borough']);
  const avecPolygone = results.find(
    (r) => r.geojson && r.geojson.type !== 'Point' && r.geojson.type !== 'LineString' && (TYPES_VALIDES.has(r.type) || TYPES_VALIDES.has(r.addresstype) || r.class === 'boundary')
  );
  return avecPolygone?.geojson ?? null;
}

// Assemble les segments "outer" d'une relation Overpass en un seul anneau fermé — gère le cas
// courant (plusieurs tronçons de route mis bout à bout), pas les multipolygones avec trous
// (rare pour un arrondissement, et on préfère une petite sur-estimation de surface à rien).
function assemblerAnneau(members: any[]): [number, number][] | null {
  const ways = members.filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === '') && Array.isArray(m.geometry));
  if (ways.length === 0) return null;

  const segments = ways.map((w) => w.geometry.map((pt: any) => [pt.lon, pt.lat] as [number, number]));
  const memeSommet = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;

  const anneau: [number, number][] = [...segments[0]];
  const restants = segments.slice(1);
  while (restants.length > 0) {
    const dernier = anneau[anneau.length - 1];
    const idx = restants.findIndex((seg) => memeSommet(seg[0], dernier) || memeSommet(seg[seg.length - 1], dernier));
    if (idx === -1) break; // segments disjoints, on s'arrête avec ce qu'on a
    const seg = restants[idx];
    if (memeSommet(seg[0], dernier)) anneau.push(...seg.slice(1));
    else anneau.push(...seg.slice(0, -1).reverse());
    restants.splice(idx, 1);
  }
  if (!memeSommet(anneau[0], anneau[anneau.length - 1])) anneau.push(anneau[0]);
  return anneau.length >= 4 ? anneau : null;
}

const OVERPASS_MIROIRS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// Filet de sécurité quand Nominatim ne renvoie que le point (pas le contour) : interroge
// directement Overpass pour la relation "boundary=administrative" autour du centre de la ville
// (déjà connu via la table villes), plus lent/moins disponible que Nominatim mais plus précis.
async function chercherPolygoneOverpass(pool: Pool, nomZone: string, ville: string): Promise<any | null> {
  const { rows } = await pool.query('SELECT lat, lng FROM villes WHERE nom = $1', [ville]);
  if (rows.length === 0) return null;
  const lat = Number(rows[0].lat);
  const lng = Number(rows[0].lng);
  const marge = 0.15;
  // OSM tague tantôt sans accent ("Gueliz" alors qu'on cherche "Guéliz"), tantôt avec ("Ménara",
  // exactement comme on le cherche) — la regex Overpass est insensible à la casse mais pas aux
  // accents, donc une seule normalisation dans un sens ne suffit pas. On construit une alternative
  // (accentuée|désaccentuée) pour matcher les deux orthographes quel que soit le sens du décalage.
  const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&');
  const original = echapper(nomZone);
  const desaccente = echapper(enleverAccents(nomZone));
  const motif = original === desaccente ? original : `${original}|${desaccente}`;
  const requete = `[out:json][timeout:20];\nrelation["boundary"="administrative"]["name"~"${motif}",i](${lat - marge},${lng - marge},${lat + marge},${lng + marge});\nout geom;`;

  for (const miroir of OVERPASS_MIROIRS) {
    try {
      const res = await fetch(miroir, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(requete),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PlateformeNationaleSante-test/1.0 (usage ponctuel, contact admin du projet)',
          Accept: '*/*',
        },
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      const relation = data.elements?.[0];
      const anneau = relation ? assemblerAnneau(relation.members ?? []) : null;
      if (anneau) return { type: 'Polygon', coordinates: [anneau] };
    } catch {
      // miroir indisponible, on essaie le suivant
    }
  }
  return null;
}

interface SurfaceEtCentre {
  km2: number | null;
  lat: number | null;
  lng: number | null;
}

async function recupererSurfaceOSM(pool: Pool, nomZone: string, ville: string, pays: string): Promise<SurfaceEtCentre> {
  let geojson: any | null = null;
  for (let tentative = 0; tentative < 2 && !geojson; tentative++) {
    if (tentative > 0) await new Promise((r) => setTimeout(r, 1100)); // respecte la limite d'1 req/s de Nominatim
    geojson = await chercherPolygoneOSM(nomZone, ville, pays);
  }
  if (!geojson) geojson = await chercherPolygoneOverpass(pool, nomZone, ville);
  if (!geojson) return { km2: null, lat: null, lng: null };

  // Le centroïde du même contour donne les coordonnées du centre de la zone — jusqu'ici
  // recherchées manuellement par l'admin, on les récupère "gratuitement" au passage.
  const { rows } = await pool.query(
    `SELECT
       ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) / 1000000.0 AS km2,
       ST_Y(ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))) AS lat,
       ST_X(ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))) AS lng`,
    [JSON.stringify(geojson)]
  );
  const r = rows[0];
  return {
    km2: r?.km2 ? Number(r.km2) : null,
    lat: r?.lat != null ? Number(r.lat) : null,
    lng: r?.lng != null ? Number(r.lng) : null,
  };
}

function extrairePrixYakeey(html: string): number | null {
  const match = html.match(/(\d[\d\s]*)<!-- -->\s*<span class="[^"]*">DH\/m²<\/span>/);
  return match ? Number(match[1].replace(/\s/g, '')) : null;
}

// Yakeey organise ses quartiers par nom commercial/informel, pas par arrondissement officiel
// (le découpage HCP qu'on utilise pour nos zones) — "Agdal" ou "Saïss" n'existent pas tels
// quels chez eux, seulement des sous-quartiers comme "Menzeh Saiss". À défaut de page exacte,
// on cherche le quartier de leur liste dont le nom se rapproche le plus (résultat approximatif,
// mais mieux que rien).
async function trouverQuartierApprochantYakeey(villeSlug: string, nomZone: string): Promise<string | null> {
  const res = await fetch(`https://yakeey.com/fr-ma/referentiel-de-prix-immobilier/${villeSlug}`);
  if (!res.ok) return null;
  const html = await res.text();

  const cible = normaliser(nomZone);
  const slugs = new Set<string>();
  const regex = new RegExp(`referentiel-de-prix-immobilier/${villeSlug}/([a-z0-9-]+)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html))) slugs.add(m[1]);

  let meilleur: string | null = null;
  for (const slug of slugs) {
    const nomSlug = normaliser(slug.replace(/-/g, ' '));
    if (nomSlug === cible) return slug; // correspondance exacte trouvée dans la liste
    if ((nomSlug.includes(cible) || cible.includes(nomSlug)) && cible.length >= 4) {
      meilleur = meilleur ?? slug; // on garde la première correspondance partielle plausible
    }
  }
  return meilleur;
}

async function recupererPrixM2Yakeey(ville: string, nomZone: string): Promise<number | null> {
  const villeSlug = slugifier(ville);
  const url = `https://yakeey.com/fr-ma/referentiel-de-prix-immobilier/${villeSlug}/${slugifier(nomZone)}`;
  const res = await fetch(url);
  if (res.ok) {
    const prix = extrairePrixYakeey(await res.text());
    if (prix) return prix;
  }

  const approchant = await trouverQuartierApprochantYakeey(villeSlug, nomZone);
  if (!approchant) return null;
  const res2 = await fetch(`https://yakeey.com/fr-ma/referentiel-de-prix-immobilier/${villeSlug}/${approchant}`);
  if (!res2.ok) return null;
  return extrairePrixYakeey(await res2.text());
}

export async function extraireDemographieZone(pool: Pool, pays: string, ville: string, nomZone: string): Promise<DemographieZone> {
  const [hcp, surface, prixM2] = await Promise.all([
    recupererHCP(ville, nomZone),
    recupererSurfaceOSM(pool, nomZone, ville, pays),
    recupererPrixM2Yakeey(ville, nomZone),
  ]);

  // Garde-fou : la densité urbaine réelle la plus élevée au monde tourne autour de 100 000
  // hab/km². Une valeur bien au-delà signale presque sûrement un contour trop petit récupéré
  // par erreur (empreinte d'un bâtiment/monument plutôt que la vraie zone) — on préfère renvoyer
  // null (à corriger manuellement) plutôt qu'un chiffre absurde.
  const densiteBrute = hcp.population && surface.km2 ? hcp.population / surface.km2 : null;
  const densite = densiteBrute != null && densiteBrute <= 150000 ? Math.round(densiteBrute) : null;

  return {
    population: hcp.population,
    pop15_59: hcp.pop15_59,
    pop60_plus: hcp.pop60_plus,
    densite,
    prixM2,
    lat: surface.lat,
    lng: surface.lng,
  };
}

async function geocoderVille(ville: string, pays: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${ville}, ${pays}`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const res = await fetch(url, { headers: { 'User-Agent': 'PlateformeNationaleSante-test/1.0 (usage ponctuel, contact admin du projet)' } });
  const results: any[] = await res.json();
  if (results.length === 0) return null;
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

export interface ExtractionZoneSummary {
  id: string;
  nom: string;
  ville: string;
  pays: string;
  villeCreee: boolean;
  population: number | null;
  pop15_59: number | null;
  pop60_plus: number | null;
  densite: number | null;
  prixM2: number;
  prixM2Estime: boolean;
  loyerM2: number;
  loyerM2Estime: boolean;
}

const PRIX_M2_DEFAUT = 6000;
const LOYER_M2_DEFAUT = 45;

// Orchestre tout le flux "ajouter une zone depuis le formulaire admin" : crée le pays/la ville
// si nécessaire (géocodage), refuse une zone déjà enregistrée, extrait les données via les 3
// sources automatisées, et insère en brouillon avec une estimation par défaut si prix_m2/loyer_m2
// n'ont pas été trouvés (champs obligatoires en base, à corriger par l'admin si estimés).
export async function extraireEtInsererZone(pool: Pool, pays: string, ville: string, nomZone: string): Promise<ExtractionZoneSummary> {
  const { rows: paysRows } = await pool.query('SELECT id FROM pays WHERE nom = $1', [pays]);
  if (paysRows.length === 0) {
    throw new Error(`Pays inconnu : "${pays}". Créez-le d'abord dans Directus (collection Pays), puis publiez-le.`);
  }
  const paysId = paysRows[0].id;

  let villeRow = (await pool.query('SELECT id FROM villes WHERE nom = $1 AND pays_id = $2', [ville, paysId])).rows[0];
  let villeCreee = false;
  if (!villeRow) {
    const centre = await geocoderVille(ville, pays);
    if (!centre) {
      throw new Error(`Impossible de géolocaliser "${ville}" — vérifiez l'orthographe ou créez la ville manuellement dans Directus.`);
    }
    const villeId = slugifier(ville).toUpperCase().replace(/-/g, '');
    await pool.query(
      `INSERT INTO villes (id, pays_id, nom, lat, lng, zoom_base, statut) VALUES ($1,$2,$3,$4,$5,12,'brouillon')`,
      [villeId, paysId, ville, centre.lat, centre.lng]
    );
    villeRow = { id: villeId };
    villeCreee = true;
  }

  const cibleNormalisee = normaliser(nomZone);
  const { rows: zonesExistantes } = await pool.query('SELECT nom FROM zones WHERE ville_id = $1', [villeRow.id]);
  if (zonesExistantes.some((z) => normaliser(z.nom) === cibleNormalisee)) {
    throw new Error(`La zone "${nomZone}" existe déjà pour "${ville}" — pas de double enregistrement. Modifiez-la directement dans Directus si besoin.`);
  }

  const donnees = await extraireDemographieZone(pool, pays, ville, nomZone);
  if (!donnees.population || !donnees.lat || !donnees.lng) {
    throw new Error(
      `Données essentielles introuvables pour "${nomZone}" (${ville}) : population=${donnees.population}, lat=${donnees.lat}, lng=${donnees.lng}. ` +
      `Vérifiez l'orthographe exacte (celle du HCP) ou ajoutez cette zone manuellement dans Directus.`
    );
  }

  const prixM2Estime = donnees.prixM2 == null;
  const loyerM2Estime = true; // jamais automatisé, voir server/demographie.ts
  const id = slugifier(nomZone);

  await pool.query(
    `INSERT INTO zones (id, ville_id, nom, lat, lng, population, prix_m2, loyer_m2, pop15_59, pop60_plus, densite, statut)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'brouillon')`,
    [id, villeRow.id, nomZone, donnees.lat, donnees.lng, donnees.population, donnees.prixM2 ?? PRIX_M2_DEFAUT, LOYER_M2_DEFAUT, donnees.pop15_59, donnees.pop60_plus, donnees.densite]
  );

  return {
    id,
    nom: nomZone,
    ville,
    pays,
    villeCreee,
    population: donnees.population,
    pop15_59: donnees.pop15_59,
    pop60_plus: donnees.pop60_plus,
    densite: donnees.densite,
    prixM2: donnees.prixM2 ?? PRIX_M2_DEFAUT,
    prixM2Estime,
    loyerM2: LOYER_M2_DEFAUT,
    loyerM2Estime,
  };
}
