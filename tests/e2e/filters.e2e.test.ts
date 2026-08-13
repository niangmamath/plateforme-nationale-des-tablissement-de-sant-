import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { By, WebDriver, until } from 'selenium-webdriver';
import { createDriver, getSevereBrowserErrors } from './driver.js';
import {
  waitForAppReady,
  getRenderedEtablissementIds,
  getRenderedCategoryBadgeTexts,
  getResultCount,
  findDuplicates,
  selectVille,
} from './helpers.js';
import { BASE_URL } from './env.js';

describe('Filtres', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it('la sélection multi-catégories renvoie des résultats cohérents et sans doublons', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');

    await driver.findElement(By.id('filter-categorie')).click();
    const options = await driver.wait(
      until.elementsLocated(By.css('[role="listbox"] [role="option"]')),
      10000
    );
    expect(options.length).toBeGreaterThanOrEqual(2);

    const libellesChoisis: string[] = [];
    for (const opt of options.slice(0, 2)) {
      libellesChoisis.push(await opt.getText());
      await opt.click();
    }
    // Ferme le menu déroulant en cliquant ailleurs pour laisser la liste se stabiliser.
    await driver.findElement(By.css('body')).click();

    await driver.wait(async () => (await getRenderedEtablissementIds(driver)).length > 0, 15000);

    const ids = await getRenderedEtablissementIds(driver);
    const badgeCount = await getResultCount(driver);
    // Liste virtualisée : seules les lignes visibles sont montées, donc ids.length <= badgeCount
    // (jamais l'inverse — ça signalerait un doublon de rendu).
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(badgeCount);
    expect(findDuplicates(ids)).toEqual([]);

    // Chaque carte affichée doit appartenir à l'une des catégories cochées.
    const texteBadges = await getRenderedCategoryBadgeTexts(driver);
    expect(texteBadges.length).toBeGreaterThan(0);
    for (const texte of texteBadges) {
      const correspond = libellesChoisis.some((cat) => texte.toUpperCase().includes(cat.toUpperCase()));
      expect(correspond, `Badge "${texte}" hors des catégories sélectionnées (${libellesChoisis.join(', ')})`).toBe(true);
    }
  });

  it('la recherche texte filtre sans erreur JS ni doublons', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');

    const search = await driver.findElement(By.id('search-input'));
    await search.sendKeys('Anfa');

    // Laisse React re-render après la frappe.
    await driver.sleep(500);

    const ids = await getRenderedEtablissementIds(driver);
    expect(findDuplicates(ids)).toEqual([]);

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });

  it("une recherche sans résultat affiche l'état vide, pas une erreur", async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');

    const search = await driver.findElement(By.id('search-input'));
    await search.sendKeys('zzzzzz-recherche-improbable-zzzzzz');
    await driver.sleep(500);

    const ids = await getRenderedEtablissementIds(driver);
    expect(ids.length).toBe(0);

    const badgeCount = await getResultCount(driver);
    expect(badgeCount).toBe(0);

    const body = await driver.findElement(By.css('body')).getText();
    expect(body).toContain('Aucun établissement');

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });

  it('le bouton de réinitialisation restaure la liste complète de la ville', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');

    const countAvant = await getResultCount(driver);

    const search = await driver.findElement(By.id('search-input'));
    await search.sendKeys('Anfa');
    await driver.sleep(500);
    expect(await getResultCount(driver)).toBeLessThan(countAvant);

    await driver.findElement(By.id('btn-reset-filters')).click();
    await driver.sleep(300);

    expect(await getResultCount(driver)).toBe(countAvant);
    const searchValue = await driver.findElement(By.id('search-input')).getAttribute('value');
    expect(searchValue).toBe('');
  });

  it('le filtre source restreint les résultats sans casser la page', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');

    const countAvant = await getResultCount(driver);
    const sourceSelect = await driver.findElement(By.id('filter-source'));
    const options = await sourceSelect.findElements(By.css('option'));
    expect(options.length).toBeGreaterThanOrEqual(2); // "Toutes les sources" + au moins une source réelle

    const secondeOption = await options[1].getAttribute('value');
    await options[1].click();
    await driver.sleep(300);

    const ids = await getRenderedEtablissementIds(driver);
    const countApres = await getResultCount(driver);
    expect(ids.length).toBe(countApres);
    expect(countApres).toBeLessThanOrEqual(countAvant);
    expect(secondeOption).not.toBe('');
  });

  it('recherche + catégorie combinées restent cohérentes (intersection, pas union)', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');

    const search = await driver.findElement(By.id('search-input'));
    await search.sendKeys('Anfa');
    await driver.sleep(400);
    const countRechercheSeule = await getResultCount(driver);
    expect(countRechercheSeule).toBeGreaterThan(0);

    await driver.findElement(By.id('filter-categorie')).click();
    const options = await driver.wait(
      until.elementsLocated(By.css('[role="listbox"] [role="option"]')),
      10000
    );
    await options[0].click();
    await driver.findElement(By.css('body')).click();
    await driver.sleep(400);

    const countCombine = await getResultCount(driver);
    // L'ajout d'un filtre catégorie ne peut jamais élargir un résultat déjà filtré par la recherche.
    expect(countCombine).toBeLessThanOrEqual(countRechercheSeule);

    const ids = await getRenderedEtablissementIds(driver);
    expect(findDuplicates(ids)).toEqual([]);
  });
});
