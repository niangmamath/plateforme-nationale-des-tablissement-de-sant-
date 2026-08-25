// Nettoie un nom d'établissement scrapé pour l'affichage — ne touche jamais aux données stockées
// (le `nom` brut reste la source de vérité en base). Les fiches sont souvent chargées de texte
// marketing ("Dr X Y - Spécialité Ville Actes...") ou d'un préfixe d'enseigne avant le vrai nom
// ("Cabinet ORL - Dr X Y") — cette fonction extrait juste "Titre Prénom Nom" quand c'est repérable,
// et se rabat sur un nettoyage plus léger (troncature au premier séparateur marketing) sinon.

// Un mojibake (texte arabe UTF-8 mal ré-interprété en Latin-1) contient presque toujours "Ø" —
// byte de tête très fréquent dans l'UTF-8 arabe, absent des noms français/berbères authentiques.
// Ces chaînes sont déjà signalées comme irrécupérables côté base (voir dedup.ts) : ne jamais les
// transformer, normalize('NFKC') les déforme encore davantage plutôt que de les nettoyer.
const MOJIBAKE = /Ø/;

// Titre en tête, insensible à la casse ("dr"/"Dr"/"DR" équivalents) — mais uniquement pour
// repérer sa position. Espace optionnel (pas obligatoire) après le point : "Dr.EL KISSOUNI"
// (aucun espace après "Dr.") est une variante d'écriture courante, pas un cas à part.
const TITRE = /\b(dr|dre|pr|pre|docteur|professeur)\.?\s*/i;
// Capture du nom volontairement insensible à la casse : un prénom/nom saisi en minuscules par la
// source ("dr TORABI lamiaa") est courant et ne doit jamais être coupé — quitte à laisser passer
// un mot de texte marketing en minuscules non couvert par MOTS_A_ECARTER (quartier/ville rares) en
// échange de ne jamais perdre une partie réelle du nom.
const MOT_NOM = /^[A-Za-zÀ-ÿ][\wÀ-ÿ'’.-]*$/;
const SEPARATEUR_MARKETING = /\s*[-–—:|]\s|\s*\(/;
// Un 2e titre plus loin dans la chaîne ("Dr X, Dr Y") signale un 2e médecin listé sous la même
// fiche — le nom du premier s'arrête là, jamais absorbé comme s'il faisait partie du même nom.
const MOT_TITRE = /^(dr|dre|pr|pre|docteur|professeur)\.?$/i;

// Mots de spécialité/enseigne qui restent parfois collés au nom faute de séparateur ("Dr X Y
// Cabinet Dentaire", "Dr X Y Psychiatrie") — capitalisés comme un vrai nom, donc indiscernables du
// nom par la seule casse. Repris de la logique de mots-catégorie déjà établie côté dédoublonnage
// (server/scraping/dedup.ts, MOTS_GENERIQUES) : mêmes mots-catégorie du domaine, jamais des noms.
const MOTS_A_ECARTER = new Set([
  'cabinet', 'centre', 'clinique', 'medecin', 'médecin', 'generale', 'générale', 'generaliste',
  'généraliste', 'chirurgien', 'chirurgie', 'dentaire', 'dentiste', 'laboratoire', 'analyses',
  'medicale', 'médicale', 'medicales', 'médicales', 'biologie', 'ophtalmologie', 'ophtalmologue',
  'ophtalmologiste', 'dermatologie', 'dermatologue', 'radiologie', 'radiologue', 'orthopedie',
  'orthopédie', 'orthopediste', 'orthopédiste', 'traumatologie', 'traumatologue', 'gynecologie',
  'gynécologie', 'gynecologue', 'gynécologue', 'gastro-enterologue', 'gastro-entérologue',
  'nephrologue', 'néphrologue', 'oncologue', 'orl', 'psychiatre', 'psychiatrie', 'urologue',
  'esthetique', 'esthétique', 'sante', 'santé', 'prive', 'privée', 'polyclinique',
  'specialiste', 'spécialiste', 'expert', 'assermente', 'assermenté',
]);

function titreCasse(mot: string): string {
  if (mot.length <= 3 && mot === mot.toUpperCase()) return mot; // sigles courts (RB, CMS...) inchangés
  return mot
    .toLowerCase()
    .split(/([\s'’-])/)
    .map((p) => (/[\s'’-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
}

export function nomAffichage(nomBrut: string): string {
  if (!nomBrut || MOJIBAKE.test(nomBrut)) return nomBrut;
  const normalise = nomBrut.normalize('NFKC').trim();

  const matchTitre = normalise.match(TITRE);
  if (matchTitre) {
    const apresTitre = normalise.slice((matchTitre.index ?? 0) + matchTitre[0].length);
    const motsNom: string[] = [];
    for (const motBrut of apresTitre.split(/\s+/)) {
      // Une virgule ou parenthèse fermante collée au dernier mot ("Boulegriss,", "Samai)") ne
      // doit pas faire échouer sa reconnaissance — seul un vrai séparateur (espace) sépare les mots.
      const mot = motBrut.replace(/[,):;-]+$/, '');
      if (motsNom.length >= 4 || !MOT_NOM.test(mot) || MOTS_A_ECARTER.has(mot.toLowerCase()) || MOT_TITRE.test(mot)) break;
      motsNom.push(mot);
    }
    if (motsNom.length >= 1) {
      const titre = titreCasse(matchTitre[1]);
      const nomPropre = motsNom.map(titreCasse).join(' ');
      if (nomPropre.length >= 2) return `${titre} ${nomPropre}`;
    }
  }

  const segments = normalise.split(SEPARATEUR_MARKETING);
  const premierSegment = segments[0]?.trim();
  if (premierSegment && premierSegment.length >= 4) {
    // Le premier segment est déjà propre (enseigne ou nom sans titre détecté) — pas de
    // recasse forcée : une enseigne existante ("3Dental", "RB DENTAL") a sa propre typographie
    // volontaire, la modifier serait plus risqué que de la laisser telle quelle.
    return premierSegment;
  }

  return normalise;
}
