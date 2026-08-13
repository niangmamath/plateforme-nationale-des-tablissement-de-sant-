import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { By, WebDriver, until } from 'selenium-webdriver';
import { createDriver, getSevereBrowserErrors } from './driver.js';
import { waitForAppReady, selectVille, getRenderedEtablissementIds } from './helpers.js';
import { BASE_URL } from './env.js';

describe('Carte interactive', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it('la carte Leaflet se monte avec des marqueurs, sans erreur JS', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');

    await driver.wait(until.elementLocated(By.css('.leaflet-container')), 15000);
    const marqueurs = await driver.findElements(By.css('.leaflet-marker-icon'));
    expect(marqueurs.length).toBeGreaterThan(0);

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });

  it('changer de ville recentre la carte sans erreur JS', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');
    await driver.wait(until.elementLocated(By.css('.leaflet-marker-icon')), 15000);

    await selectVille(driver, 'Rabat');
    await driver.wait(until.elementLocated(By.css('.leaflet-marker-icon')), 15000);

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });

  it("cliquer sur un établissement de la liste révèle sa position sur la carte, même regroupé dans un cluster", async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');
    await driver.wait(until.elementLocated(By.css('.leaflet-marker-icon, .marker-cluster')), 15000);

    const ids = await getRenderedEtablissementIds(driver);
    expect(ids.length).toBeGreaterThan(0);

    // Quelques établissements de la liste (pas seulement le premier), pour augmenter les
    // chances de couvrir un cas initialement regroupé dans un cluster.
    for (const id of ids.slice(0, 3)) {
      await driver.findElement(By.id(id)).click();
      // Localise ET lit le lien "Ouvrir Google Maps" en une seule opération réessayée tant
      // qu'elle échoue : Leaflet détruit/recrée la popup précédente à l'ouverture de la
      // suivante (autoClose), donc localiser puis lire en deux étapes séparées peut retomber
      // sur une référence déjà périmée (StaleElementReferenceError) pendant la transition.
      const texte = await driver.wait(async () => {
        try {
          const el = await driver.findElement(By.css('.leaflet-popup-content a'));
          const t = await el.getText();
          return t.length > 0 ? t : null;
        } catch {
          return null;
        }
      }, 10000);
      expect((texte as string).length).toBeGreaterThan(0);
    }

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });
});
