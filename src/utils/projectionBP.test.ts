import { describe, expect, it } from 'vitest';
import { echeancierCredit, JOURS_PAR_MOIS_DEFAUT, projeter, type ParamsProjection } from './projectionBP';

const base: ParamsProjection = {
  caParJour: 1000,
  joursParMois: new Array(12).fill(JOURS_PAR_MOIS_DEFAUT),
  moisDemarrage: 1,
  anneeDemarrage: 2026,
  croissanceCA: 0.05,
  croissanceCharges: 0.05,
  chargesExternesAnnuelles: 60000,
  loyerMensuel: 0,
  masseSalarialeMensuelle: 10000,
  baseAmortAmenagements: 100000,
  tauxAmortAmenagements: 10,
  baseAmortMateriel: 200000,
  tauxAmortMateriel: 15,
  credit: 0,
  tauxCreditPct: 5,
  dureeCreditAnnees: 7,
  calculerImpot: () => 0,
};

describe('projeter — année 1', () => {
  it('démarrage en janvier : année pleine, 300 jours (ancienne base du générateur)', () => {
    const [a1] = projeter(base);
    expect(a1.moisActifs).toBe(12);
    expect(a1.joursTravailles).toBe(300);
    expect(a1.ca).toBe(300000);
    expect(a1.personnel).toBe(120000);
    expect(a1.chargesExternes).toBe(60000);
  });

  it('démarrage en avril : 9 mois, prorata du personnel, des charges et des amortissements', () => {
    const [a1] = projeter({ ...base, moisDemarrage: 4 });
    expect(a1.moisActifs).toBe(9);
    expect(a1.joursTravailles).toBe(225);
    expect(a1.ca).toBe(225000);
    expect(a1.personnel).toBe(90000);
    expect(a1.chargesExternes).toBe(45000);
    expect(a1.dotations).toBeCloseTo((100000 * 0.1 + 200000 * 0.15) * 0.75, 6);
  });

  it('respecte des jours travaillés différents selon le mois, et ignore ceux avant le démarrage', () => {
    const jours = new Array(12).fill(20);
    jours[0] = 99; // janvier : avant le démarrage, ne doit pas compter en année 1
    const [a1, a2] = projeter({ ...base, joursParMois: jours, moisDemarrage: 2 });
    expect(a1.joursTravailles).toBe(11 * 20);
    expect(a2.joursTravailles).toBe(99 + 11 * 20); // mais compte en année pleine
  });
});

describe('projeter — années suivantes', () => {
  it('CA et charges croissent de 5 % par an à partir de la valeur annualisée de l\'année 1', () => {
    const lignes = projeter({ ...base, moisDemarrage: 7 });
    const [, a2, a3, a4, a5] = lignes;
    expect(a2.ca).toBeCloseTo(300000 * 1.05, 6); // année pleine × 1,05, pas 6 mois × 1,05
    expect(a3.ca).toBeCloseTo(300000 * 1.05 ** 2, 6);
    expect(a5.ca).toBeCloseTo(300000 * 1.05 ** 4, 6);
    expect(a2.personnel).toBeCloseTo(120000 * 1.05, 6);
    expect(a4.chargesExternes).toBeCloseTo(60000 * 1.05 ** 3, 6);
  });

  it('croissances indépendantes : CA stable, charges à +5 %', () => {
    const [, a2] = projeter({ ...base, croissanceCA: 0 });
    expect(a2.ca).toBe(300000);
    expect(a2.personnel).toBeCloseTo(126000, 6);
  });

  it('les années sont des exercices civils consécutifs', () => {
    expect(projeter({ ...base, anneeDemarrage: 2027 }).map((l) => l.annee)).toEqual([2027, 2028, 2029, 2030, 2031]);
  });

  it('le loyer suit les charges (location)', () => {
    const [a1, a2] = projeter({ ...base, loyerMensuel: 5000 });
    expect(a1.loyer).toBe(60000);
    expect(a2.loyer).toBeCloseTo(63000, 6);
  });

  it('les amortissements restent fixes et ne dépassent jamais la valeur amortie', () => {
    const lignes = projeter({ ...base, baseAmortMateriel: 100000, tauxAmortMateriel: 40 });
    // matériel : 40 000, 40 000, 20 000 (plafonné), puis 0 ; aménagements : 10 000 par an
    expect(lignes.map((l) => l.dotations)).toEqual([50000, 50000, 30000, 10000, 10000]);
  });

  it('résultat net = résultat avant impôt − impôt, année par année', () => {
    const lignes = projeter({ ...base, credit: 300000, calculerImpot: (r) => Math.max(0, r) * 0.2 });
    for (const l of lignes) {
      expect(l.resultatExploitation).toBeCloseTo(l.ca - l.chargesExternes - l.loyer - l.personnel - l.dotations, 6);
      expect(l.resultatAvantImpot).toBeCloseTo(l.resultatExploitation - l.interets, 6);
      expect(l.resultatNet).toBeCloseTo(l.resultatAvantImpot - l.impot, 6);
    }
  });
});

describe('echeancierCredit', () => {
  it('rembourse exactement le capital sur la durée (démarrage en janvier)', () => {
    const { capital, interets } = echeancierCredit(500000, 4.65, 4, 1, 5);
    expect(capital.reduce((a, b) => a + b, 0)).toBeCloseTo(500000, 4);
    expect(capital[4]).toBeCloseTo(0, 6); // crédit de 4 ans : rien à rembourser en année 5
    expect(interets[0]).toBeGreaterThan(interets[1]);
    expect(interets[1]).toBeGreaterThan(interets[2]);
  });

  it('un démarrage en cours d\'année étale le crédit sur davantage d\'exercices civils', () => {
    const { capital } = echeancierCredit(500000, 5, 3, 10, 5);
    expect(capital[0]).toBeGreaterThan(0); // octobre → décembre
    expect(capital[3]).toBeGreaterThan(0); // encore des mensualités l'année 4
    expect(capital.reduce((a, b) => a + b, 0)).toBeCloseTo(500000, 4);
  });

  it('taux nul : capital réparti linéairement, aucun intérêt', () => {
    const { capital, interets } = echeancierCredit(120000, 0, 2, 1, 5);
    expect(interets.every((i) => i === 0)).toBe(true);
    expect(capital[0]).toBeCloseTo(60000, 6);
  });

  it('sans crédit ou sans durée : rien', () => {
    expect(echeancierCredit(0, 5, 7, 1).interets.every((i) => i === 0)).toBe(true);
    expect(echeancierCredit(100000, 5, 0, 1).capital.every((c) => c === 0)).toBe(true);
  });
});
