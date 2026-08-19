// Dédoublonnage à signaux multiples pondérés : nom (Jaccard + distance d'édition + taux de
// couverture), téléphone normalisé, distance GPS (Haversine), similarité d'adresse. Renvoie un
// score 0-1 et les signaux ayant contribué, plutôt qu'un simple booléen — permet de distinguer
// "doublon confirmé" de "incertain, à vérifier manuellement". Utilisé à la fois par le scraping
// externe (server/scraping/orchestrateur.ts) et par l'extraction Google Maps (server/extraction.ts)
// — Google a en plus son place_id (signal exact, géré séparément par l'appelant), mais partage ce
// même scoring nom/adresse/GPS pour se dédoublonner contre les fiches venues des autres sources.

import type { Pool } from 'pg';

export interface FicheComparable {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface ResultatCorrespondance {
  score: number;
  signaux: string[];
}

// Mots génériques de catégorie/type d'établissement — sans ça, "Laboratoire Saoudi" et
// "Laboratoire LIAMS" (deux labos différents) partagent "laboratoire" et se retrouvent avec une
// similarité de nom artificiellement élevée alors que rien de spécifique à la personne/enseigne
// ne matche. Purement des mots-catégorie du domaine (établissements de santé), pas des noms.
const MOTS_GENERIQUES = new Set([
  'cabinet', 'centre', 'clinique', 'medecin', 'medecine', 'generale', 'generaliste',
  'chirurgien', 'chirurgie', 'dentaire', 'dentiste', 'laboratoire', 'analyses', 'medicale', 'medicales',
  'biologie', 'ophtalmologie', 'ophtalmologue', 'ophtalmologiste', 'ophthalmologiste', 'dermatologie',
  'dermatologue', 'radiologie', 'radiologue', 'orthopedie', 'orthopediste', 'traumatologie',
  'traumatologue', 'esthetique', 'sante', 'maladies', 'oeil', 'yeux', 'oculaire', 'vision',
  'prive', 'privee', 'service', 'adulte', 'adultes', 'enfant', 'enfants', 'pediatrique', 'de', 'des', 'du', 'et',
  // Équivalents anglais rencontrés dans des fiches importées ("BIKRI DENTAL CLINIC" vs "DENTAL
  // CLINIC" matchaient sur ces deux seuls mots) + villes couvertes (une raison sociale du type
  // "Chirurgien Dentiste Rabat" ne devient pas apparentée à une autre fiche pour la seule raison
  // qu'elle mentionne la même ville) + pays.
  'dental', 'clinic', 'medical', 'general', 'laboratory', 'doctor', 'private', 'center',
  'casablanca', 'fes', 'fez', 'kenitra', 'marrakech', 'marrakesh', 'rabat', 'sale', 'tanger', 'tangier',
  'maroc', 'morocco',
]);

// Mots d'institution/enseigne — servent à distinguer une fiche "personne" (un médecin identifié
// par son nom propre) d'une fiche "établissement/marque" (une clinique, un labo...). Le
// dédoublonnage inter-catégories (voir estNomPersonnel plus bas) n'est fiable QUE pour les fiches
// personne : deux médecins de spécialités différentes mais de même nom, à la même adresse, sont
// presque sûrement la même personne scrapée deux fois (constaté en prod : un scrape "Médecin
// Généraliste" avait réaspiré des dizaines de spécialistes déjà en base sous leur vraie
// catégorie). Mais une "Clinique X" et un "Centre de Radiologie X" qui partagent une enseigne
// peuvent très bien être deux services distincts du même établissement, pas un doublon à fusionner
// — impossible à trancher de façon fiable par nom+GPS seuls, donc on n'y touche pas.
const MOTS_INSTITUTION = new Set([
  'centre', 'clinique', 'cabinet', 'laboratoire', 'polyclinique', 'hopital', 'chu', 'dispensaire',
  'pharmacie', 'institut', 'residence', 'clinic', 'center', 'laboratory', 'hospital', 'pharmacy',
  'radiologie', 'radiology', 'imagerie',
]);

// Beaucoup de cabinets individuels sont nommés "Cabinet de Dermatologie - Dr X Y" ou "Centre
// Dentaire Y - Dr Z" : la présence d'un mot d'institution en préfixe ne veut pas dire que c'est
// une enseigne à plusieurs praticiens — dès qu'un titre (Dr/Pr) est suivi d'un nom propre, on sait
// qu'il y a UN médecin identifié derrière, quel que soit le préfixe. Ce n'est qu'en l'ABSENCE d'un
// tel titre qu'on retombe sur la liste de mots d'institution pour trancher.
const TITRE_SUIVI_DUN_NOM = /\b(dr|dre|pr|pre|docteur|professeur|prof)\.?\s+[a-z]{2,}(\s+[a-z]{2,}){0,3}/;

export function estNomPersonnel(nom: string): boolean {
  const normalise = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (TITRE_SUIVI_DUN_NOM.test(normalise)) return true;
  const tokens = normalise.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  return !tokens.some((t) => MOTS_INSTITUTION.has(t));
}

function normaliserNom(nom: string): string[] {
  return nom
    .replace(/\b(dr|dre|pr|pre|docteur|professeur|prof|mr|mme)\.?\b/gi, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    // Une apostrophe ("d'Ophtalmologie", "l'oeil") laisse un résidu d'une seule lettre après le
    // découpage — jamais un mot porteur de sens, mais qui matchait à tort dès qu'il restait seul
    // des deux côtés (ex. "Cabinet d'ophtalmologie" réduit à ce seul "d" après filtrage des mots
    // génériques, puis "détecté" comme identique à n'importe quel autre nom contenant une
    // apostrophe). Un vrai nom/prénom fait toujours au moins 2 lettres.
    .filter((t) => t.length >= 2 && !MOTS_GENERIQUES.has(t))
    .sort();
}

function normaliserTelephone(tel?: string | null): string | null {
  if (!tel) return null;
  const chiffres = tel.replace(/\D/g, '');
  if (chiffres.length < 9) return null;
  return chiffres.slice(-9); // 9 derniers chiffres = numéro national marocain sans indicatif
}

function normaliserAdresse(adresse?: string | null): string[] {
  return (adresse || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(rue|bd|boulevard|avenue|av|angle|residence|immeuble|imm|etage|apt|appartement|n°|ex|casablanca|maroc)\b\.?/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function distanceEdition(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return d[m][n];
}

function similariteJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

interface SimilariteNoms {
  score: number;
  // Jaccard/couverture seuls (mots réellement partagés) — la distance d'édition sur deux courtes
  // chaînes sans aucun mot commun donne facilement 0.15-0.25 par pur hasard de lettres partagées
  // ("lahata sophia" vs "asma bezzazi medical" → 0.20), un signal trop bruité pour, à lui seul,
  // autoriser le GPS/l'adresse à compter comme corroboration (voir scoreCorrespondance).
  chevauchementMots: number;
}

function similariteNoms(nom1: string, nom2: string): SimilariteNoms {
  const t1 = normaliserNom(nom1);
  const t2 = normaliserNom(nom2);
  const set1 = new Set(t1), set2 = new Set(t2);
  const jaccard = similariteJaccard(set1, set2);
  const s1 = t1.join(' ');
  const s2 = t2.join(' ');
  const distMax = Math.max(s1.length, s2.length, 1);
  const simEdition = 1 - distanceEdition(s1, s2) / distMax;
  // Les fiches DB sont souvent chargées de texte marketing ("Dr X, Ophtalmologue Casablanca
  // Cataracte SMILE LASIK..."), ce qui dilue Jaccard même quand le nom réel matche. Le taux de
  // couverture ne demande que "tous les mots du nom le plus court se retrouvent dans l'autre" —
  // robuste à cette pollution, tant que le nom court n'a pas lui-même du bruit.
  const intersection = [...set1].filter((t) => set2.has(t)).length;
  const tailleMin = Math.min(set1.size, set2.size) || 1;
  const couverture = intersection / tailleMin;
  // La couverture (containment) vaut 1.0 dès que le nom le plus court est entièrement inclus dans
  // l'autre — fiable quand ce nom court a plusieurs mots (ex. "Dr Chama Daoudi" dans un nom plus
  // long), mais trompeur s'il ne reste qu'UN seul mot après filtrage des génériques : ce mot peut
  // tout aussi bien être un nom de quartier ("Maarif", "Bab Doukkala") qu'un vrai patronyme — rien
  // ne les distingue structurellement. Dans ce cas on retombe sur Jaccard seul, mécaniquement
  // pénalisé par la taille du nom le plus long (ne "gagne" jamais 1.0 sur un seul mot partagé).
  const chevauchementMots = tailleMin >= 2 ? Math.max(jaccard, couverture) : jaccard;
  // La distance d'édition n'affine un score que s'il y a déjà au moins un mot commun (ex. un
  // prénom mal orthographié dans un nom par ailleurs identique) — livrée seule, elle produit un
  // score non nul même sans aucun mot partagé, sur la seule coïncidence de lettres communes
  // (suffixes de patronymes marocains très fréquents comme "-aoui" : "Yahyaoui" vs "Chennaoui").
  const score = chevauchementMots > 0 ? Math.max(chevauchementMots, simEdition) : chevauchementMots;
  return { score, chevauchementMots };
}

export function distanceGpsMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function scoreCorrespondance(a: FicheComparable, b: FicheComparable): ResultatCorrespondance {
  const tel1 = normaliserTelephone(a.telephone);
  const tel2 = normaliserTelephone(b.telephone);
  if (tel1 && tel2 && tel1 === tel2) {
    return { score: 0.97, signaux: ['téléphone identique (signal décisif)'] };
  }

  const { score: simNom, chevauchementMots } = similariteNoms(a.nom, b.nom);

  // Un nom complet (prénom + nom) quasi-identique est déjà un signal fort à lui seul. On ne le
  // laisse pas être dilué par une adresse mal comparable (formats hétérogènes d'une source à
  // l'autre : certains sites ne donnent qu'un quartier) — sauf contradiction GPS, seul signal
  // fiable de "ce n'est PAS le même endroit" quand il est disponible des 2 côtés. Seuil resserré
  // à 400m (au lieu de 1500m) après avoir constaté en prod des dizaines de faux positifs à
  // 400m-1,5km : un nom de quartier ("Maarif", "Agdal", "Sidi Moumen") survit souvent seul comme
  // "mot partagé" après filtrage des mots génériques, et matche alors n'importe quel autre
  // établissement du même quartier — liste de quartiers à exclure sans fin à maintenir, donc on
  // se fie plutôt à la distance réelle : les vrais doublons observés sont tous sous 300m.
  if (simNom >= 0.92) {
    let contradictionGps = false;
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      contradictionGps = distanceGpsMetres(a.lat, a.lng, b.lat, b.lng) > 400;
    }
    if (!contradictionGps) {
      return { score: 0.9, signaux: [`nom complet quasi-identique (${simNom.toFixed(2)}, signal fort)`] };
    }
  }

  const composantes: { poids: number; similarite: number; label?: string }[] = [];
  composantes.push({ poids: 0.55, similarite: simNom });

  // Deux cabinets différents partagent souvent le même immeuble/quartier (très courant en ville :
  // "résidence médicale", polyclinique) — le GPS ou l'adresse seuls ne prouvent donc jamais que
  // c'est la même personne. Ils ne comptent que comme signal CORROBORANT un nom qui partage déjà
  // un minimum de MOTS réels (chevauchementMots, pas simNom) — la distance d'édition seule sur de
  // courtes chaînes sans aucun mot commun donne facilement 0.15-0.25 par pur hasard de lettres
  // partagées ("lahata sophia" vs "asma bezzazi medical" → 0.20), trop bruitée pour ce rôle de
  // garde-fou (constaté empiriquement : deux médecins sans aucun rapport passaient "incertain"
  // sur le seul GPS avant ce correctif).
  const nomAssezProcheePourCorroborer = chevauchementMots >= 0.15;

  if (nomAssezProcheePourCorroborer && a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const dist = distanceGpsMetres(a.lat, a.lng, b.lat, b.lng);
    const simGps = dist < 40 ? 1 : dist < 150 ? 0.7 : dist < 400 ? 0.3 : 0;
    composantes.push({ poids: 0.3, similarite: simGps, label: `GPS à ${Math.round(dist)}m` });
  }

  if (nomAssezProcheePourCorroborer && a.adresse && b.adresse) {
    const simAdr = similariteJaccard(new Set(normaliserAdresse(a.adresse)), new Set(normaliserAdresse(b.adresse)));
    composantes.push({ poids: 0.2, similarite: simAdr, label: `adresse (${simAdr.toFixed(2)})` });
  }

  const poidsTotal = composantes.reduce((s, c) => s + c.poids, 0);
  let score = composantes.reduce((s, c) => s + c.poids * c.similarite, 0) / poidsTotal;

  // Deux téléphones connus mais différents : signal faible contre (un cabinet peut changer de
  // ligne), pas éliminatoire à lui seul, mais fait légèrement baisser le score composite.
  if (tel1 && tel2 && tel1 !== tel2) score *= 0.85;

  const signaux: string[] = [];
  if (simNom >= 0.85) signaux.push(`nom quasi-identique (${simNom.toFixed(2)})`);
  else if (simNom >= 0.5) signaux.push(`nom proche (${simNom.toFixed(2)})`);
  composantes.slice(1).forEach((c) => { if (c.similarite >= 0.3 && c.label) signaux.push(c.label); });
  if (tel1 && tel2 && tel1 !== tel2) signaux.push('téléphones différents (léger doute)');

  return { score: Math.min(score, 1), signaux };
}

export const SEUIL_DOUBLON_CONFIRME = 0.75;
// Volontairement bas : rater un doublon (insertion silencieuse) coûte plus cher que
// sur-solliciter la relecture manuelle. En cas de doute, on préfère faire vérifier.
export const SEUIL_INCERTAIN = 0.35;

export type StatutCorrespondance = 'doublon_confirme' | 'incertain' | 'nouveau';

export function classifierScore(score: number): StatutCorrespondance {
  if (score >= SEUIL_DOUBLON_CONFIRME) return 'doublon_confirme';
  if (score >= SEUIL_INCERTAIN) return 'incertain';
  return 'nouveau';
}

// Fusion multi-sources par MEILLEUR score (pas premier match trouvé) : chaque nouvel
// enregistrement rejoint le groupe déjà fusionné avec le score le plus haut, à condition qu'il
// dépasse le seuil de confirmation — évite les fusions en chaîne incorrectes (A~B, B~C, A≠C).
export interface FicheScrapee extends FicheComparable {
  source: string;
}

export interface FicheFusionnee extends FicheComparable {
  sources: string[];
}

export function fusionnerParScore(enregistrements: FicheScrapee[]): FicheFusionnee[] {
  const groupes: FicheFusionnee[] = [];
  for (const r of enregistrements) {
    let meilleur: FicheFusionnee | null = null, meilleurScore = 0;
    for (const g of groupes) {
      const { score } = scoreCorrespondance(g, r);
      if (score > meilleurScore) { meilleurScore = score; meilleur = g; }
    }
    if (meilleur && meilleurScore >= SEUIL_DOUBLON_CONFIRME) {
      if (!meilleur.sources.includes(r.source)) meilleur.sources.push(r.source);
      if (!meilleur.adresse && r.adresse) meilleur.adresse = r.adresse;
      if (!meilleur.telephone && r.telephone) meilleur.telephone = r.telephone;
      if (meilleur.lat == null && r.lat != null) { meilleur.lat = r.lat; meilleur.lng = r.lng; }
    } else {
      groupes.push({ nom: r.nom, adresse: r.adresse, telephone: r.telephone, lat: r.lat, lng: r.lng, sources: [r.source] });
    }
  }
  return groupes;
}

export interface FicheExistante extends FicheComparable {
  id: string;
}

export async function chargerExistants(pool: Pool, categorie: string, ville: string): Promise<FicheExistante[]> {
  const { rows } = await pool.query(
    `SELECT id, nom, adresse, latitude AS lat, longitude AS lng FROM etablissements WHERE categorie = $1 AND ville = $2`,
    [categorie, ville]
  );
  return rows;
}

// Fiches d'AUTRES catégories, même ville, pré-filtrées aux noms de personne (voir
// estNomPersonnel) — n'inclut jamais de clinique/labo/centre, pour ne comparer entre catégories
// que ce qui peut être comparé sans ambiguïté : un médecin avec un médecin.
export async function chargerExistantsAutresCategories(pool: Pool, categorie: string, ville: string): Promise<FicheExistante[]> {
  const { rows } = await pool.query(
    `SELECT id, nom, adresse, latitude AS lat, longitude AS lng FROM etablissements WHERE categorie != $1 AND ville = $2`,
    [categorie, ville]
  );
  return rows.filter((r) => estNomPersonnel(r.nom));
}

export interface ResultatClassification extends FicheFusionnee {
  statut: StatutCorrespondance;
  meilleurScore: number;
  matchExistant: FicheExistante | null;
  signaux: string[];
}

export function classifierContreExistants(
  candidats: FicheFusionnee[],
  existants: FicheExistante[],
  existantsAutresCategories: FicheExistante[] = []
): ResultatClassification[] {
  return candidats.map((f) => {
    // La comparaison inter-catégories ne s'applique qu'aux candidats "personne" — voir
    // estNomPersonnel : le pool existantsAutresCategories est déjà filtré côté chargement, mais il
    // faut aussi que LE CANDIDAT lui-même soit un nom de personne pour que le rapprochement ait un
    // sens (sinon une "Clinique X" pourrait matcher à tort un "Dr X" d'une autre spécialité).
    const pool = estNomPersonnel(f.nom) ? [...existants, ...existantsAutresCategories] : existants;
    let meilleur: FicheExistante | null = null, meilleurScore = 0, signauxRetenus: string[] = [];
    for (const e of pool) {
      const { score, signaux } = scoreCorrespondance(e, f);
      if (score > meilleurScore) { meilleurScore = score; meilleur = e; signauxRetenus = signaux; }
    }
    return { ...f, statut: classifierScore(meilleurScore), meilleurScore, matchExistant: meilleur, signaux: signauxRetenus };
  });
}
