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
};

export const VILLES_CIBLES = Object.keys(VILLE_SLUGS);
export const CATEGORIES_CIBLES = Object.keys(CATEGORIE_SLUGS);
