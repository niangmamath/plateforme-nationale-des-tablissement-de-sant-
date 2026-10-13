// Routeur partagé pour toutes les actions /api/admin-ui/* — importé par server/index.ts (Express)
// ET par api/admin-ui.ts (fonction serverless Vercel). Évite de dupliquer la logique de dispatch,
// la gestion d'erreurs et les checks de rôle entre les deux environnements.

import type { Pool } from 'pg';
import {
  connecterAdmin, inviterLecteur, activerCompteParToken, revoquerLecteur, listerAdmins,
  creerJetonAdmin, cookieAdminSession, cookieDeconnexionAdmin, administrateurDepuisCookies,
  ErreurAdminAuth, loginAdminRateLimit, inviterRateLimit,
} from './adminAuth.js';
import { obtenirStats, estSectionValide, ErreurAdminStats } from './adminStats.js';

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

    if (method === 'POST' && path === '/activer') {
      const { token, password } = req.body ?? {};
      await activerCompteParToken(pool, token, password);
      return { status: 200, body: { ok: true } };
    }

    if (method === 'POST' && path === '/inviter') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      if (a.role !== 'admin') return { status: 403, body: { error: 'Réservé aux administrateurs.' } };
      // Rate limit par admin : si une session est volée, limite le spam d'invitations.
      const limite = inviterRateLimit.verifier(`admin:${a.id}`);
      if (!limite.ok) {
        return { status: 429, body: { error: 'Vous avez atteint la limite d\'invitations pour l\'heure en cours. Réessayez plus tard.' } };
      }
      const { email } = req.body ?? {};
      const r = await inviterLecteur(pool, email, a.id);
      return { status: 200, body: { ok: true, ...r } };
    }

    if (method === 'POST' && path === '/revoquer') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      if (a.role !== 'admin') return { status: 403, body: { error: 'Réservé aux administrateurs.' } };
      const { id } = req.body ?? {};
      if (typeof id !== 'number') return { status: 400, body: { error: 'Paramètre `id` numérique requis.' } };
      await revoquerLecteur(pool, a.id, id);
      return { status: 200, body: { ok: true } };
    }

    if (method === 'GET' && path === '/acces') {
      const a = administrateurDepuisCookies(req.cookieHeader);
      if (!a) return { status: 401, body: { error: 'Non connecté.' } };
      if (a.role !== 'admin') return { status: 403, body: { error: 'Réservé aux administrateurs.' } };
      return { status: 200, body: await listerAdmins(pool) };
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
    if (err instanceof ErreurAdminAuth || err instanceof ErreurAdminStats) {
      return { status: err.status, body: { error: err.message } };
    }
    console.error(`Erreur /api/admin-ui${path} :`, err);
    return { status: 500, body: { error: 'Erreur serveur, réessayez plus tard.' } };
  }
}
