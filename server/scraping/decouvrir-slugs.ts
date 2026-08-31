// Outil de découverte de slugs via sitemap — ne touche à aucun fichier existant.
// But : lister tous les slugs de spécialité réellement utilisés par DabaDoc/Doctori.ma pour nos
// 6 villes, et les comparer à ce qu'on a configuré, pour repérer toute catégorie fragmentée comme
// Oncologue (voir config.ts) qu'on n'aurait pas encore détectée.
import { CATEGORIE_SLUGS, VILLE_SLUGS } from './config';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return res.text();
}

async function slugsDabadocParVille(villeSlug: string): Promise<Map<string, number>> {
  const txt = await fetchText(`https://www.dabadoc.com/sitemaps/ma/${villeSlug}/sitemap.xml`);
  const locs = [...txt.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const compte = new Map<string, number>();
  for (const u of locs) {
    const m = u.match(/dabadoc\.com\/ma\/(?:ar\/)?([a-z0-9-]+)\//);
    if (m) compte.set(m[1], (compte.get(m[1]) ?? 0) + 1);
  }
  return compte;
}

async function slugsDoctori(): Promise<Map<string, number>> {
  const txt = await fetchText('https://www.doctori.ma/sitemap.xml');
  const locs = [...txt.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const compte = new Map<string, number>();
  for (const u of locs) {
    const m = u.match(/\/(?:medecin|tabib)\/([a-z0-9-]+)\/[a-z-]+\//);
    if (m) compte.set(m[1], (compte.get(m[1]) ?? 0) + 1);
  }
  return compte;
}

(async () => {
  console.log('=== Slugs Doctori.ma (tout le Maroc, comptage de pages profil) ===');
  const doctoriSlugs = await slugsDoctori();
  const doctoriTries = [...doctoriSlugs.entries()].sort((a, b) => b[1] - a[1]);
  for (const [slug, n] of doctoriTries) console.log(slug.padEnd(45), n);

  console.log('\n=== Slugs DabaDoc pour Casablanca (le plus gros volume, échantillon) ===');
  const dabaCasa = await slugsDabadocParVille('casablanca');
  const dabaTries = [...dabaCasa.entries()].sort((a, b) => b[1] - a[1]);
  for (const [slug, n] of dabaTries) console.log(slug.padEnd(45), n);

  console.log('\n=== Comparaison avec CATEGORIE_SLUGS configuré ===');
  for (const [cat, slugs] of Object.entries(CATEGORIE_SLUGS)) {
    const configDabaDoc = new Set((Array.isArray(slugs.dabadoc) ? slugs.dabadoc : slugs.dabadoc ? [slugs.dabadoc] : []));
    const configDoctori = new Set((Array.isArray(slugs.doctori) ? slugs.doctori : slugs.doctori ? [slugs.doctori] : []));
    console.log(`\n-- ${cat} --`);
    console.log('  DabaDoc configuré:', [...configDabaDoc].join(', ') || '(aucun)');
    console.log('  Doctori configuré:', [...configDoctori].join(', ') || '(aucun)');
  }

  console.log('\n=== Slugs Doctori.ma NON configurés nulle part (à examiner manuellement) ===');
  const tousSlugsConfigures = new Set<string>();
  for (const slugs of Object.values(CATEGORIE_SLUGS)) {
    const d = Array.isArray(slugs.doctori) ? slugs.doctori : slugs.doctori ? [slugs.doctori] : [];
    d.forEach((s) => tousSlugsConfigures.add(s));
  }
  for (const [slug, n] of doctoriTries) {
    if (!tousSlugsConfigures.has(slug)) console.log(slug.padEnd(45), n);
  }
})();
