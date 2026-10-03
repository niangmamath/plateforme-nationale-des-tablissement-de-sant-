// Prévisionnel sur 5 exercices civils du business plan — calcul pur, sans React, pour pouvoir être
// testé indépendamment du composant.
//
// Conventions :
// - L'année 1 va du mois de démarrage au 31 décembre ; les années 2 à 5 sont des années pleines.
// - CA et charges (externes, personnel, loyer) croissent chacun à leur taux : année n = valeur
//   annualisée de l'année 1 × (1 + taux)^(n-1). L'année 1 reste calculée sur ses mois réels.
// - Les dotations aux amortissements sont linéaires et fixes (plafonnées à la valeur à amortir).
// - Les intérêts viennent d'un échéancier mensuel à annuités constantes, qui démarre au mois de
//   démarrage : ils diminuent d'année en année.
// - Un résultat avant impôt négatif est reporté et s'impute sur les bénéfices des années suivantes
//   (dans l'ordre), avant calcul de l'impôt. Le report légal étant limité à quelques exercices (4 selon
//   le CGI, à confirmer avec un comptable), cela ne joue pas ici : sur 5 ans, un déficit de l'année 1
//   reste imputable jusqu'à l'année 5.

export const NB_ANNEES = 5;
export const JOURS_PAR_MOIS_DEFAUT = 25; // 25 j/mois × 12 = 300 j/an, l'ancienne base du générateur

export interface ParamsProjection {
  caParJour: number;
  joursParMois: number[]; // 12 valeurs (janvier → décembre), jours travaillés en année pleine
  moisDemarrage: number; // 1 = janvier … 12 = décembre
  anneeDemarrage: number;
  croissanceCA: number; // ex. 0.05
  croissanceCharges: number; // ex. 0.05
  chargesExternesAnnuelles: number;
  loyerMensuel: number; // 0 si achat
  masseSalarialeMensuelle: number;
  baseAmortAmenagements: number;
  tauxAmortAmenagements: number; // en %, ex. 10
  baseAmortMateriel: number;
  tauxAmortMateriel: number; // en %, ex. 15
  credit: number;
  tauxCreditPct: number; // en %/an, ex. 4.65
  dureeCreditAnnees: number;
  dureeDiffereMois?: number; // 0 par défaut (pas de différé)
  typeDiffere?: TypeDiffere;
  calculerImpot: (resultatAvantImpot: number) => number;
}

export interface LigneAnnee {
  rang: number; // 1 à 5
  annee: number; // exercice civil
  moisActifs: number;
  joursTravailles: number;
  ca: number;
  chargesExternes: number;
  loyer: number;
  personnel: number;
  dotations: number;
  resultatExploitation: number;
  interets: number;
  capitalRembourse: number;
  resultatAvantImpot: number;
  deficitImpute: number; // déficits des années précédentes imputés sur le bénéfice de l'année
  resultatImposable: number; // bénéfice après imputation (0 si déficit)
  impot: number;
  resultatNet: number;
}

const somme = (valeurs: number[]) => valeurs.reduce((a, b) => a + b, 0);

export interface LigneMensualite {
  mois: number; // 1 = premier mois du crédit (relatif au déblocage, pas un mois calendaire)
  mensualite: number;
  interets: number;
  capital: number;
  capitalRestantDu: number; // après paiement de cette mensualité
}

// Les trois différés de remboursement couramment proposés au Maroc (durée du crédit = durée totale,
// différé inclus — ex. "7 ans dont 24 mois de différé" veut dire 24 mois de différé puis 60 mois
// d'amortissement) :
// - 'capital'        : seuls les intérêts sont payés pendant le différé, le capital ne bouge pas.
// - 'interetCapital' : rien n'est payé ; les intérêts courus sont capitalisés (ajoutés au capital
//                      restant dû), qui est donc plus élevé qu'au départ une fois le différé terminé.
// - 'interet'         : le capital continue d'être remboursé par tranches linéaires (sur la durée
//                      totale) pendant le différé, mais les intérêts ne sont pas payés : ils sont
//                      capitalisés comme ci-dessus.
// Intérêts capitalisés = intérêts SIMPLES (calculés sur le capital restant dû au début du différé,
// pas sur un solde qui grossirait chaque mois) : vérifié en reproduisant au centime près le résultat
// du simulateur Al Moukawil Chaabi (Banque Populaire) sur un crédit test (100 000 DH, 2 %/an, 24 mois
// de différé, 84 mois de durée totale → 1 822,89 DH/mois, identique). Des intérêts composés
// (intérêts sur intérêts mois après mois) donneraient une mensualité légèrement plus élevée.
// Dans les trois cas, l'amortissement (annuités constantes) reprend après le différé sur le capital
// restant à ce moment-là et sur les mois restants.
export type TypeDiffere = 'aucun' | 'capital' | 'interet' | 'interetCapital';

// Tableau d'amortissement complet d'un crédit à annuités constantes, indépendant de tout calendrier
// d'exploitation — c'est le calcul de base du simulateur de crédit autonome, réutilisé par
// echeancierCredit ci-dessous pour l'agréger par exercice civil dans le CPC prévisionnel.
export function tableauAmortissement(
  credit: number,
  tauxAnnuelPct: number,
  dureeAnnees: number,
  dureeDiffereMois = 0,
  typeDiffere: TypeDiffere = 'aucun'
): LigneMensualite[] {
  const nbMensualites = Math.round(dureeAnnees * 12);
  if (credit <= 0 || nbMensualites <= 0) return [];

  const r = tauxAnnuelPct / 100 / 12;
  const nbDiffere = typeDiffere === 'aucun' ? 0 : Math.min(Math.max(0, Math.round(dureeDiffereMois)), nbMensualites - 1);
  const nbAmortissement = nbMensualites - nbDiffere;

  let restant = credit; // solde affiché (capitalRestantDu) et base de l'amortissement après le différé
  // Base des intérêts simples du différé : ne baisse que si du capital est réellement remboursé
  // (type 'interet'), n'augmente jamais — contrairement à `restant`, qui peut capitaliser des
  // intérêts. Les intérêts d'un mois de différé portent toujours sur cette base, jamais sur des
  // intérêts déjà capitalisés les mois précédents (pas d'intérêts composés pendant le différé).
  let baseInteretDiffere = credit;
  const lignes: LigneMensualite[] = [];

  for (let k = 0; k < nbDiffere; k++) {
    const interetMois = baseInteretDiffere * r;
    let capitalMois = 0;
    let mensualite: number;
    if (typeDiffere === 'capital') {
      mensualite = interetMois; // capital inchangé
    } else if (typeDiffere === 'interetCapital') {
      mensualite = 0;
      restant += interetMois; // intérêts capitalisés (simples, cf. baseInteretDiffere ci-dessus)
    } else {
      // 'interet' : tranche de capital linéaire sur la durée totale, intérêts capitalisés.
      capitalMois = Math.min(credit / nbMensualites, baseInteretDiffere);
      mensualite = capitalMois;
      restant = restant - capitalMois + interetMois;
      baseInteretDiffere -= capitalMois;
    }
    lignes.push({ mois: k + 1, mensualite, interets: interetMois, capital: capitalMois, capitalRestantDu: Math.max(0, restant) });
  }

  const mensualiteConstante = r === 0 ? restant / nbAmortissement : (restant * r) / (1 - Math.pow(1 + r, -nbAmortissement));
  for (let k = 0; k < nbAmortissement; k++) {
    const interetMois = restant * r;
    // Dernière mensualité : solde le capital restant plutôt que d'accumuler un écart d'arrondi.
    const capitalMois = k === nbAmortissement - 1 ? restant : mensualiteConstante - interetMois;
    restant -= capitalMois;
    lignes.push({ mois: nbDiffere + k + 1, mensualite: interetMois + capitalMois, interets: interetMois, capital: capitalMois, capitalRestantDu: Math.max(0, restant) });
  }

  return lignes;
}

export interface RecapCredit {
  lignes: LigneMensualite[];
  nbDiffere: number;
  mensualiteDiffere: number | null; // null si pas de différé
  mensualiteApres: number; // mensualité "normale", après différé s'il y en a un
  coutTotalCredit: number;
  totalRembourse: number;
}

// Résumé d'un crédit (mensualités, coût total, total remboursé) — calcul partagé entre
// TableauAmortissementCredit (cartes + tableau détaillé) et les pages de simulateur qui affichent
// leur propre bandeau récapitulatif, pour ne pas dupliquer cette logique à plusieurs endroits.
export function calculerRecapCredit(
  montant: number,
  tauxPct: number,
  dureeAnnees: number,
  dureeDiffereMois = 0,
  typeDiffere: TypeDiffere = 'aucun'
): RecapCredit {
  const lignes = tableauAmortissement(montant, tauxPct, dureeAnnees, dureeDiffereMois, typeDiffere);
  const nbMoisTotal = Math.round(dureeAnnees * 12);
  const nbDiffere = typeDiffere === 'aucun' ? 0 : Math.min(Math.max(0, Math.round(dureeDiffereMois)), Math.max(0, nbMoisTotal - 1));
  return {
    lignes,
    nbDiffere,
    mensualiteDiffere: nbDiffere > 0 ? (lignes[0]?.mensualite ?? 0) : null,
    mensualiteApres: lignes[nbDiffere]?.mensualite ?? 0,
    coutTotalCredit: lignes.reduce((acc, l) => acc + l.interets, 0),
    totalRembourse: lignes.reduce((acc, l) => acc + l.mensualite, 0),
  };
}

// Intérêts et capital remboursé par exercice civil (index 0 = année 1). Le crédit est débloqué au
// mois de démarrage et remboursé par mensualités constantes dès ce mois.
export function echeancierCredit(
  credit: number,
  tauxCreditPct: number,
  dureeAnnees: number,
  moisDemarrage: number,
  nbAnnees = NB_ANNEES,
  dureeDiffereMois = 0,
  typeDiffere: TypeDiffere = 'aucun'
): { interets: number[]; capital: number[] } {
  const interets = new Array(nbAnnees).fill(0);
  const capital = new Array(nbAnnees).fill(0);
  for (const ligne of tableauAmortissement(credit, tauxCreditPct, dureeAnnees, dureeDiffereMois, typeDiffere)) {
    const indexAnnee = Math.floor((moisDemarrage - 1 + ligne.mois - 1) / 12);
    if (indexAnnee >= nbAnnees) break;
    interets[indexAnnee] += ligne.interets;
    capital[indexAnnee] += ligne.capital;
  }
  return { interets, capital };
}

export function projeter(p: ParamsProjection): LigneAnnee[] {
  const mois = Math.min(12, Math.max(1, Math.round(p.moisDemarrage)));
  const joursAnneePleine = somme(p.joursParMois);
  const joursAnnee1 = somme(p.joursParMois.slice(mois - 1));
  const moisActifsAnnee1 = 13 - mois;

  const { interets, capital } = echeancierCredit(p.credit, p.tauxCreditPct, p.dureeCreditAnnees, mois, NB_ANNEES, p.dureeDiffereMois ?? 0, p.typeDiffere ?? 'aucun');

  // Restant à amortir par catégorie, pour ne jamais dépasser la valeur d'origine.
  let restantAmenagements = p.baseAmortAmenagements;
  let restantMateriel = p.baseAmortMateriel;
  let deficitsReportables = 0;

  return Array.from({ length: NB_ANNEES }, (_, i) => {
    const rang = i + 1;
    const partielle = rang === 1;
    const moisActifs = partielle ? moisActifsAnnee1 : 12;
    const proportion = moisActifs / 12;
    const joursTravailles = partielle ? joursAnnee1 : joursAnneePleine;

    const facteurCA = partielle ? 1 : Math.pow(1 + p.croissanceCA, i);
    const facteurCharges = partielle ? 1 : Math.pow(1 + p.croissanceCharges, i);

    const ca = p.caParJour * joursTravailles * facteurCA;
    const chargesExternes = p.chargesExternesAnnuelles * proportion * facteurCharges;
    const loyer = p.loyerMensuel * moisActifs * facteurCharges;
    const personnel = p.masseSalarialeMensuelle * moisActifs * facteurCharges;

    const dotationAmenagements = Math.min(restantAmenagements, p.baseAmortAmenagements * (p.tauxAmortAmenagements / 100) * proportion);
    const dotationMateriel = Math.min(restantMateriel, p.baseAmortMateriel * (p.tauxAmortMateriel / 100) * proportion);
    restantAmenagements -= dotationAmenagements;
    restantMateriel -= dotationMateriel;
    const dotations = dotationAmenagements + dotationMateriel;

    const resultatExploitation = ca - chargesExternes - loyer - personnel - dotations;
    const resultatAvantImpot = resultatExploitation - interets[i];
    // Déficit : reporté (impôt nul). Bénéfice : on impute d'abord les déficits reportés.
    let deficitImpute = 0;
    if (resultatAvantImpot < 0) {
      deficitsReportables += -resultatAvantImpot;
    } else {
      deficitImpute = Math.min(resultatAvantImpot, deficitsReportables);
      deficitsReportables -= deficitImpute;
    }
    const resultatImposable = Math.max(0, resultatAvantImpot - deficitImpute);
    const impot = p.calculerImpot(resultatImposable);

    return {
      rang,
      annee: p.anneeDemarrage + i,
      moisActifs,
      joursTravailles,
      ca,
      chargesExternes,
      loyer,
      personnel,
      dotations,
      resultatExploitation,
      interets: interets[i],
      capitalRembourse: capital[i],
      resultatAvantImpot,
      deficitImpute,
      resultatImposable,
      impot,
      resultatNet: resultatAvantImpot - impot,
    };
  });
}
