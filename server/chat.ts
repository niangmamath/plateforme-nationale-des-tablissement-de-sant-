import { Pool } from 'pg';
import { GoogleGenAI } from '@google/genai';
import { getPays, getSpecialites } from './queries';

const MODELE = 'gemini-2.5-flash';

export interface MessageChat {
  role: 'user' | 'model';
  text: string;
}

// Densité de concurrence réelle par ville × spécialité × arrondissement — agrégée plutôt que de
// transmettre les ~8500 fiches individuelles au modèle (inutile pour répondre et coûteux en
// tokens). C'est ce chiffre, croisé avec la démographie de `zones`, qui permet des recommandations
// de zone crédibles plutôt qu'inventées.
async function chargerConcurrence(pool: Pool) {
  const { rows } = await pool.query(`
    SELECT categorie, ville, arrondissement, count(*)::int AS nombre
    FROM etablissements
    WHERE statut = 'publie' AND arrondissement IS NOT NULL
    GROUP BY categorie, ville, arrondissement
    ORDER BY ville, categorie, arrondissement
  `);
  return rows as Array<{ categorie: string; ville: string; arrondissement: string; nombre: number }>;
}

function enleverAccents(s: string): string {
  return s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();
}

// Réduit la table de concurrence (~650 lignes, 18 spécialités × 6 villes) à la ou les spécialités
// mentionnées dans le dernier message, quand on peut les identifier — sur un contexte plus petit
// et plus ciblé, le modèle retrouve nettement plus fiablement les bonnes lignes (effet "lost in
// the middle" constaté en test : avec les 650 lignes complètes, le modèle a d'abord affirmé à tort
// qu'il manquait des données pour "Pédiatre" alors qu'elles étaient bien présentes). Si aucune
// spécialité connue n'est détectée dans le texte, on garde tout plutôt que de risquer de couper
// une donnée pertinente.
function filtrerConcurrencePourMessage(
  concurrence: Array<{ categorie: string; ville: string; arrondissement: string; nombre: number }>,
  specialites: Awaited<ReturnType<typeof getSpecialites>>,
  dernierMessage: string
) {
  const texte = enleverAccents(dernierMessage);
  const categoriesDetectees = specialites
    .filter((s) => {
      const formes = [s.categorieEtablissement, s.nom].filter(Boolean).map(enleverAccents);
      return formes.some((f) => texte.includes(f) || texte.includes(f.slice(0, Math.max(6, f.length - 2))));
    })
    .map((s) => s.categorieEtablissement);

  if (categoriesDetectees.length === 0) return concurrence;
  return concurrence.filter((c) => categoriesDetectees.includes(c.categorie));
}

async function construireContexte(pool: Pool, dernierMessage: string) {
  const [pays, specialites, concurrence] = await Promise.all([getPays(pool), getSpecialites(pool), chargerConcurrence(pool)]);

  const demographieParVille = pays.flatMap((p) =>
    p.villes.map((v) => ({
      ville: v.nom,
      zones: v.zones.map((z) => ({
        nom: z.nom,
        population: z.population,
        pop15_59_pct: z.pop15_59,
        pop60_plus_pct: z.pop60_plus,
        densite_hab_km2: z.densite,
        prix_m2_dh: z.prixM2,
        loyer_m2_dh: z.loyerM2,
      })),
    }))
  );

  const specialitesResume = specialites.map((s) => ({
    nom: s.categorieEtablissement,
    ponderation: s.poids, // ce que l'algorithme de scoring du site privilégie pour cette spécialité (prix, population, densité, tranche d'âge, concurrence)
  }));

  const concurrenceFiltree = filtrerConcurrencePourMessage(concurrence, specialites, dernierMessage);

  // specialites (petite table, 18 entrées) en dernier, juste avant la question — les deux
  // extrémités d'un contexte sont mieux rappelées par le modèle que le milieu ("lost in the
  // middle"), et c'est la table la plus souvent nécessaire pour répondre à la question posée.
  return { demographieParVille, concurrenceParArrondissement: concurrenceFiltree, specialites: specialitesResume };
}

const INSTRUCTION_SYSTEME = `Tu es l'assistant IA d'Empower Doctor, une plateforme qui aide les médecins et professionnels de santé à choisir où implanter leur cabinet au Maroc (6 villes : Casablanca, Rabat, Salé, Fès, Marrakech, Tanger).

Tu reçois à chaque message un bloc JSON "DONNÉES RÉELLES" contenant, tel qu'enregistré en base aujourd'hui :
- demographieParVille : pour chaque ville, chaque zone/arrondissement avec sa population, la part de 15-59 ans et de 60+ ans, la densité, le prix et le loyer moyen au m².
- specialites : la liste complète des spécialités actives du site (chacune y a une entrée) et la pondération que l'algorithme du site utilise pour chacune (prix, population, densité, tranche d'âge ciblée, concurrence). Une répartition égale entre les 6 critères veut dire qu'aucun ne domine pour cette spécialité — c'est une valeur normale, pas une absence de donnée.
- concurrenceParArrondissement : le nombre de confrères déjà recensés par spécialité et par arrondissement — sers-t'en pour juger si une zone est saturée ou au contraire sous-desservie.

Règles :
- Ne cite QUE des chiffres présents dans ce bloc JSON. N'invente jamais un pourcentage, un prix ou un nombre de confrères.
- Si l'information demandée n'est pas dans les données fournies (ex. une ville hors des 6 couvertes), dis-le clairement plutôt que d'improviser.
- Réponds en français, dans un style professionnel et direct, comme un conseiller en implantation qui s'adresse à un médecin. Pas de markdown, pas de listes à puces longues — des phrases, avec les chiffres clés intégrés naturellement.
- Termine par une question ou une proposition concrète (approfondir une zone, comparer deux quartiers, etc.) quand c'est pertinent.
- Réponses courtes : 3-5 phrases, sauf si l'utilisateur demande explicitement plus de détail.`;

// Gemini renvoie parfois une erreur 503 "UNAVAILABLE" transitoire (pic de charge côté Google,
// constaté en test) — sans reprise, une simple surcharge momentanée casse la conversation pour
// l'utilisateur alors qu'un second essai quelques secondes plus tard passe généralement.
async function genererAvecReprise(ai: GoogleGenAI, params: Parameters<GoogleGenAI['models']['generateContent']>[0], tentatives = 3): Promise<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>> {
  for (let i = 0; i < tentatives; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const transitoire = err?.status === 503 || err?.status === 429 || /UNAVAILABLE|RESOURCE_EXHAUSTED/.test(err?.message ?? '');
      if (!transitoire || i === tentatives - 1) throw err;
      // Un 429 free-tier indique généralement un délai de reprise (~10-15s) dans le message
      // d'erreur — un backoff court (1.5s/3s) ne suffit pas à l'épuiser, d'où des paliers plus
      // longs pour laisser le quota se libérer plutôt qu'échouer inutilement après 2 essais rapides.
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
  }
  throw new Error('Échec après plusieurs tentatives.');
}

export async function repondre(pool: Pool, apiKey: string, messages: MessageChat[]): Promise<string> {
  const dernierMessage = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  const contexte = await construireContexte(pool, dernierMessage);
  const ai = new GoogleGenAI({ apiKey });

  // Le contexte de données réelles est injecté juste avant le dernier message utilisateur (pas
  // dans systemInstruction seul) pour qu'il reste visible même sur les modèles/SDK qui tronquent
  // agressivement une instruction système très longue.
  const contents = messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    const text = isLast && m.role === 'user' ? `DONNÉES RÉELLES (JSON) :\n${JSON.stringify(contexte)}\n\nQuestion du médecin : ${m.text}` : m.text;
    return { role: m.role, parts: [{ text }] };
  });

  const response = await genererAvecReprise(ai, {
    model: MODELE,
    contents,
    config: { systemInstruction: INSTRUCTION_SYSTEME, temperature: 0.4 },
  });

  return response.text ?? '';
}
