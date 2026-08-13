import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { By, WebDriver } from 'selenium-webdriver';
import { createDriver } from './driver.js';
import { waitForAppReady, selectVille, toggleCategorie, getResultCount, measureUntilStable } from './helpers.js';
import { BASE_URL } from './env.js';

/**
 * Seuils avec marge (liste latérale virtualisée + marqueurs carte clusterés/ajoutés en
 * bloc, mais la recherche texte n'a toujours pas de debounce — limitation connue, pas
 * encore corrigée). Ces tests ne visent pas une cible de perf idéale mais à détecter
 * une RÉGRESSION nette (site qui redevient plusieurs fois plus lent, ou qui ne se
 * stabilise plus du tout). Les temps mesurés sont loggués à chaque run pour suivre la
 * tendance dans le temps.
 */
describe('Performance perçue', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it('chargement initial + sélection de la ville la plus dense (Casablanca) < 10s', async () => {
    const start = Date.now();
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');
    const elapsed = Date.now() - start;
    console.log(`[perf] chargement initial + Casablanca : ${elapsed}ms`);
    expect(elapsed).toBeLessThan(10000);
  });

  it('changement de ville (Casablanca -> Rabat) < 8s', async () => {
    const elapsed = await measureUntilStable(
      () => selectVille(driver, 'Rabat'),
      () => getResultCount(driver)
    );
    console.log(`[perf] changement de ville Casablanca -> Rabat : ${elapsed}ms`);
    expect(elapsed).toBeLessThan(8000);
  });

  it('application d\'un filtre catégorie < 8s', async () => {
    const elapsed = await measureUntilStable(
      () => toggleCategorie(driver, 'Ophtalmologie'),
      () => getResultCount(driver)
    );
    console.log(`[perf] filtre catégorie "Ophtalmologie" : ${elapsed}ms`);
    expect(elapsed).toBeLessThan(8000);
    await toggleCategorie(driver, 'Ophtalmologie'); // remise à zéro pour le test suivant
  });

  it('la recherche texte reste réactive après la frappe < 5s', async () => {
    const search = await driver.findElement(By.id('search-input'));
    const elapsed = await measureUntilStable(
      () => search.sendKeys('Anfa'),
      () => getResultCount(driver)
    );
    console.log(`[perf] recherche texte "Anfa" (Rabat) : ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});
