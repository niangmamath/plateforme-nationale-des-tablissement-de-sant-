import { By, WebDriver, until } from 'selenium-webdriver';

export const TEXTE_ERREUR_API = "Impossible de charger les données depuis l'API.";
export const TEXTE_CHARGEMENT = 'Chargement des données...';

/**
 * Attend la fin du chargement initial (le composant racine affiche soit l'erreur
 * API, soit le contenu principal — jamais indéfiniment le message "Chargement...").
 * Lève une erreur explicite si l'app reste bloquée en chargement au-delà du délai,
 * ou si elle affiche l'écran d'erreur API.
 *
 * Délai généreux par défaut : sans ville sélectionnée, la liste latérale rend tous
 * les établissements du pays (pas de virtualisation), ce qui peut prendre plusieurs
 * secondes sur les gros jeux de données.
 */
export async function waitForAppReady(driver: WebDriver, timeoutMs = 45000): Promise<void> {
  await driver.wait(async () => {
    const body = await driver.findElement(By.css('body')).getText();
    if (body.includes(TEXTE_ERREUR_API)) {
      throw new Error(`L'app affiche l'écran d'erreur : "${TEXTE_ERREUR_API}"`);
    }
    return !body.includes(TEXTE_CHARGEMENT);
  }, timeoutMs, `L'app est restée bloquée sur "${TEXTE_CHARGEMENT}" plus de ${timeoutMs}ms`);

  // Le contenu principal (carte + liste) doit être monté.
  await driver.wait(until.elementLocated(By.id('geospatial-core')), timeoutMs);
}

/**
 * Ids DOM (`etab-item-<id>`) des établissements actuellement rendus dans la liste
 * latérale — récupérés en un seul executeScript (et non un findElements + getAttribute
 * par élément) car un aller-retour WebDriver par élément peut planter la session
 * chromedriver sur de gros volumes.
 *
 * ⚠️ La liste est virtualisée (react-window) : seules les lignes visibles à l'écran
 * (+ overscan) sont réellement montées dans le DOM. Ce nombre est donc presque
 * toujours < au compteur "RÉSULTATS" (`getResultCount`) dès que la liste dépasse la
 * hauteur du panneau — ce n'est pas un bug, ne pas comparer les deux pour une égalité.
 * Reste utile pour : détecter un doublon DOM parmi les lignes montées, et vérifier
 * qu'au moins une ligne s'affiche.
 */
export async function getRenderedEtablissementIds(driver: WebDriver): Promise<string[]> {
  return driver.executeScript(
    "return Array.from(document.querySelectorAll('[id^=\"etab-item-\"]')).map(function (el) { return el.id; });"
  );
}

/** Textes des badges de catégorie actuellement affichés dans la liste latérale. */
export async function getRenderedCategoryBadgeTexts(driver: WebDriver): Promise<string[]> {
  return driver.executeScript(
    "return Array.from(document.querySelectorAll('[id^=\"etab-item-\"] span.rounded')).map(function (el) { return el.textContent || ''; });"
  );
}

/** Nombre affiché dans le badge "RÉSULTATS" de la liste latérale. */
export async function getResultCount(driver: WebDriver): Promise<number> {
  const text = await driver.findElement(By.css('#geospatial-core h2 span.bg-slate-900')).getText();
  return Number.parseInt(text, 10);
}

/**
 * Sélectionne une ville dans le filtre pays/ville pour borner le jeu de données —
 * sans ville choisie, "toutes les villes du pays" rend des milliers d'établissements
 * d'un coup (liste non virtualisée), ce qui rend les tests inutilement lents/fragiles.
 */
export async function selectVille(driver: WebDriver, nomVille: string): Promise<void> {
  const villeSelect = driver.findElement(By.id('filter-ville'));
  const option = await villeSelect.findElement(By.xpath(`.//option[text()="${nomVille}"]`));
  await option.click();
  await driver.wait(async () => (await getRenderedEtablissementIds(driver)).length > 0, 15000);
}

/** Sélectionne un pays dans le filtre pays (recharge la liste de villes disponibles). */
export async function selectPays(driver: WebDriver, nomPays: string): Promise<void> {
  const paysSelect = driver.findElement(By.id('filter-pays'));
  const option = await paysSelect.findElement(By.xpath(`.//option[text()="${nomPays}"]`));
  await option.click();
  await driver.wait(async () => (await getRenderedEtablissementIds(driver)).length > 0, 15000);
}

/** Libellés de toutes les catégories proposées dans le menu déroulant (déjà filtré par l'UI). */
export async function getToutesLesCategories(driver: WebDriver): Promise<string[]> {
  await driver.findElement(By.id('filter-categorie')).click();
  const options = await driver.wait(until.elementsLocated(By.css('[role="listbox"] [role="option"]')), 10000);
  const labels = await Promise.all(options.map((o) => o.getText()));
  await driver.findElement(By.css('body')).click(); // referme le menu
  return labels;
}

/** Coche/décoche une catégorie précise dans le menu déroulant (l'ouvre puis le referme). */
export async function toggleCategorie(driver: WebDriver, label: string): Promise<void> {
  await driver.findElement(By.id('filter-categorie')).click();
  const option = await driver.wait(
    until.elementLocated(By.xpath(`//div[@role="listbox"]//button[@role="option" and .//span[text()="${label}"]]`)),
    10000
  );
  await option.click();
  await driver.findElement(By.css('body')).click(); // referme le menu
}

/** Libellés de toutes les villes du pays actuellement sélectionné. */
export async function getToutesLesVilles(driver: WebDriver): Promise<string[]> {
  const select = driver.findElement(By.id('filter-ville'));
  const options = await select.findElements(By.css('option'));
  const labels = await Promise.all(options.map((o) => o.getText()));
  return labels.filter((l) => l !== 'Toutes les villes');
}

/** Libellés de tous les pays disponibles. */
export async function getTousLesPays(driver: WebDriver): Promise<string[]> {
  const select = driver.findElement(By.id('filter-pays'));
  const options = await select.findElements(By.css('option'));
  return Promise.all(options.map((o) => o.getText()));
}

/**
 * Déclenche `trigger` puis attend qu'une valeur observée (ex. le compteur de
 * résultats) cesse de changer pendant `stableForMs` ; renvoie le temps total écoulé
 * depuis juste avant le déclenchement. Sert à la fois de "attends que le rendu se
 * stabilise" et de mesure de performance perçue — plus fiable qu'un délai fixe vu
 * l'absence de virtualisation/debounce côté app (le rendu peut prendre de quelques
 * centaines de ms à plusieurs secondes selon le volume de données concerné).
 */
export async function measureUntilStable(
  trigger: () => Promise<void>,
  getValue: () => Promise<number>,
  { timeoutMs = 20000, stableForMs = 400, pollMs = 150 } = {}
): Promise<number> {
  const start = Date.now();
  await trigger();
  let last = await getValue();
  let lastChange = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollMs));
    const value = await getValue();
    if (value !== last) {
      last = value;
      lastChange = Date.now();
    } else if (Date.now() - lastChange >= stableForMs) {
      return Date.now() - start;
    }
  }
  throw new Error(`La valeur observée ne s'est pas stabilisée au-delà de ${timeoutMs}ms (dernière valeur: ${last})`);
}

export function findDuplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const dups = new Set<T>();
  for (const v of values) {
    if (seen.has(v)) dups.add(v);
    seen.add(v);
  }
  return Array.from(dups);
}
