// Génère l'introduction en texte du business plan : présente la zone choisie, puis la situe par
// rapport aux autres zones de sa ville et aux autres villes du pays pour la spécialité choisie.
// Chaque phrase de comparaison s'appuie sur un rang réel dans un ensemble réel (jamais un
// qualificatif du type "élevé" sans dire par rapport à quoi) — rien n'est inventé : si une donnée
// manque, la phrase qui en dépend est simplement omise plutôt que remplacée par une estimation.

export interface ZoneComparable {
  nom: string;
  population: number;
  densite: number;
  prixM2: number;
  loyerM2: number;
  pop0_14: number | null;
  pop15_59: number | null;
  pop60_plus: number | null;
  concurrenceCount: number;
  autresSpecCount: number;
}

export interface VilleComparable {
  nom: string;
  concurrenceTotale: number; // établissements de la spécialité choisie, toutes zones confondues
}

export interface ParametresIntroduction {
  zone: ZoneComparable;
  ville: string;
  zonesVille: ZoneComparable[]; // toutes les zones de `ville`, `zone` incluse
  villes: VilleComparable[]; // toutes les villes couvertes par la plateforme, `ville` incluse
  specialiteNom: string; // ex. "Neurologie" — nom naturel, pas le libellé "Cabinet de ..."
}

// L'espace fine insécable (U+202F) que produit fr-FR est absente de la police du site : les
// milliers disparaissaient à l'affichage ("871200"). On la remplace par l'espace insécable
// ordinaire (U+00A0) — même correctif que dans BusinessPlanGenerator/projectionBP.
const espacer = (texte: string) => texte.replace(/ /g, ' ');
const formatDH = (n: number) => espacer(Math.round(n).toLocaleString('fr-FR')) + ' DH';
const formatNb = (n: number) => espacer(Math.round(n).toLocaleString('fr-FR'));
const formatPct = (n: number) => `${n.toFixed(1).replace('.', ',')} %`;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const ordinale = (n: number) => (n === 1 ? '1re' : `${n}e`);

// Rang de `valeur` dans `valeurs` : 1 = la plus grande, sauf si `croissant` (1 = la plus petite).
// Les ex-æquo partagent le même rang (comparaison stricte), pour ne jamais sur-affirmer un ordre
// que les chiffres ne montrent pas.
function rang(valeur: number, valeurs: number[], croissant = false): { position: number; total: number } {
  const meilleurs = valeurs.filter((v) => (croissant ? v < valeur : v > valeur));
  return { position: meilleurs.length + 1, total: valeurs.length };
}

function moyenne(valeurs: (number | null)[]): number | null {
  const connues = valeurs.filter((v): v is number => v != null);
  return connues.length ? connues.reduce((a, b) => a + b, 0) / connues.length : null;
}

function paragrapheProfil(zone: ZoneComparable, zonesVille: ZoneComparable[]): string {
  const phrases: string[] = [
    `${zone.nom} compte ${formatNb(zone.population)} habitants pour une densité de ${formatNb(zone.densite)} habitants au km².`,
  ];

  if (zone.pop0_14 != null && zone.pop15_59 != null && zone.pop60_plus != null) {
    let complement = '';
    const moyPop60 = moyenne(zonesVille.map((z) => z.pop60_plus));
    if (moyPop60 != null && zonesVille.length > 1 && Math.abs(zone.pop60_plus - moyPop60) >= 2) {
      const sens = zone.pop60_plus > moyPop60 ? 'supérieure' : 'inférieure';
      complement = ` — une part de seniors ${sens} à la moyenne de la ville (${formatPct(moyPop60)})`;
    }
    phrases.push(
      `Sa population se répartit en ${formatPct(zone.pop0_14)} de moins de 15 ans, ${formatPct(zone.pop15_59)} de 15-59 ans et ${formatPct(zone.pop60_plus)} de 60 ans et plus${complement}.`
    );
  }

  phrases.push(
    `Le prix au m² s'y établit à ${formatDH(zone.prixM2)} à l'achat, soit ${formatDH(zone.loyerM2)} par m² et par mois à la location.`
  );

  return phrases.join(' ');
}

function paragrapheConcurrenceLocale(zone: ZoneComparable, specialiteNom: string): string {
  const concurrence =
    zone.concurrenceCount === 0
      ? `Aucun établissement de ${specialiteNom} n'y est recensé à ce jour.`
      : `On y recense déjà ${pluriel(zone.concurrenceCount, 'établissement')} de ${specialiteNom} en activité.`;
  const synergie =
    zone.autresSpecCount === 0
      ? "Aucun autre établissement de santé n'y est recensé à proximité."
      : zone.autresSpecCount === 1
        ? "Un autre établissement de santé y est recensé à proximité, un indice de pôle médical déjà constitué."
        : `${zone.autresSpecCount} autres établissements de santé y sont recensés à proximité, un indice de pôle médical déjà constitué.`;
  return `${concurrence} ${synergie}`;
}

function paragrapheComparaisonZones(zone: ZoneComparable, zonesVille: ZoneComparable[], ville: string, specialiteNom: string): string | null {
  const n = zonesVille.length;
  if (n <= 1) return null;

  const rangPop = rang(zone.population, zonesVille.map((z) => z.population));
  const rangPrix = rang(zone.prixM2, zonesVille.map((z) => z.prixM2), true); // 1 = la moins chère
  const rangConcurrence = rang(zone.concurrenceCount, zonesVille.map((z) => z.concurrenceCount), true); // 1 = la moins concurrentielle

  const phrasePrix =
    rangPrix.position === 1
      ? `elle affiche le prix au m² le plus bas de la ville`
      : rangPrix.position === n
        ? `elle affiche le prix au m² le plus élevé de la ville`
        : `son prix au m² la place ${ordinale(rangPrix.position)} zone la moins chère sur ${n}`;

  const phraseConcurrence =
    rangConcurrence.position === 1
      ? `c'est la zone la moins concurrentielle de la ville pour ${specialiteNom}`
      : rangConcurrence.position === n
        ? `c'est la zone la plus concurrentielle de la ville pour ${specialiteNom}`
        : `elle se classe ${ordinale(rangConcurrence.position)} zone la moins concurrentielle sur ${n}`;

  return `Sur les ${n} zones couvertes à ${ville}, ${zone.nom} se classe ${ordinale(rangPop.position)} plus peuplée ; ${phrasePrix} ; ${phraseConcurrence}.`;
}

function paragrapheComparaisonNationale(ville: string, villes: VilleComparable[], specialiteNom: string): string | null {
  if (villes.length <= 1) return null;
  const villeActuelle = villes.find((v) => v.nom === ville);
  if (!villeActuelle) return null;

  const rangVille = rang(villeActuelle.concurrenceTotale, villes.map((v) => v.concurrenceTotale), true); // 1 = la moins concurrencée
  const min = villes.reduce((a, b) => (a.concurrenceTotale <= b.concurrenceTotale ? a : b));
  const max = villes.reduce((a, b) => (a.concurrenceTotale >= b.concurrenceTotale ? a : b));

  let phrase = `À l'échelle des ${villes.length} villes couvertes par la plateforme, ${ville} recense au total ${pluriel(villeActuelle.concurrenceTotale, 'établissement')} de ${specialiteNom}, ce qui la place au rang ${rangVille.position} sur ${villes.length} (1 = la ville la moins concurrencée).`;
  if (min.nom !== max.nom) {
    phrase += ` La ville la moins concurrencée est ${min.nom} (${formatNb(min.concurrenceTotale)}), la plus concurrencée ${max.nom} (${formatNb(max.concurrenceTotale)}).`;
  }
  return phrase;
}

export interface SectionsIntroduction {
  profilEconomique: string; // démographie + pouvoir d'achat de la zone — réutilisé tel quel par l'Étude Économique du business plan
  concurrenceLocale: string; // réutilisé tel quel par l'Étude Commerciale (section Concurrence) du business plan
  comparaisonZones: string | null;
  comparaisonNationale: string | null;
}

// Mêmes paragraphes que `genererIntroduction`, mais nommés individuellement : le business plan a
// besoin de réutiliser le profil économique et la concurrence locale dans des sections distinctes
// (Étude Économique, Étude Commerciale) sans dupliquer la logique de génération.
export function genererSectionsIntroduction(p: ParametresIntroduction): SectionsIntroduction {
  return {
    profilEconomique: paragrapheProfil(p.zone, p.zonesVille),
    concurrenceLocale: paragrapheConcurrenceLocale(p.zone, p.specialiteNom),
    comparaisonZones: paragrapheComparaisonZones(p.zone, p.zonesVille, p.ville, p.specialiteNom),
    comparaisonNationale: paragrapheComparaisonNationale(p.ville, p.villes, p.specialiteNom),
  };
}

// Renvoie les paragraphes du texte d'introduction, dans l'ordre d'affichage. Un paragraphe de
// comparaison absent (une seule zone dans la ville, ou une seule ville couverte) est simplement
// omis plutôt que rempli avec une comparaison qui n'a pas de sens.
export function genererIntroduction(p: ParametresIntroduction): string[] {
  const s = genererSectionsIntroduction(p);
  return [s.profilEconomique, s.concurrenceLocale, s.comparaisonZones, s.comparaisonNationale].filter(
    (para): para is string => !!para
  );
}
