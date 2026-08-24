// Slugs vérifiés manuellement site par site (voir conversation) — chaque site a sa propre
// nomenclature de spécialités, aucune convention commune fiable pour la déduire automatiquement.
// `null` = spécialité absente du catalogue de ce site, pas une erreur de config.

export const VILLE_SLUGS: Record<string, string> = {
  Casablanca: 'casablanca',
  Fès: 'fes',
  Marrakech: 'marrakech',
  Rabat: 'rabat',
  Salé: 'sale',
  Tanger: 'tanger',
};

export interface CategorieSlugs {
  dabadoc: string | null;
  doctori: string | null;
  telecontact: string | null;
  medma: string | null;
}

// Clinique Privée est volontairement absente de cette table : aucun des 5 sites externes n'offre
// de listing propre pour les cliniques privées (DabaDoc/Doctori/Med.ma ne référencent que des
// praticiens individuels ; Medicalis.ma ne couvre que les centres d'ophtalmologie ; Télécontact
// ne propose qu'une recherche floue par mot-clé — "clinique" y remonte pêle-mêle des dentistes,
// centres de radiologie, etc.). Cette catégorie reste couverte uniquement par l'extraction Google
// Maps existante (server/extraction.ts).
export const CATEGORIE_SLUGS: Record<string, CategorieSlugs> = {
  Ophtalmologie: { dabadoc: 'ophtalmologue', doctori: 'ophtalmologue', telecontact: 'ophtalmologue', medma: 'ophtalmologiste' },
  Dentiste: { dabadoc: 'dentiste', doctori: 'chirurgien-dentiste', telecontact: 'dentiste', medma: 'dentiste' },
  Dermatologue: { dabadoc: 'dermatologue', doctori: 'dermatologue', telecontact: 'dermatologue', medma: 'dermatologue' },
  Radiologue: { dabadoc: 'radiologue', doctori: 'radiologue', telecontact: 'radiologue', medma: null },
  Orthopédiste: { dabadoc: 'orthopedie', doctori: null, telecontact: 'orthopediste', medma: null },
  'Médecin Généraliste': { dabadoc: 'medecin-generaliste', doctori: 'medecin-generaliste', telecontact: 'medecin-generaliste', medma: 'medecin-generaliste' },
  "Laboratoire d'Analyses Médicales": { dabadoc: null, doctori: null, telecontact: null, medma: 'laboratoire-danalyses-de-biologie-medicale' },
  // Gynécologue : DabaDoc/Doctori/Med.ma utilisent le terme complet "gynecologue-obstetricien"
  // (compte plus large que "gynecologue" seul sur DabaDoc — 297 vs 255 testé à Casablanca) ;
  // Télécontact ne référence que "gynecologue" (le suffixe "-obstetricien" y donne 0 résultat).
  Gynécologue: { dabadoc: 'gynecologue-obstetricien', doctori: 'gynecologue-obstetricien', telecontact: 'gynecologue', medma: 'gynecologue-obstetricien' },
  // Gastro-entérologue : Doctori nomme sa catégorie "gastrologue-enterologue" (et non
  // "gastro-enterologue" comme les 3 autres sites — testé, 404 sinon).
  'Gastro-entérologue': { dabadoc: 'gastro-enterologue', doctori: 'gastrologue-enterologue', telecontact: 'gastro-enterologue', medma: 'gastro-enterologue' },
  // ORL : absente de la page "spécialités" et du menu principal de DabaDoc, mais bien présente
  // dans le sélecteur complet de spécialités embarqué sur leur page d'accueil (source de vérité
  // trouvée après coup) sous un slug non devinable par simple normalisation du nom :
  // "oto-rhino-laryngologiste-orl" — 190 résultats réels confirmés à Casablanca. Les 3 autres
  // sites ont chacun leur propre orthographe du terme ("oto-rhino-laryngologue" pour Doctori,
  // "oto-rhino-laryngologiste" pour Télécontact) ; "orl" seul sur Télécontact remontait un
  // déménageur homonyme ("Bruno Orlando Déménagement") plutôt que des médecins.
  ORL: { dabadoc: 'oto-rhino-laryngologiste-orl', doctori: 'oto-rhino-laryngologue', telecontact: 'oto-rhino-laryngologiste', medma: 'oto-rhino-laryngologiste-orl' },
  // Oncologue : Doctori ne référence que "cancerologue" (peu de résultats mais réels, 2 testés à
  // Casablanca) ; Med.ma a aussi des sous-catégories "oncologue-radiotherapeute"/
  // "-chimiotherapeute" qui se recoupent partiellement avec "oncologue" sans le sur-ensemble
  // exact — le terme générique "oncologue" est conservé comme meilleur compromis.
  Oncologue: { dabadoc: 'oncologue-medical', doctori: 'cancerologue', telecontact: 'oncologue', medma: 'oncologue' },
  Néphrologue: { dabadoc: 'nephrologue', doctori: 'nephrologue', telecontact: 'nephrologue', medma: 'nephrologue' },
};

export const VILLES_CIBLES = Object.keys(VILLE_SLUGS);
export const CATEGORIES_CIBLES = Object.keys(CATEGORIE_SLUGS);

// Medicalis.ma : schéma d'URL à part, `codeVille` n'est PAS l'indicatif téléphonique régional
// (constaté en testant : 037/035/024/039 devinés par analogie avec les indicatifs réels
// donnaient tous une mauvaise ville) mais un identifiant interne au site, lu directement dans le
// menu déroulant réellement rendu par la page (peuplé en JS, invisible à un simple fetch HTML) et
// vérifié un par un contre le site (chaque code confirmé par le nom de ville dans le <title> de la
// page de résultats).
export const MEDICALIS_CODE_VILLE: Record<string, string> = {
  Casablanca: '022',
  Fès: '034',
  Marrakech: '054',
  Rabat: '067',
  Salé: '070',
  Tanger: '080',
};

// Seules 3 catégories vérifiées manuellement comme couvrant des PRATICIENS INDIVIDUELS (testé en
// direct sur Casablanca) : Chirurgiens-Dentistes, Médecin-généraliste et Radiologue remontent de
// vrais noms de médecins. "Centres-Ophtalmologie" existe aussi sur le site mais ne liste QUE des
// établissements (cliniques), pas des ophtalmologues — volontairement exclue pour ne pas polluer
// la catégorie "Ophtalmologie" avec des enseignes. Dermatologue, Orthopédiste, Laboratoire
// d'Analyses Médicales et Clinique Privée n'ont pas de slug correspondant trouvé sur le site.
export const MEDICALIS_CATEGORIE_SLUGS: Record<string, string> = {
  Dentiste: 'Chirurgiens-Dentistes',
  'Médecin Généraliste': 'Médecin-généraliste',
  Radiologue: 'Radiologue',
};
