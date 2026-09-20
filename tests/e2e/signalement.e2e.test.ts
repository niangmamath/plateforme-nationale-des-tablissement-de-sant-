import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { By, WebDriver, until } from 'selenium-webdriver';
import { createDriver, getSevereBrowserErrors } from './driver.js';
import { waitForAppReady, selectVille, getRenderedEtablissementIds } from './helpers.js';
import { BASE_URL } from './env.js';

// Ces tests tournent contre la prod (ou une preview CI) : aucun ne soumet réellement le
// formulaire, pour ne jamais créer de vrais signalements — ils vérifient l'accès aux formulaires
// et la validation côté client (qui bloque l'envoi avant tout appel réseau).

// La modale apparaît en fondu : tant qu'elle est transparente, Selenium considère son texte non
// visible et getText() renvoie ''. On attend donc que le titre soit lisible au lieu de le lire une
// seule fois juste après l'avoir localisé (lecture qui échouait de façon intermittente).
async function attendreTitre(driver: WebDriver, attendu: string) {
  await driver.wait(
    async () => (await driver.findElement(By.id('signalement-titre')).getText()) === attendu,
    5000,
    `Titre de la modale « ${attendu} » non affiché`
  );
}

describe('Signalement utilisateur', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it('la popup d\'une fiche propose "Signaler une erreur", qui ouvre un formulaire validé côté client', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');
    await driver.wait(until.elementLocated(By.css('.leaflet-marker-icon, .marker-cluster')), 15000);

    const ids = await getRenderedEtablissementIds(driver);
    expect(ids.length).toBeGreaterThan(0);
    await driver.findElement(By.id(ids[0])).click();

    const bouton = await driver.wait(until.elementLocated(By.css('.leaflet-popup [data-signaler]')), 20000);
    await driver.wait(until.elementIsVisible(bouton), 5000);
    await bouton.click();

    const modale = await driver.wait(until.elementLocated(By.css('[role="dialog"]')), 5000);
    await attendreTitre(driver, 'Signaler une erreur');

    // Envoi à vide : refusé côté client, message explicite, la modale reste ouverte.
    await modale.findElement(By.css('form button[type="submit"]')).click();
    const alerte = await driver.wait(until.elementLocated(By.css('[role="alert"]')), 3000);
    expect(await alerte.getText()).toContain('type de problème');

    // Échap referme la modale.
    await driver.actions().sendKeys('').perform();
    await driver.wait(async () => (await driver.findElements(By.css('[role="dialog"]'))).length === 0, 3000);

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });

  it('cliquer directement sur un marqueur de la carte puis sur "Signaler une erreur" ouvre le formulaire', async () => {
    // Chemin distinct de la liste latérale : ici Leaflet ouvre la popup lui-même, PUIS la
    // sélection rappelle openPopup() sur une popup déjà ouverte, ce qui réécrit son HTML.
    // Régression réelle : un gestionnaire posé à l'ouverture disparaissait avec l'ancien bouton et
    // le formulaire ne s'ouvrait plus — invisible tant qu'on n'ouvrait la popup que par la liste.
    await driver.get(BASE_URL);
    await waitForAppReady(driver);
    await selectVille(driver, 'Casablanca');
    await driver.wait(until.elementLocated(By.css('.leaflet-marker-icon.custom-leaflet-marker')), 20000);
    const carteEl = await driver.findElement(By.id('leaflet-map-element'));
    await driver.executeScript('arguments[0].scrollIntoView({ block: "center" })', carteEl);
    await driver.sleep(600);

    const carte = await carteEl.getRect();
    let cible = null;
    for (const marqueur of await driver.findElements(By.css('.leaflet-marker-icon.custom-leaflet-marker'))) {
      const r = await marqueur.getRect();
      // Loin des bords : la barre d'outils, la légende et les contrôles de zoom recouvrent les coins.
      if (r.x > carte.x + 80 && r.x < carte.x + carte.width - 80 && r.y > carte.y + 130 && r.y < carte.y + carte.height - 80) {
        cible = marqueur;
        break;
      }
    }
    expect(cible).not.toBeNull();

    await driver.actions().move({ origin: cible! }).click().perform();
    await driver.wait(until.elementLocated(By.css('.leaflet-popup [data-signaler]')), 10000);
    await driver.sleep(1800); // laisse la sélection ré-ouvrir la popup avant de cliquer

    await driver.actions().move({ origin: await driver.findElement(By.css('.leaflet-popup [data-signaler]')) }).click().perform();
    await driver.wait(until.elementLocated(By.css('[role="dialog"]')), 5000);
    await attendreTitre(driver, 'Signaler une erreur');

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });

  it('le lien "Signalez-le" ouvre le formulaire d\'établissement manquant, sans choix de type de problème', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);

    const lien = await driver.findElement(By.id('btn-signaler-absence'));
    await driver.executeScript('arguments[0].scrollIntoView({ block: "center" })', lien);
    await lien.click();

    const modale = await driver.wait(until.elementLocated(By.css('[role="dialog"]')), 5000);
    await attendreTitre(driver, 'Signaler un établissement manquant');
    expect(await modale.findElements(By.xpath(".//legend[contains(., 'Type de problème')]"))).toHaveLength(0);

    await modale.findElement(By.css('form button[type="submit"]')).click();
    const alerte = await driver.wait(until.elementLocated(By.css('[role="alert"]')), 3000);
    expect(await alerte.getText()).toContain('nom et prénom');

    const errors = await getSevereBrowserErrors(driver);
    expect(errors).toEqual([]);
  });
});
