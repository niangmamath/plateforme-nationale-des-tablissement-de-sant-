import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import { createDriver, getSevereBrowserErrors } from './driver.js';
import { waitForAppReady, getRenderedEtablissementIds } from './helpers.js';
import { BASE_URL } from './env.js';

describe('Chargement du site', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("charge sans rester bloqué et sans l'écran d'erreur API", async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);

    const ids = await getRenderedEtablissementIds(driver);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("ne lève aucune erreur JS sévère au chargement", async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });
});
