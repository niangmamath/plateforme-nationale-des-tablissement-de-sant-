import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../_lib/db.js';
import { routerAdmin } from '../../server/adminRouter.js';
import { ipDeRequete } from '../../server/rateLimit.js';

// Un seul fichier Vercel pour toutes les actions /api/admin-ui/* (login, logout, me, activer,
// inviter, revoquer, acces, stats) — pour tenir sous la limite de 12 fonctions serverless du
// plan Hobby. Le dispatch réel est dans server/adminRouter.ts (partagé avec server/index.ts).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // La route réelle est après "/api/admin-ui" (ex: "/login"). Sur Vercel, req.url contient aussi
  // la query string éventuelle, donc on la coupe au ? avant.
  const url = req.url || '';
  const sansQuery = url.split('?')[0];
  const sousPath = sansQuery.replace(/^\/api\/admin-ui/, '') || '/';

  const result = await routerAdmin(getPool(), {
    method: req.method,
    cookieHeader: req.headers.cookie,
    body: req.body,
    query: req.query as Record<string, string | string[] | undefined>,
    path: sousPath,
    ip: ipDeRequete(req.headers['x-forwarded-for'], req.socket?.remoteAddress),
  });
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
  res.status(result.status).json(result.body);
}
