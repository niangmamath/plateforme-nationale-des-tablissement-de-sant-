// Routeur partagé pour toutes les actions /api/admin-ui/* — importé par server/index.ts (Express)
// ET par api/admin-ui.ts (fonction serverless Vercel). Évite de dupliquer la logique de dispatch,
// la gestion d'erreurs et les checks de rôle entre les deux environnements.

import type { Pool } from 'pg';
import {
  connecterAdmin, changerMotDePasseAdmin,
  creerJetonAdmin, cookieAdminSession, cookieDeconnexionAdmin, administrateurDepuisCookies,
  ErreurAdminAuth, loginAdminRateLimit,
} from './adminAuth.js';
import { obtenirStats, estSectionValide, ErreurAdminStats } from './adminStats.js';
import {
  listerSignalements, mettreAJourSignalement, repondreSignalement, obtenirSignalement,
  ErreurSignalement,
} from './adminSignalements.js';
import {
  listerMessages, envoyerMessage, marquerLuJusquA, supprimerMessage, compterNonLus,
  ErreurMessages,
} from './adminMessages.js';

export interface AdminReq {
  method: string | undefined;
  cookieHeader: string | undefined;
  body: any;
  query: Record<string, string | string[] | undefined>;
  path: string; // chemin APRÈS "/api/admin-ui" (ex: "/login", "/stats", "/me")
  ip: string;
}

export interface AdminRes {
  status: number;
  body: unknown;
  setCookie?: string;
}

// Cache in-memory des réponses /stats — 30s TTL. Les stats bougent peu à l'échelle de la seconde
// et un admin qui navigue entre onglets ne doit pas pilonner Postgres. Clé = `${section}:${role}`
// (le role compte car un lecteur reçoit un payload masqué). Limitation Vercel : chaque instance
// a son cache propre, pas de synchronisation entre instances serverless froides.
const CACHE_STATS_TTL_MS = 30_000;
interface CacheEntry { expiresAt: number; data: unknown }
const cacheStats = new Map<string, CacheEntry>();

function lireCache(cle: string): unknown | null {
  const e = cacheStats.get(cle);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { cacheStats.delete(cle); return null; }
  return e.data;
}

function ecrireCache(cle: string, data: unknown): void {
  cacheStats.set(cle, { expiresAt: Date.now() + CACHE_STATS_TTL_MS, data });
}

// Dispatcher principal. L'appelant (Express ou Vercel) adapte juste l'entrée et la sortie.
export async function routerAdmin(pool: Pool, req: AdminReq): Promise<AdminRes> {
  const { method, path } = req;

  try {
    if (method === 'GET' && path === '/me') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      return { status: 200, body: { id: a.id, email: a.email, role: a.role } };
    }

    if (method === 'POST' && path === '/login') {
      // Rate limit par IP, complémentaire du verrou par compte dans adminAuth.ts.
      const limite = loginAdminRateLimit.verifier(req.ip);
      if (!limite.ok) {
        return { status: 429, body: { error: `Trop de tentatives — réessayez dans ${Math.ceil((limite.secondsRestantes ?? 60) / 60)} minute(s).` } };
      }
      const { email, password } = req.body ?? {};
      const admin = await connecterAdmin(pool, email, password);
      return {
        status: 200,
        body: { id: admin.id, email: admin.email, role: admin.role },
        setCookie: cookieAdminSession(creerJetonAdmin(admin)),
      };
    }

    if (method === 'POST' && path === '/logout') {
      return { status: 200, body: { ok: true }, setCookie: cookieDeconnexionAdmin() };
    }

    // Changement de mot de passe depuis l'espace compte.
    if (method === 'POST' && path === '/password') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const { ancien, nouveau } = req.body ?? {};
      await changerMotDePasseAdmin(pool, a.id, ancien, nouveau);
      return { status: 200, body: { ok: true } };
    }

    // --- Messagerie interne ---
    if (method === 'GET' && path === '/messages') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const limite = typeof req.query.limite === 'string' ? Number(req.query.limite) : undefined;
      return { status: 200, body: await listerMessages(pool, a.id, limite) };
    }

    if (method === 'GET' && path === '/messages/non-lus') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      return { status: 200, body: await compterNonLus(pool, a.id) };
    }

    if (method === 'POST' && path === '/messages') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const { contenu } = req.body ?? {};
      const m = await envoyerMessage(pool, a.id, contenu);
      return { status: 200, body: m };
    }

    if (method === 'POST' && path === '/messages/lu') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const { dernier_id } = req.body ?? {};
      await marquerLuJusquA(pool, a.id, Number(dernier_id ?? 0));
      return { status: 200, body: { ok: true } };
    }

    const matchSupprMsg = /^\/messages\/(\d+)$/.exec(path);
    if (method === 'DELETE' && matchSupprMsg) {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      await supprimerMessage(pool, a.id, Number(matchSupprMsg[1]));
      return { status: 200, body: { ok: true } };
    }

    // --- Signalements : actions de traitement (admin uniquement, données nominatives) ---
    if (method === 'GET' && path === '/signalements') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const statut = typeof req.query.statut === 'string' ? req.query.statut : undefined;
      const limite = typeof req.query.limite === 'string' ? Number(req.query.limite) : undefined;
      const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined;
      const data = await listerSignalements(pool, { q, statut, limite, offset });
      return { status: 200, body: data };
    }

    const matchDetail = /^\/signalements\/(\d+)$/.exec(path);
    if (method === 'GET' && matchDetail) {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const id = Number(matchDetail[1]);
      const s = await obtenirSignalement(pool, id);
      if (!s) return { status: 404, body: { error: 'Signalement introuvable.' } };
      return { status: 200, body: s };
    }

    if (method === 'PATCH' && matchDetail) {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const id = Number(matchDetail[1]);
      const { statut, note_interne } = req.body ?? {};
      const s = await mettreAJourSignalement(pool, a.id, id, { statut, note_interne });
      cacheStats.clear();
      return { status: 200, body: s };
    }

    const matchRepondre = /^\/signalements\/(\d+)\/repondre$/.exec(path);
    if (method === 'POST' && matchRepondre) {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const id = Number(matchRepondre[1]);
      const { message } = req.body ?? {};
      await repondreSignalement(pool, a.id, id, String(message ?? ''));
      cacheStats.clear();
      return { status: 200, body: { ok: true } };
    }

    if (method === 'GET' && path === '/stats') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      const section = req.query.section;
      if (!estSectionValide(section)) return { status: 400, body: { error: 'Section inconnue.' } };
      const cle = `${section}:${a.role}`;
      const cached = lireCache(cle);
      if (cached) return { status: 200, body: cached };
      const data = await obtenirStats(pool, section, a.role);
      ecrireCache(cle, data);
      return { status: 200, body: data };
    }

    return { status: 404, body: { error: 'Route admin inconnue.' } };
  } catch (err: any) {
    if (err instanceof ErreurAdminAuth || err instanceof ErreurAdminStats || err instanceof ErreurSignalement || err instanceof ErreurMessages) {
      return { status: err.status, body: { error: err.message } };
    }
    console.error(`Erreur /api/admin-ui${path} :`, err);
    return { status: 500, body: { error: 'Erreur serveur, réessayez plus tard.' } };
  }
}
