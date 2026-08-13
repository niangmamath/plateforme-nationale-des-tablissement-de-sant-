import { Builder, WebDriver, logging } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

/**
 * Chrome headless, piloté par Selenium Manager (inclus dans selenium-webdriver
 * depuis la v4.6 — télécharge automatiquement le chromedriver compatible,
 * aucune installation manuelle requise en local ni en CI).
 */
export async function createDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1440,900'
  );
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.SEVERE);

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setLoggingPrefs(prefs)
    .build();
}

// @vercel/analytics ne résout son script que sur l'infra Vercel réelle — un 404 dessus
// est attendu et sans rapport avec un bug produit quand on teste un déploiement local
// (dev server, `vite preview`, preview Vercel non concerné) ; on l'ignore explicitement.
const BRUIT_CONNU = ['_vercel/insights/script.js'];

/** Erreurs JS levées côté navigateur pendant le test (console.error / exceptions non catchées). */
export async function getSevereBrowserErrors(driver: WebDriver): Promise<string[]> {
  const entries = await driver.manage().logs().get(logging.Type.BROWSER);
  return entries
    .filter((e) => e.level.name === 'SEVERE')
    .map((e) => e.message)
    .filter((message) => !BRUIT_CONNU.some((bruit) => message.includes(bruit)));
}
