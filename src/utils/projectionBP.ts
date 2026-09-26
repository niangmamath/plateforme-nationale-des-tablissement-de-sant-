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

// Intérêts et capital remboursé par exercice civil (index 0 = année 1). Le crédit est débloqué au
// mois de démarrage et remboursé par mensualités constantes dès ce mois.
export function echeancierCredit(
  credit: number,
  tauxCreditPct: number,
  dureeAnnees: number,
  moisDemarrage: number,
  nbAnnees = NB_ANNEES
): { interets: number[]; capital: number[] } {
  const interets = new Array(nbAnnees).fill(0);
  const capital = new Array(nbAnnees).fill(0);
  const nbMensualites = Math.round(dureeAnnees * 12);
  if (credit <= 0 || nbMensualites <= 0) return { interets, capital };

  const r = tauxCreditPct / 100 / 12;
  const mensualite = r === 0 ? credit / nbMensualites : (credit * r) / (1 - Math.pow(1 + r, -nbMensualites));
  let restant = credit;
  for (let k = 0; k < nbMensualites; k++) {
    const indexAnnee = Math.floor((moisDemarrage - 1 + k) / 12);
    if (indexAnnee >= nbAnnees) break;
    const interetMois = restant * r;
    const capitalMois = mensualite - interetMois;
    interets[indexAnnee] += interetMois;
    capital[indexAnnee] += capitalMois;
    restant -= capitalMois;
  }
  return { interets, capital };
}

export function projeter(p: ParamsProjection): LigneAnnee[] {
  const mois = Math.min(12, Math.max(1, Math.round(p.moisDemarrage)));
  const joursAnneePleine = somme(p.joursParMois);
  const joursAnnee1 = somme(p.joursParMois.slice(mois - 1));
  const moisActifsAnnee1 = 13 - mois;

  const { interets, capital } = echeancierCredit(p.credit, p.tauxCreditPct, p.dureeCreditAnnees, mois);

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
