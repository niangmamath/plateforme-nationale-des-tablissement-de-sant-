import { Pool } from 'pg';
import { GoogleGenAI } from '@google/genai';
import { getPays, getSpecialites } from './queries.js';

const MODELE_GEMINI = 'gemini-2.5-flash';
const MODELE_OPENAI = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

export interface MessageChat {
  role: 'user' | 'model';
  text: string;
}

// Clés des fournisseurs d'IA configurés côté serveur. OpenAI est prioritaire quand les deux sont
// définies (le quota gratuit de Gemini est de 20 requêtes/jour : insuffisant pour un vrai usage).
export interface ClesIA {
  openai?: string;
  gemini?: string;
}

// Erreur dont le message peut être renvoyé tel quel à l'utilisateur. Le détail d'une erreur du
// fournisseur (qui peut citer un extrait de clé ou un identifiant de compte) n'est jamais exposé :
// il est seulement journalisé côté serveur.
export class ErreurChat extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const MESSAGE_INDISPONIBLE = "L'assistant est momentanément indisponible. Réessayez dans quelques instants.";

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
    ORDER BY ville, categorie, nombre DESC, arrondissement
  `);
  return rows as Array<{ categorie: string; ville: string; arrondissement: string; nombre: number }>;
}

function enleverAccents(s: string): string {
  return s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();
}

// Villes citées dans la conversation (mot entier, sans accents ni casse : "Salé" ~ "sale"). Sans
// ville citée on garde tout ; avec une ville citée on ne transmet QUE ses lignes — avec les 6
// villes mélangées, le modèle a attribué à Casablanca des arrondissements de Marrakech et raté le
// classement des zones les plus saturées (constaté en test).
function detecterVilles(villes: string[], texteUtilisateur: string): string[] {
  const texte = enleverAccents(texteUtilisateur);
  return villes.filter((v) => new RegExp('\\b' + enleverAccents(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(texte));
}

// Réduit la table de concurrence (~650 lignes, 18 spécialités × 6 villes) à la ou les spécialités
// mentionnées dans la conversation, quand on peut les identifier — sur un contexte plus petit
// et plus ciblé, le modèle retrouve nettement plus fiablement les bonnes lignes (effet "lost in
// the middle" constaté en test : avec les 650 lignes complètes, le modèle a d'abord affirmé à tort
// qu'il manquait des données pour "Pédiatre" alors qu'elles étaient bien présentes). Si aucune
// spécialité connue n'est détectée dans le texte, on garde tout plutôt que de risquer de couper
// une donnée pertinente.
function filtrerConcurrencePourMessage(
  concurrence: Array<{ categorie: string; ville: string; arrondissement: string; nombre: number }>,
  specialites: Awaited<ReturnType<typeof getSpecialites>>,
  texteUtilisateur: string
) {
  const texte = enleverAccents(texteUtilisateur);
  const categoriesDetectees = specialites
    .filter((s) => {
      const formes = [s.categorieEtablissement, s.nom].filter(Boolean).map(enleverAccents);
      return formes.some((f) => texte.includes(f) || texte.includes(f.slice(0, Math.max(6, f.length - 2))));
    })
    .map((s) => s.categorieEtablissement);

  if (categoriesDetectees.length === 0) return concurrence;
  return concurrence.filter((c) => categoriesDetectees.includes(c.categorie));
}

async function construireContexte(pool: Pool, texteUtilisateur: string) {
  const [pays, specialites, concurrence] = await Promise.all([getPays(pool), getSpecialites(pool), chargerConcurrence(pool)]);
  const villesMentionnees = detecterVilles(pays.flatMap((p) => p.villes.map((v) => v.nom)), texteUtilisateur);

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

  const concurrenceFiltree = filtrerConcurrencePourMessage(concurrence, specialites, texteUtilisateur)
    .filter((c) => villesMentionnees.length === 0 || villesMentionnees.includes(c.ville));

  // specialites (petite table, 18 entrées) en dernier, juste avant la question — les deux
  // extrémités d'un contexte sont mieux rappelées par le modèle que le milieu ("lost in the
  // middle"), et c'est la table la plus souvent nécessaire pour répondre à la question posée.
  const demographieFiltree = villesMentionnees.length === 0 ? demographieParVille : demographieParVille.filter((d) => villesMentionnees.includes(d.ville));

  return { demographieParVille: demographieFiltree, concurrenceParArrondissement: concurrenceFiltree, specialites: specialitesResume };
}

const INSTRUCTION_SYSTEME = `Tu es Empower, l'assistant IA d'Empower Doctor, une plateforme qui aide les professionnels de santé, entrepreneurs, investisseurs et tout autre utilisateur à choisir où implanter un cabinet, une clinique ou un autre établissement de santé au Maroc (6 villes : Casablanca, Rabat, Salé, Fès, Marrakech, Tanger).

Tu reçois à chaque message un bloc JSON "DONNÉES RÉELLES" contenant, tel qu'enregistré en base aujourd'hui :
- demographieParVille : pour chaque ville, chaque zone/arrondissement avec sa population, la part de 15-59 ans et de 60+ ans, la densité, le prix et le loyer moyen au m².
- specialites : la liste complète des spécialités actives du site (chacune y a une entrée) et la pondération que l'algorithme du site utilise pour chacune (prix, population, densité, tranche d'âge ciblée, concurrence). Une répartition égale entre les 6 critères veut dire qu'aucun ne domine pour cette spécialité — c'est une valeur normale, pas une absence de donnée.
- concurrenceParArrondissement : le nombre de confrères déjà recensés par spécialité et par arrondissement — sers-t'en pour juger si une zone est saturée ou au contraire sous-desservie. Chaque ligne porte SA ville et les lignes d'une même ville et spécialité sont triées du plus au moins nombreux : pour "les zones les plus saturées", prends les premières lignes de la ville demandée, dans cet ordre.

Règles :
- Ne cite QUE des chiffres présents dans ce bloc JSON. N'invente jamais un pourcentage, un prix ou un nombre de confrères.
- N'attribue jamais un arrondissement à une autre ville que celle indiquée sur sa ligne, et quand tu classes des zones, respecte l'ordre exact des nombres (ne saute pas une zone plus chargée).
- Si l'information demandée n'est pas dans les données fournies (ex. une ville hors des 6 couvertes), dis-le clairement plutôt que d'improviser.
- Réponds en français, dans un style professionnel et direct, comme un conseiller en implantation qui s'adresse à un interlocuteur dont tu ne connais pas le métier (ne suppose jamais qu'il est médecin ; tutoiement interdit, vouvoiement). Pas de markdown, pas de listes à puces longues — des phrases, avec les chiffres clés intégrés naturellement.
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

async function repondreGemini(apiKey: string, historique: MessageChat[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await genererAvecReprise(ai, {
    model: MODELE_GEMINI,
    contents: historique.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    config: { systemInstruction: INSTRUCTION_SYSTEME, temperature: 0.4 },
  });
  return response.text ?? '';
}

// Appel HTTP direct à l'API Chat Completions : une seule route, pas besoin d'ajouter le SDK
// `openai` (et son poids) comme dépendance de la fonction serverless.
async function repondreOpenAI(apiKey: string, historique: MessageChat[]): Promise<string> {
  const corps = JSON.stringify({
    model: MODELE_OPENAI,
    temperature: 0.4,
    messages: [
      { role: 'system', content: INSTRUCTION_SYSTEME },
      ...historique.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
    ],
  });

  // Une reprise seulement, courte : la fonction Vercel a un délai d'exécution limité, on ne peut
  // pas s'offrir les paliers de plusieurs secondes utilisés pour Gemini.
  for (let tentative = 0; tentative < 2; tentative++) {
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: corps,
        signal: AbortSignal.timeout(40000),
      });
    } catch (err) {
      console.error('Chat OpenAI : appel impossible :', err);
      throw new ErreurChat(502, MESSAGE_INDISPONIBLE);
    }

    if (res.ok) {
      const data: any = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }

    const detail: any = await res.json().catch(() => ({}));
    const code: string | undefined = detail?.error?.code;
    // 429 "insufficient_quota" = plus de crédit sur le compte : inutile de réessayer. Un 429
    // "rate_limit_exceeded" ou une 5xx sont en revanche transitoires.
    const transitoire = (res.status === 429 && code !== 'insufficient_quota') || res.status >= 500;
    if (transitoire && tentative === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    console.error(`Chat OpenAI : HTTP ${res.status} (${code ?? 'sans code'}) — ${String(detail?.error?.message ?? '').replace(/sk-[A-Za-z0-9_\-*]+/g, 'sk-***')}`);
    throw new ErreurChat(res.status === 429 ? 429 : 502, MESSAGE_INDISPONIBLE);
  }
  throw new ErreurChat(502, MESSAGE_INDISPONIBLE);
}

export async function repondre(pool: Pool, cles: ClesIA, messages: MessageChat[]): Promise<string> {
  if (!cles.openai && !cles.gemini) throw new ErreurChat(500, "Aucune clé d'IA n'est configurée côté serveur (OPENAI_API_KEY ou GEMINI_API_KEY).");

  // Ville et spécialité se déduisent de TOUTE la conversation, pas du seul dernier message : un
  // suivi comme "et les plus saturés ?" ne répète pas la ville évoquée deux tours plus tôt.
  const texteUtilisateur = messages.filter((m) => m.role === 'user').map((m) => m.text).join('\n');
  const contexte = await construireContexte(pool, texteUtilisateur);

  // Le contexte de données réelles est injecté juste avant le dernier message utilisateur (pas
  // dans l'instruction système seule) pour qu'il reste visible même sur les modèles/SDK qui
  // tronquent agressivement une instruction système très longue.
  const historique = messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    const text = isLast && m.role === 'user' ? `DONNÉES RÉELLES (JSON) :\n${JSON.stringify(contexte)}\n\nQuestion de l'utilisateur : ${m.text}` : m.text;
    return { role: m.role, text };
  });

  try {
    return cles.openai ? await repondreOpenAI(cles.openai, historique) : await repondreGemini(cles.gemini!, historique);
  } catch (err) {
    if (err instanceof ErreurChat) throw err;
    console.error('Chat : erreur du fournisseur d\'IA :', err);
    throw new ErreurChat(502, MESSAGE_INDISPONIBLE);
  }
}
