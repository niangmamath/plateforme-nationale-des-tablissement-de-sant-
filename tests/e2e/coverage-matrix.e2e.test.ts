import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import { createDriver, getSevereBrowserErrors } from './driver.js';
import {
  waitForAppReady,
  selectPays,
  selectVille,
  getTousLesPays,
  getToutesLesVilles,
  getToutesLesCategories,
  toggleCategorie,
  getRenderedEtablissementIds,
  getResultCount,
  findDuplicates,
} from './helpers.js';
import { BASE_URL } from './env.js';

/**
 * Couverture exhaustive : chaque pays, chaque ville de chaque pays, chaque catégorie,
 * et chaque combinaison (ville × catégorie) — vérifie l'absence de doublon rendu et
 * l'absence d'erreur JS pour CHAQUE combinaison individuellement.
 *
 * Note sur la portée : l'unicité des place_id est déjà garantie globalement par
 * no-duplicates.e2e.test.ts sur les données brutes de l'API — un filtre (quel qu'il
 * soit) ne peut que retirer des lignes d'un ensemble déjà sans doublon, jamais en
 * introduire. Ce test-ci vise donc un problème différent : un DOUBLON D'AFFICHAGE
 * (ex. bug de clé React qui rendrait deux fois la même carte) ou un plantage propre
 * à une combinaison précise — d'où la vérification combinaison par combinaison plutôt
 * qu'un simple test global.
 *
 * On ne teste pas les 2^N combinaisons de catégories multi-sélectionnées (256 pour 8
 * catégories, par ville) : au-delà de 2-3 catégories actives, c'est un test différent
 * (cf. filters.e2e.test.ts, cas "recherche + catégorie combinées") — ici on couvre
 * chaque catégorie SEULE sur CHAQUE ville, ce qui donne la grille complète ville ×
 * catégorie (56 cellules avec les données actuelles) sans exploser combinatoirement.
 */
describe('Couverture exhaustive villes × catégories', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it('aucune combinaison ville seule / catégorie seule / ville×catégorie ne produit de doublon ni d\'erreur', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);

    type Echec = { combinaison: string; probleme: string };
    const echecs: Echec[] = [];
    let nbCombinaisons = 0;

    const verifierEtatActuel = async (combinaison: string) => {
      nbCombinaisons += 1;
      const ids = await getRenderedEtablissementIds(driver);
      const badgeCount = await getResultCount(driver);
      const doublons = findDuplicates(ids);
      const erreurs = await getSevereBrowserErrors(driver);

      if (doublons.length > 0) {
        echecs.push({ combinaison, probleme: `${doublons.length} doublon(s) DOM: ${doublons.join(', ')}` });
      }
      // Liste virtualisée : seules les lignes visibles sont montées (ids.length <= badgeCount).
      // Un compteur affiché sans AUCUNE ligne rendue, en revanche, indique un problème réel.
      if (ids.length > badgeCount) {
        echecs.push({ combinaison, probleme: `plus de cartes rendues (${ids.length}) que le compteur (${badgeCount})` });
      }
      if (badgeCount > 0 && ids.length === 0) {
        echecs.push({ combinaison, probleme: `compteur à ${badgeCount} mais aucune carte rendue` });
      }
      if (erreurs.length > 0) {
        echecs.push({ combinaison, probleme: `${erreurs.length} erreur(s) JS: ${erreurs.slice(0, 2).join(' | ')}` });
      }
      console.log(`[couverture] ${combinaison} : ${ids.length} établissement(s)`);
    };

    const pays = await getTousLesPays(driver);
    for (const nomPays of pays) {
      await selectPays(driver, nomPays);
      const villes = await getToutesLesVilles(driver);

      for (const nomVille of villes) {
        await selectVille(driver, nomVille);
        await verifierEtatActuel(`${nomPays} / ${nomVille}`);

        const categories = await getToutesLesCategories(driver);
        for (const categorie of categories) {
          await toggleCategorie(driver, categorie);
          await verifierEtatActuel(`${nomPays} / ${nomVille} / ${categorie}`);
          await toggleCategorie(driver, categorie); // désélectionne avant la catégorie suivante
        }
      }
    }

    console.log(`[couverture] ${nbCombinaisons} combinaisons testées, ${echecs.length} échec(s)`);
    expect(echecs).toEqual([]);
  }, 20 * 60 * 1000);
});
