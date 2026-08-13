import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebDriver } from 'selenium-webdriver';
import { createDriver } from './driver.js';
import { waitForAppReady } from './helpers.js';
import { BASE_URL } from './env.js';

/**
 * Régression pour l'incident traité manuellement le 2026-08-13 : des établissements
 * dupliqués (même place_id Google, ré-importés sous un autre id/catégorie) s'étaient
 * accumulés en prod. Ce test appelle l'API publique depuis le navigateur (donc via le
 * même chemin que le site réel) et échoue si un place_id apparaît plus d'une fois.
 */
describe('Doublons d\'établissements', () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it('aucun place_id ne doit apparaître deux fois dans /api/etablissements', async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);

    type Resultat = {
      total?: number;
      doublons?: Array<{ placeId: string; ids: string[] }>;
      error?: string;
    };

    const scriptDansLeNavigateur = `
      var callback = arguments[arguments.length - 1];
      fetch('/api/etablissements')
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          var seen = {};
          var doublons = [];
          rows.forEach(function (row) {
            if (!row.placeId) return;
            var dejaVu = seen[row.placeId];
            if (dejaVu) {
              var existant = doublons.filter(function (d) { return d.placeId === row.placeId; })[0];
              if (existant) existant.ids.push(row.id);
              else doublons.push({ placeId: row.placeId, ids: [dejaVu, row.id] });
            } else {
              seen[row.placeId] = row.id;
            }
          });
          callback({ total: rows.length, doublons: doublons });
        })
        .catch(function (e) { callback({ error: e.message }); });
    `;

    const { total, doublons, error } = await driver.executeAsyncScript<Resultat>(scriptDansLeNavigateur);

    expect(error).toBeUndefined();
    expect(total).toBeGreaterThan(0);
    expect(doublons).toEqual([]);
  });

  it("aucune catégorie ne doit avoir deux fiches spécialité publiées dans /api/specialites", async () => {
    await driver.get(BASE_URL);
    await waitForAppReady(driver);

    type Resultat = { total?: number; doublons?: string[]; error?: string };

    const scriptDansLeNavigateur = `
      var callback = arguments[arguments.length - 1];
      fetch('/api/specialites')
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          var seen = {};
          var doublons = [];
          rows.forEach(function (row) {
            var cat = row.categorieEtablissement;
            if (!cat) return;
            if (seen[cat]) doublons.push(cat);
            else seen[cat] = true;
          });
          callback({ total: rows.length, doublons: doublons });
        })
        .catch(function (e) { callback({ error: e.message }); });
    `;

    const { total, doublons, error } = await driver.executeAsyncScript<Resultat>(scriptDansLeNavigateur);

    expect(error).toBeUndefined();
    expect(total).toBeGreaterThan(0);
    expect(doublons).toEqual([]);
  });
});
