import type { WebDriver } from 'selenium-webdriver';
import type { FicheScrapee } from './dedup';

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; EmpowerDoctorBot/1.0; +https://empower-doctor.vercel.app)' };

// Les blobs JSON embarqués dans le HTML (window.CurrentSearch.result, window.doctori.practitioners)
// sont trop volumineux/imbriqués pour une regex fiable — on compte la profondeur des crochets en
// respectant les chaînes (donc les crochets qui apparaissent dans du texte libre ne comptent pas).
function extraireTableauJson(html: string, marqueurVariable: string): string | null {
  const idx = html.indexOf(marqueurVariable);
  if (idx === -1) return null;
  const debut = html.indexOf('[', idx);
  if (debut === -1) return null;
  let profondeur = 0, dansChaine = false, echappement = false;
  for (let i = debut; i < html.length; i++) {
    const c = html[i];
    if (echappement) { echappement = false; continue; }
    if (c === '\\') { echappement = true; continue; }
    if (c === '"') { dansChaine = !dansChaine; continue; }
    if (dansChaine) continue;
    if (c === '[') profondeur++;
    else if (c === ']') { profondeur--; if (profondeur === 0) return html.slice(debut, i + 1); }
  }
  return null;
}

export async function scrapeDabaDoc(specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  const html = await (await fetch(`https://www.dabadoc.com/ma/${specialite}/${villeSlug}`, { headers: HEADERS })).text();
  const brut = extraireTableauJson(html, 'window.CurrentSearch.result');
  if (!brut) return [];
  return JSON.parse(brut).map((d: any) => ({
    nom: d.full_name,
    adresse: d.full_address,
    telephone: d.phone_number || null,
    lat: d.coordinates ? d.coordinates[1] : null,
    lng: d.coordinates ? d.coordinates[0] : null,
    source: 'DabaDoc',
  }));
}

export async function scrapeDoctori(specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  const html = await (await fetch(`https://www.doctori.ma/fr/medecin/${specialite}/${villeSlug}`, { headers: HEADERS })).text();
  const brut = extraireTableauJson(html, 'window.doctori.practitioners');
  if (!brut) return [];
  return JSON.parse(brut)
    .filter((p: any) => p.establishments && p.establishments.length > 0)
    .map((p: any) => {
      const etab = p.establishments[0];
      return {
        nom: `${p.translation.firstname} ${p.translation.lastname}`,
        adresse: etab.translation ? etab.translation.address : null,
        telephone: etab.phone_number || null,
        lat: etab.lat ? Number(etab.lat) : null,
        lng: etab.lng ? Number(etab.lng) : null,
        source: 'Doctori.ma',
      };
    });
}

// Couvre aussi PagesJaunes.ma : ce domaine redirige (301) vers telecontact.ma/liens/..., donc
// même contenu, même structure de page — un scraper séparé ne produirait que des doublons.
export async function scrapeTelecontact(specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  const html = await (await fetch(`https://www.telecontact.ma/liens/${specialite}/${villeSlug}.php`, { headers: HEADERS })).text();
  const resultats: FicheScrapee[] = [];
  const blocRegex = /data-rs-comp="([^"]+)"[\s\S]{0,50}?data-code-firme="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = blocRegex.exec(html)) !== null) {
    const zoneApres = html.slice(m.index, m.index + 3000);
    const adresseMatch = zoneApres.match(/itemprop="streetAddress">\s*([^<]+?)\s*</);
    const telMatch = zoneApres.match(/itemprop="telephone">\s*([^<]+?)\s*</);
    resultats.push({
      nom: m[1],
      adresse: adresseMatch ? adresseMatch[1].trim() : null,
      telephone: telMatch ? telMatch[1].trim() : null,
      lat: null,
      lng: null,
      source: 'Télécontact / PagesJaunes',
    });
  }
  return resultats;
}

export async function scrapeMedMa(driver: WebDriver, specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  await driver.get(`https://www.med.ma/medecin/${specialite}/${villeSlug}`);
  await driver.sleep(2000);
  // Contenu chargé au scroll (lazy load) — sans ce déclenchement, la page ne contient que les
  // premières fiches visibles au chargement initial.
  await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
  await driver.sleep(3000);
  const bruts: { nom: string; adresse: string | null }[] = await driver.executeScript(`
    return Array.from(document.querySelectorAll('.card-doctor-block')).map(card => {
      const nomEl = card.querySelector('.list__label--name');
      const adresseEl = card.querySelector('.list__label--adr');
      return {
        nom: nomEl ? nomEl.textContent.trim() : null,
        adresse: adresseEl ? adresseEl.textContent.trim() : null,
      };
    }).filter(r => r.nom);
  `);
  return bruts.map((r) => ({ ...r, telephone: null, lat: null, lng: null, source: 'Med.ma' }));
}

// Sur Medicalis.ma, certaines spécialités sont classées par établissement plutôt que par
// praticien (ex. "Centres-Ophtalmologie" ne liste que des cliniques, pas des ophtalmologues
// individuels) — categorieSlug doit alors être omis à l'appel côté orchestrateur pour cette
// spécialité, plutôt que de polluer les candidats "praticien individuel" avec des cliniques.
export async function scrapeMedicalis(driver: WebDriver, categorieSlug: string, ville: string, codeVille: string): Promise<FicheScrapee[]> {
  const url = `https://medicalis.ma/liste/${encodeURIComponent(categorieSlug)}/${ville}/Maroc/${codeVille}`;
  await driver.get(url);
  await driver.sleep(5000);
  const bruts: { nom: string; adresse: string | null }[] = await driver.executeScript(`
    return Array.from(document.querySelectorAll('.divinfo')).map(card => {
      const nomEl = card.querySelector('.nomprenom a');
      const adresseEl = card.querySelector('.address');
      return {
        nom: nomEl ? nomEl.textContent.trim() : null,
        adresse: adresseEl ? adresseEl.textContent.trim().replace(/\\s+/g, ' ') : null,
      };
    }).filter(r => r.nom);
  `);
  return bruts.map((r) => ({ ...r, telephone: null, lat: null, lng: null, source: 'Medicalis.ma' }));
}
