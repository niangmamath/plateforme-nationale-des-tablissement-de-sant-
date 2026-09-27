import { describe, expect, it } from 'vitest';
import { genererIntroduction, type ParametresIntroduction, type ZoneComparable, type VilleComparable } from './introductionZone';

const zone = (nom: string, overrides: Partial<ZoneComparable> = {}): ZoneComparable => ({
  nom,
  population: 100000,
  densite: 10000,
  prixM2: 10000,
  loyerM2: 50,
  pop0_14: 20,
  pop15_59: 60,
  pop60_plus: 20,
  concurrenceCount: 5,
  autresSpecCount: 3,
  ...overrides,
});

const villeDe = (nom: string, concurrenceTotale: number): VilleComparable => ({ nom, concurrenceTotale });

const base: ParametresIntroduction = {
  zone: zone('Agdal', { population: 126463, densite: 5721, prixM2: 7500, loyerM2: 45, pop0_14: 17.6, pop15_59: 58.7, pop60_plus: 23.7, concurrenceCount: 2, autresSpecCount: 4 }),
  ville: 'Fès',
  zonesVille: [
    zone('Agdal', { population: 126463, densite: 5721, prixM2: 7500, loyerM2: 45, pop0_14: 17.6, pop15_59: 58.7, pop60_plus: 23.7, concurrenceCount: 2 }),
    zone('Saïss', { population: 236305, densite: 11702, prixM2: 6500, loyerM2: 50, pop0_14: 23.8, pop15_59: 61.9, pop60_plus: 14.4, concurrenceCount: 5 }),
    zone('Zouagha', { population: 358435, densite: 11206, prixM2: 5500, loyerM2: 40, pop0_14: 28.6, pop15_59: 60.6, pop60_plus: 10.8, concurrenceCount: 8 }),
  ],
  villes: [villeDe('Fès', 15), villeDe('Casablanca', 49), villeDe('Rabat', 12), villeDe('Marrakech', 8)],
  specialiteNom: 'Neurologie',
};

describe('genererIntroduction — profil de la zone', () => {
  it('inclut le nom, la population et la densité', () => {
    const [profil] = genererIntroduction(base);
    expect(profil).toContain('Agdal');
    expect(profil).toContain('126');
    expect(profil).toContain('463');
    expect(profil).toContain('5');
    expect(profil).toContain('721');
  });

  it('inclut les trois tranches d\'âge quand elles sont connues', () => {
    const [profil] = genererIntroduction(base);
    expect(profil).toContain('17,6 %');
    expect(profil).toContain('58,7 %');
    expect(profil).toContain('23,7 %');
  });

  it('omet la phrase des tranches d\'âge si une donnée manque (rien n\'est inventé)', () => {
    const params = { ...base, zone: { ...base.zone, pop0_14: null } };
    const [profil] = genererIntroduction(params);
    expect(profil).not.toContain('15-59');
    expect(profil).not.toMatch(/tranche|répartit/);
  });

  it('signale un écart de seniors par rapport à la moyenne de la ville, dans le bon sens', () => {
    const [profil] = genererIntroduction(base); // Agdal 23,7 % vs moyenne (23,7+14,4+10,8)/3 = 16,3
    expect(profil).toMatch(/supérieure à la moyenne/);
  });

  it('inclut le prix et le loyer au m²', () => {
    const [profil] = genererIntroduction(base);
    expect(profil).toContain('7');
    expect(profil).toContain('500 DH');
    expect(profil).toContain('45 DH');
  });
});

describe('genererIntroduction — concurrence locale', () => {
  it('mentionne le nombre de concurrents et la spécialité', () => {
    const [, concurrence] = genererIntroduction(base);
    expect(concurrence).toContain('2 établissements de Neurologie');
  });

  it('dit "aucun" plutôt que "0" sans concurrent', () => {
    const params = { ...base, zone: { ...base.zone, concurrenceCount: 0 } };
    const [, concurrence] = genererIntroduction(params);
    expect(concurrence).toMatch(/Aucun établissement/);
    expect(concurrence).not.toContain('0 établissement');
  });

  it('accorde singulier/pluriel correctement', () => {
    const params = { ...base, zone: { ...base.zone, concurrenceCount: 1, autresSpecCount: 1 } };
    const [, concurrence] = genererIntroduction(params);
    expect(concurrence).toContain('1 établissement de Neurologie');
    expect(concurrence).toMatch(/Un autre établissement.*y est recensé/);
  });
});

describe('genererIntroduction — comparaison aux zones de la ville', () => {
  it('classe correctement par population (Agdal est la moins peuplée des 3)', () => {
    const paras = genererIntroduction(base);
    const comparaison = paras.find((p) => p.includes('zones couvertes à Fès'))!;
    expect(comparaison).toContain('3e plus peuplée');
  });

  it('classe correctement par prix (Agdal a le prix le plus élevé des 3)', () => {
    const paras = genererIntroduction(base);
    const comparaison = paras.find((p) => p.includes('zones couvertes'))!;
    expect(comparaison).toMatch(/prix au m² le plus élevé/);
  });

  it('classe correctement par concurrence (Agdal est la moins concurrentielle des 3)', () => {
    const paras = genererIntroduction(base);
    const comparaison = paras.find((p) => p.includes('zones couvertes'))!;
    expect(comparaison).toMatch(/moins concurrentielle de la ville/);
  });

  it('est omise si la ville n\'a qu\'une seule zone couverte', () => {
    const params = { ...base, zonesVille: [base.zone] };
    const paras = genererIntroduction(params);
    expect(paras.some((p) => p.includes('zones couvertes'))).toBe(false);
  });

  it('rang médian correctement formulé (ni le plus bas ni le plus haut)', () => {
    const params: ParametresIntroduction = { ...base, zone: base.zonesVille[1], zonesVille: base.zonesVille }; // Saïss : prix médian
    const paras = genererIntroduction(params);
    const comparaison = paras.find((p) => p.includes('zones couvertes'))!;
    expect(comparaison).toMatch(/2e zone la moins chère sur 3/);
  });
});

describe('genererIntroduction — comparaison nationale', () => {
  it('situe la ville dans le classement national (Fès, 15, est 3e sur 4 : Marrakech 8, Rabat 12, Fès 15, Casablanca 49)', () => {
    const paras = genererIntroduction(base);
    const national = paras.find((p) => p.includes('échelle des'))!;
    expect(national).toContain('4 villes couvertes');
    expect(national).toContain('15 établissements de Neurologie');
    expect(national).toContain('rang 3 sur 4');
  });

  it('nomme la ville la moins et la plus concurrencée', () => {
    const paras = genererIntroduction(base);
    const national = paras.find((p) => p.includes('échelle des'))!;
    expect(national).toContain('Marrakech');
    expect(national).toContain('Casablanca');
  });

  it('est omise si une seule ville est couverte', () => {
    const params = { ...base, villes: [villeDe('Fès', 15)] };
    const paras = genererIntroduction(params);
    expect(paras.some((p) => p.includes('échelle des'))).toBe(false);
  });

  it('ne plante pas si la ville de la zone est absente de la liste des villes (garde-fou)', () => {
    const params = { ...base, villes: [villeDe('Casablanca', 49), villeDe('Rabat', 12)] };
    expect(() => genererIntroduction(params)).not.toThrow();
  });
});

describe('genererIntroduction — cohérence générale', () => {
  it('renvoie 4 paragraphes dans le cas complet', () => {
    expect(genererIntroduction(base)).toHaveLength(4);
  });

  it('chaque paragraphe est une chaîne non vide', () => {
    for (const p of genererIntroduction(base)) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    }
  });
});
