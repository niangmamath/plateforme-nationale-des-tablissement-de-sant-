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
  // string[] : DabaDoc éclate parfois une spécialité en plusieurs catégories distinctes de son
  // propre menu (constaté pour Oncologue — voir plus bas), chacune avec sa propre pagination et
  // des listes qui se chevauchent sans être identiques. Un seul slug sous-couvrait alors largement
  // la spécialité réelle.
  dabadoc: string | string[] | null;
  // string[] : constaté sur Doctori.ma pour Oncologue — "cancerologue" (2 praticiens) sous-couvrait
  // largement "oncologue-medicale" (7 praticiens, dont 5 absents du premier slug) ; Doctori.ma
  // fragmente donc parfois ses spécialités comme DabaDoc, même mécanisme de fusion multi-slugs.
  doctori: string | string[] | null;
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
  // "gastro-enterologue" comme les 3 autres sites — testé, 404 sinon). DabaDoc a aussi
  // "hepatologue" et "proctologue" en catégories séparées (recoupement partiel avec
  // "gastro-enterologue" mais pas total — vérifié à Casablanca, ~3/13 proctologues non recoupés).
  'Gastro-entérologue': { dabadoc: ['gastro-enterologue', 'hepatologue', 'proctologue'], doctori: 'gastrologue-enterologue', telecontact: 'gastro-enterologue', medma: 'gastro-enterologue' },
  // ORL : absente de la page "spécialités" et du menu principal de DabaDoc, mais bien présente
  // dans le sélecteur complet de spécialités embarqué sur leur page d'accueil (source de vérité
  // trouvée après coup) sous un slug non devinable par simple normalisation du nom :
  // "oto-rhino-laryngologiste-orl" — 190 résultats réels confirmés à Casablanca. Les 3 autres
  // sites ont chacun leur propre orthographe du terme ("oto-rhino-laryngologue" pour Doctori,
  // "oto-rhino-laryngologiste" pour Télécontact) ; "orl" seul sur Télécontact remontait un
  // déménageur homonyme ("Bruno Orlando Déménagement") plutôt que des médecins.
  ORL: { dabadoc: 'oto-rhino-laryngologiste-orl', doctori: 'oto-rhino-laryngologue', telecontact: 'oto-rhino-laryngologiste', medma: 'oto-rhino-laryngologiste-orl' },
  // Oncologue : DabaDoc éclate l'oncologie en plusieurs catégories distinctes de son propre menu —
  // "oncologue-medical" seul ne couvrait qu'une fraction du réel (vérifié à Casablanca : les 7
  // slugs ci-dessous se recoupent partiellement mais chacun apporte des médecins que les autres
  // n'ont pas — confirmé via le sitemap DabaDoc par ville, qui liste "chirurgien-cancerologue"
  // comme slug distinct de "chirurgien-oncologue", faible volume mais réel). "Sénologue"
  // (spécialiste du sein, souvent non-oncologue — radiologue/gynécologue) volontairement exclu
  // pour ne pas polluer la catégorie. Med.ma a aussi des sous-catégories
  // "oncologue-radiotherapeute"/"-chimiotherapeute" qui se recoupent partiellement avec "oncologue"
  // sans le sur-ensemble exact — le terme générique "oncologue" est conservé comme meilleur
  // compromis pour ce site.
  Oncologue: {
    dabadoc: ['oncologue-medical', 'oncologue-cancerologue', 'chirurgien-oncologue', 'chirurgien-cancerologue', 'radiotherapeute', 'hematologue', 'oncologie-pediatrique'],
    // Doctori.ma fragmente aussi (voir doctori dans CategorieSlugs plus haut) : "cancerologue" seul
    // ne couvrait que 2 praticiens à Casablanca contre 7 sous "oncologue-medicale" — recoupement
    // partiel avec "radiotherapeute", mêmes 3 slugs scrapés que DabaDoc pour la même raison.
    doctori: ['cancerologue', 'oncologue-medicale', 'radiotherapeute'], telecontact: 'oncologue', medma: 'oncologue',
  },
  Néphrologue: { dabadoc: 'nephrologue', doctori: 'nephrologue', telecontact: 'nephrologue', medma: 'nephrologue' },
  // Endocrinologue : DabaDoc distingue "endocrinologue" et "diabetologue" (recoupement partiel,
  // même mécanisme qu'Oncologue ci-dessus) — les deux slugs sont scrapés. Doctori nomme sa
  // catégorie "endocrinologue-maladies-metaboliques" (pas "endocrinologue" seul, 404 sinon —
  // vérifié). Med.ma non vérifié (rendu en JS, pas de fetch statique possible) : laissé absent
  // plutôt que de risquer un slug faux qui pollue silencieusement les résultats.
  Endocrinologue: { dabadoc: ['endocrinologue', 'diabetologue'], doctori: 'endocrinologue-maladies-metaboliques', telecontact: 'endocrinologue', medma: null },
  // Anatomopathologiste : Doctori orthographie sa catégorie avec un tiret ("anatomo-pathologiste"),
  // contrairement à DabaDoc/Télécontact ("anatomopathologiste" en un mot) — vérifié, 404 sinon.
  // Med.ma non vérifié, laissé absent (même raison qu'Endocrinologue ci-dessus).
  Anatomopathologiste: { dabadoc: 'anatomopathologiste', doctori: 'anatomo-pathologiste', telecontact: 'anatomopathologiste', medma: null },
  // Pédiatre : DabaDoc liste aussi de nombreuses sous-spécialités pédiatriques distinctes
  // (pédopsychiatre, neuropédiatre, chirurgien pédiatre, oncologie pédiatrique...) — volontairement
  // exclues ici, hors périmètre du "pédiatre généraliste" demandé. Med.ma non vérifié (même raison).
  Pédiatre: { dabadoc: 'pediatre', doctori: 'pediatre', telecontact: 'pediatre', medma: null },
  // Cardiologue : slug identique sur les 4 sites, vérifié directement (retours 200 avec de vraies
  // fiches sur chacun). Volontairement distinct de "chirurgien-cardiaque"/"chirurgien-cardio-vasculaire"
  // (DabaDoc) et "chirurgien-cardio-vasculaire" (Doctori) — des catégories séparées sur ces sites,
  // jamais mélangées avec "cardiologue" : les exclure suffit à écarter les chirurgiens, demandé
  // explicitement.
  Cardiologue: { dabadoc: 'cardiologue', doctori: 'cardiologue', telecontact: 'cardiologue', medma: 'cardiologue' },
  // Neurologue : même logique — "neurochirurgien" (DabaDoc et Doctori) est une catégorie distincte
  // de "neurologue", jamais scrapée ici, ce qui écarte les chirurgiens comme demandé.
  Neurologue: { dabadoc: 'neurologue', doctori: 'neurologue', telecontact: 'neurologue', medma: 'neurologue' },
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

// Catégories vérifiées manuellement comme couvrant des PRATICIENS INDIVIDUELS (testé en
// direct sur Casablanca) : Chirurgiens-Dentistes, Médecin-généraliste et Radiologue remontent de
// vrais noms de médecins. "Centres-Ophtalmologie" existe aussi sur le site mais ne liste QUE des
// établissements (cliniques), pas des ophtalmologues — volontairement exclue pour ne pas polluer
// la catégorie "Ophtalmologie" avec des enseignes. Dermatologue, Orthopédiste, Laboratoire
// d'Analyses Médicales et Clinique Privée n'ont pas de slug correspondant trouvé sur le site.
// Cardiologue/Neurologue ajoutés — "Cardiologue" et "Neurologue" testés propres (que des noms de
// praticiens, aucune clinique) ; "Cardiologie" contenait au moins une enseigne (CLINIQUE ALMADINA)
// donc écartée pour Cardiologue. "Neurologie" en revanche remonte des praticiens tout aussi propres
// que "Neurologue" mais un ensemble partiellement différent (même fragmentation que DabaDoc/Doctori
// ailleurs) — les deux slugs sont donc scrapés pour Neurologue.
// Anatomopathologiste testé (Anatomo-pathologiste, Anatomopathologiste, Anatomo-Pathologistes) :
// 0 résultat sur les 3 — pas de catégorie correspondante sur ce site, laissé absent.
// Endocrinologue/Néphrologue/ORL/Pédiatre : même fragmentation constatée que Neurologue plus haut
// (plusieurs slugs valides, ensembles qui se recoupent sans être identiques).
// Oncologue : le slug "Oncologue" lui-même ne renvoie rien (0 résultat) — seuls "Cancerologue",
// "Oncologie" et "Cancerologie" fonctionnent (testés, praticiens individuels réels).
// Gynécologue : "Gynecologie-Obstetrique" ne remonte que 2 fiches, toutes deux des cliniques
// (HOPITAL CHEIKH KHALIFA IBN ZAID, INTERNATIONAL CLINIC) — écarté comme "Centres-Ophtalmologie"
// plus haut ; seul "Gynecologue" garde des praticiens individuels.
export const MEDICALIS_CATEGORIE_SLUGS: Record<string, string | string[]> = {
  Dentiste: 'Chirurgiens-Dentistes',
  'Médecin Généraliste': 'Médecin-généraliste',
  Radiologue: 'Radiologue',
  Cardiologue: 'Cardiologue',
  Neurologue: ['Neurologue', 'Neurologie'],
  Endocrinologue: ['Endocrinologue', 'Endocrinologie', 'Diabetologue'],
  'Gastro-entérologue': ['Gastro-enterologue', 'Gastro-Entérologue'],
  Gynécologue: 'Gynecologue',
  Néphrologue: ['Nephrologue', 'Nephrologie'],
  ORL: ['ORL', 'Oto-Rhino-Laryngologiste'],
  Oncologue: ['Cancerologue', 'Oncologie', 'Cancerologie'],
  Pédiatre: ['Pediatre', 'Pediatrie'],
};
