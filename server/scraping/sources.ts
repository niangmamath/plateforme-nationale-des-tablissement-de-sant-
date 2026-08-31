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

// Pagine à ~15 par page, jamais suivi jusqu'ici — constaté en vérifiant Dentiste/Casablanca : 22
// pages réelles (≈320 dentistes) contre 15 récupérés, page 1 seule. Même détection de fin de
// liste que Doctori.ma (voir scrapeDoctori) : rel="next" absent = dernière page.
const DABADOC_PAGES_MAX = 40;

export async function scrapeDabaDoc(specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  const resultats: FicheScrapee[] = [];

  for (let page = 1; page <= DABADOC_PAGES_MAX; page++) {
    const url = `https://www.dabadoc.com/ma/${specialite}/${villeSlug}${page > 1 ? `/page/${page}` : ''}`;
    const html = await (await fetch(url, { headers: HEADERS })).text();
    const brut = extraireTableauJson(html, 'window.CurrentSearch.result');
    if (!brut) break;

    const candidats = JSON.parse(brut);
    if (candidats.length === 0) break;
    resultats.push(...candidats.map((d: any) => ({
      nom: d.full_name,
      adresse: d.full_address,
      telephone: d.phone_number || null,
      lat: d.coordinates ? d.coordinates[1] : null,
      lng: d.coordinates ? d.coordinates[0] : null,
      source: 'DabaDoc',
    })));

    if (!html.includes('rel="next"')) break;
  }

  return resultats;
}

// Doctori.ma pagine ses résultats (≈10 par page) — sans le suivre, on ne récupère que la
// première page et on perd tranquillement le reste (constaté : 5 radiologues sur 15 manquants
// à Rabat, un tiers du total, aucune erreur ni signal visible). La page suivante n'existe QUE si
// un lien `rel="next"` est présent (sur la dernière page, le bouton "Suivant" est désactivé —
// `<li class="page-item disabled">` sans `<a>`) ; plafond de sécurité pour ne jamais boucler sans
// fin si la page change de structure.
const DOCTORI_PAGES_MAX = 20;

export async function scrapeDoctori(specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  const resultats: FicheScrapee[] = [];

  for (let page = 1; page <= DOCTORI_PAGES_MAX; page++) {
    const url = `https://www.doctori.ma/fr/medecin/${specialite}/${villeSlug}${page > 1 ? `?page=${page}` : ''}`;
    const html = await (await fetch(url, { headers: HEADERS })).text();
    const brut = extraireTableauJson(html, 'window.doctori.practitioners');
    if (!brut) break;

    const praticiens = JSON.parse(brut)
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
    if (praticiens.length === 0) break;
    resultats.push(...praticiens);

    // Sur la dernière page, le bouton "Suivant" est un <span> désactivé sans lien — rel="next"
    // n'apparaît alors nulle part dans le HTML.
    if (!html.includes('rel="next"')) break;
  }

  return resultats;
}

// Couvre aussi PagesJaunes.ma : ce domaine redirige (301) vers telecontact.ma/liens/..., donc
// même contenu, même structure de page — un scraper séparé ne produirait que des doublons.
//
// Deux bugs corrigés après avoir constaté un "0 résultat" suspect sur des recherches qui ont
// pourtant de vraies fiches (vérifié en rechargeant la page directement) :
// 1. Le site a inversé l'ordre des attributs data- depuis l'écriture de ce scraper —
//    data-code-firme précède maintenant data-rs-comp, jamais l'inverse — donc le regex d'origine
//    (qui cherchait data-rs-comp PUIS data-code-firme) ne matchait plus jamais rien.
// 2. Pagination jamais suivie (≈20 fiches par page) — on ne récupérait que la première page,
//    perdant tranquillement le reste sans erreur ni signal visible.
function extraireNumeroPageMax(html: string): number {
  const numeros = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1]));
  return numeros.length > 0 ? Math.max(...numeros) : 1;
}

function extraireFichesDunePage(html: string): FicheScrapee[] {
  const resultats: FicheScrapee[] = [];
  const blocRegex = /data-code-firme="(\d+)"[\s\S]{0,50}?data-rs-comp="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = blocRegex.exec(html)) !== null) {
    const zoneApres = html.slice(m.index, m.index + 3000);
    const adresseMatch = zoneApres.match(/itemprop="streetAddress">\s*([^<]+?)\s*</);
    const telMatch = zoneApres.match(/itemprop="telephone">\s*([^<]+?)\s*</);
    resultats.push({
      nom: m[2],
      adresse: adresseMatch ? adresseMatch[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : null,
      telephone: telMatch ? telMatch[1].trim() : null,
      lat: null,
      lng: null,
      source: 'Télécontact / PagesJaunes',
    });
  }
  return resultats;
}

export async function scrapeTelecontact(specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  const urlBase = `https://www.telecontact.ma/liens/${specialite}/${villeSlug}.php`;
  const html1 = await (await fetch(urlBase, { headers: HEADERS })).text();
  const resultats = extraireFichesDunePage(html1);

  const pageMax = extraireNumeroPageMax(html1);
  for (let page = 2; page <= pageMax; page++) {
    const html = await (await fetch(`${urlBase}&page=${page}`, { headers: HEADERS })).text();
    resultats.push(...extraireFichesDunePage(html));
  }

  return resultats;
}

// Défilement infini (lazy load par lot à chaque approche du bas de page) — un seul scroll ne
// déclenche qu'UN lot suivant, pas la liste complète. Constaté en audit : Gynécologue/Casablanca
// ne remontait que 11 fiches via Med.ma contre 297 pour DabaDoc sur la même combinaison, signe que
// la majorité des lots restait jamais chargée. On répète scroll+attente tant que le nombre de
// cartes continue de croître ; arrêt dès qu'un scroll n'en ajoute plus (fin de liste atteinte) ou
// au plafond de sécurité (évite une boucle sans fin si le site change de structure).
const MEDMA_SCROLLS_MAX = 30;

export async function scrapeMedMa(driver: WebDriver, specialite: string, villeSlug: string): Promise<FicheScrapee[]> {
  await driver.get(`https://www.med.ma/medecin/${specialite}/${villeSlug}`);
  await driver.sleep(2000);
  let nombreCartesPrecedent = -1;
  for (let tour = 0; tour < MEDMA_SCROLLS_MAX; tour++) {
    await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
    await driver.sleep(2000);
    const nombreCartes: number = await driver.executeScript(`return document.querySelectorAll('.card-doctor-block').length;`);
    if (nombreCartes === nombreCartesPrecedent) break;
    nombreCartesPrecedent = nombreCartes;
  }
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
//
// Deux gabarits de fiche coexistent sur une même page de liste (constaté en testant le scraper,
// le sélecteur `.divinfo` d'origine ne correspondait plus à rien après une refonte du site) :
// "inscrit" (profil revendiqué : nom dans .nomprenominscrit, adresse dans address.adressinscrit
// — parfois tronquée par le site lui-même avec "...", téléphone dans un span caché
// [id^=telephoneFirmeDisplay]) et "client" (fiche basique non revendiquée : nom dans
// .nomprenomclient seulement, jamais d'adresse ni de téléphone). Les deux partagent le même
// conteneur `.listing.vertical`.
export async function scrapeMedicalis(driver: WebDriver, categorieSlug: string, ville: string, codeVille: string): Promise<FicheScrapee[]> {
  const url = `https://medicalis.ma/liste/${encodeURIComponent(categorieSlug)}/${ville}/Maroc/${codeVille}`;
  await driver.get(url);
  await driver.sleep(5000);
  const bruts: { nom: string; adresse: string | null; telephone: string | null }[] = await driver.executeScript(`
    return Array.from(document.querySelectorAll('.listing.vertical')).map(card => {
      const nomEl = card.querySelector('.nomprenominscrit a, .nomprenomclient a');
      const adresseEl = card.querySelector('address.adressinscrit');
      const telEl = card.querySelector('[id^="telephoneFirmeDisplay"]');
      return {
        nom: nomEl ? nomEl.textContent.trim() : null,
        adresse: adresseEl ? adresseEl.textContent.trim().replace(/\\s+/g, ' ') : null,
        telephone: telEl ? telEl.textContent.trim() : null,
      };
    }).filter(r => r.nom);
  `);
  return bruts.map((r) => ({ ...r, lat: null, lng: null, source: 'Medicalis.ma' }));
}
