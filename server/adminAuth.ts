// Authentification du dashboard admin interne — isolée de l'auth des médecins (server/auth.ts).
// Même pattern (bcrypt + JWT + cookie), mais : table distincte (admin_users), cookie distinct
// (admin_session), secret JWT distinct (ADMIN_SESSION_SECRET), fonctions distinctes.
// Les deux systèmes ne partagent AUCUN code côté runtime : un bug ou une faille sur l'un ne doit
// pas pouvoir compromettre l'autre.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';
import type { Pool } from 'pg';
import { RateLimit } from './rateLimit.js';

export class ErreurAdminAuth extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_MAX_LONGUEUR = 254; // RFC 5321
const COOKIE_NOM = 'admin_session';

// Session sliding : chaque action authentifiée prolonge le cookie de DUREE_SESSION_HEURES, dans la
// limite de MAX_SESSION_HEURES depuis le login initial. Après MAX_SESSION_HEURES, re-login
// obligatoire. Rationnel : 6 jours (ancienne valeur) exposait trop longtemps un cookie volé pour
// un panel admin — OWASP recommande 2-12h pour un rôle à privilèges.
const DUREE_SESSION_HEURES = 12;
const MAX_SESSION_HEURES = 24;

// Protection brute-force par COMPTE : 5 essais → verrou 15 min (login_fail_count/login_locked_until).
const LOGIN_ESSAIS_MAX = 5;
const LOGIN_VERROU_MIN = 15;

// Protection brute-force par IP : complémentaire du verrou par compte (sinon un attaquant pourrait
// essayer 5 mdp sur chaque compte en séquence). 20 tentatives / 15 min / IP.
export const loginAdminRateLimit = new RateLimit(20, 15 * 60 * 1000, 'login-admin');

// Hash bcrypt factice pour éviter les timing attacks : si l'email n'existe pas, on exécute quand
// même un compare contre ce hash pour que le temps de réponse soit identique à un email existant.
// Généré une seule fois au boot avec bcrypt.hashSync('timing-attack-decoy', 10).
const HASH_FACTICE = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8f6Yh2qkCvDxYgvD5ZcLjKxP4ZcDa6';

// Un seul rôle "admin" désormais (migration 037). Le type reste exporté pour éviter de casser les
// imports existants dans adminStats.ts et adminRouter.ts, mais toutes les valeurs sont 'admin'.
export type RoleAdmin = 'admin';

export interface AdminPublic {
  id: number;
  email: string;
  role: RoleAdmin;
  is_founder: boolean;
}

function secretSession(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new ErreurAdminAuth(500, 'ADMIN_SESSION_SECRET non définie côté serveur.');
  return secret;
}

function normaliserEmail(email: unknown): string {
  if (typeof email !== 'string') throw new ErreurAdminAuth(400, 'Adresse e-mail invalide.');
  const trimme = email.trim();
  if (trimme.length > EMAIL_MAX_LONGUEUR) throw new ErreurAdminAuth(400, 'Adresse e-mail invalide.');
  if (!EMAIL_RE.test(trimme)) throw new ErreurAdminAuth(400, 'Adresse e-mail invalide.');
  return trimme.toLowerCase();
}

function validerFormatMotDePasse(mdp: unknown): string {
  if (typeof mdp !== 'string' || mdp.length < 8) {
    throw new ErreurAdminAuth(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
  if (mdp.length > 200) throw new ErreurAdminAuth(400, 'Mot de passe trop long.');
  return mdp;
}

function validerNouveauMotDePasse(mdp: unknown): string {
  const valeur = validerFormatMotDePasse(mdp);
  if (!/[a-zA-Z]/.test(valeur) || !/[0-9]/.test(valeur)) {
    throw new ErreurAdminAuth(400, 'Le mot de passe doit contenir au moins une lettre et un chiffre.');
  }
  return valeur;
}

// --- Seed des fondateurs au démarrage du serveur ---
// Lit ADMIN_FOUNDER_EMAILS (CSV) et ADMIN_FOUNDER_PASSWORD_1..N, apparie dans l'ordre, et insère
// les comptes avec hash bcrypt s'ils n'existent pas déjà en base. Les mdp en clair ne quittent
// jamais la mémoire de ce process (jamais loggués, jamais stockés).
export async function seedFondateurs(pool: Pool): Promise<void> {
  const emailsBrut = process.env.ADMIN_FOUNDER_EMAILS;
  if (!emailsBrut) {
    console.warn('[admin] ADMIN_FOUNDER_EMAILS non défini — seed des fondateurs ignoré.');
    return;
  }

  const emails = emailsBrut.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) return;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    if (!EMAIL_RE.test(email)) {
      console.warn(`[admin] ADMIN_FOUNDER_EMAILS[${i}] "${email}" ignoré (format invalide).`);
      continue;
    }

    // Si le compte existe déjà avec un hash, on ne touche à rien : un fondateur a pu changer son
    // mot de passe via l'UI. Si pas de hash (premier démarrage interrompu), on complète.
    const { rows } = await pool.query<{ id: number; password_hash: string | null }>(
      'SELECT id, password_hash FROM admin_users WHERE email = $1',
      [email]
    );
    if (rows.length > 0) {
      if (rows[0].password_hash) continue;
      const mdp = process.env[`ADMIN_FOUNDER_PASSWORD_${i + 1}`];
      if (!mdp) {
        console.warn(`[admin] Fondateur ${email} présent sans hash et ADMIN_FOUNDER_PASSWORD_${i + 1} manquant.`);
        continue;
      }
      const hash = await bcrypt.hash(mdp, 10);
      await pool.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, rows[0].id]);
      console.log(`[admin] Hash du fondateur #${i + 1} initialisé.`);
      continue;
    }

    const mdp = process.env[`ADMIN_FOUNDER_PASSWORD_${i + 1}`];
    if (!mdp) {
      console.warn(`[admin] ADMIN_FOUNDER_PASSWORD_${i + 1} manquant — fondateur ${email} non seedé.`);
      continue;
    }
    const hash = await bcrypt.hash(mdp, 10);
    await pool.query(
      `INSERT INTO admin_users (email, password_hash, role, is_founder)
       VALUES ($1, $2, 'admin', true)`,
      [email, hash]
    );
    console.log(`[admin] Fondateur #${i + 1} seedé.`);
  }
}

// --- Connexion ---
// Message d'erreur TOUJOURS identique pour email inexistant, mdp faux : évite l'énumération.
// Timing : on exécute un bcrypt.compare même quand l'email n'existe pas (hash factice) pour
// aligner les durées de réponse.
export async function connecterAdmin(pool: Pool, emailBrut: unknown, mdpBrut: unknown): Promise<AdminPublic> {
  const email = normaliserEmail(emailBrut);
  const motDePasse = validerFormatMotDePasse(mdpBrut);

  const { rows } = await pool.query<{
    id: number; password_hash: string | null; role: RoleAdmin; is_founder: boolean;
    login_fail_count: number; login_locked_until: string | null;
  }>(
    'SELECT id, password_hash, role, is_founder, login_fail_count, login_locked_until FROM admin_users WHERE email = $1',
    [email]
  );

  const MSG_INCORRECT = 'E-mail ou mot de passe incorrect.';

  if (rows.length === 0) {
    await bcrypt.compare(motDePasse, HASH_FACTICE);
    throw new ErreurAdminAuth(401, MSG_INCORRECT);
  }
  const a = rows[0];

  if (a.login_locked_until && new Date(a.login_locked_until) > new Date()) {
    const minutesRestantes = Math.ceil((new Date(a.login_locked_until).getTime() - Date.now()) / 60000);
    throw new ErreurAdminAuth(429, `Trop de tentatives échouées — réessayez dans ${minutesRestantes} minute${minutesRestantes > 1 ? 's' : ''}.`);
  }

  if (!a.password_hash) {
    await bcrypt.compare(motDePasse, HASH_FACTICE);
    throw new ErreurAdminAuth(401, MSG_INCORRECT);
  }

  const valide = await bcrypt.compare(motDePasse, a.password_hash);
  if (!valide) {
    const essais = a.login_fail_count + 1;
    if (essais >= LOGIN_ESSAIS_MAX) {
      await pool.query(
        'UPDATE admin_users SET login_fail_count = 0, login_locked_until = $1 WHERE id = $2',
        [new Date(Date.now() + LOGIN_VERROU_MIN * 60 * 1000), a.id]
      );
    } else {
      await pool.query('UPDATE admin_users SET login_fail_count = $1 WHERE id = $2', [essais, a.id]);
    }
    throw new ErreurAdminAuth(401, MSG_INCORRECT);
  }

  if (a.login_fail_count > 0 || a.login_locked_until) {
    await pool.query('UPDATE admin_users SET login_fail_count = 0, login_locked_until = NULL WHERE id = $1', [a.id]);
  }

  console.log(`[admin:audit] login OK — email=${email} id=${a.id}`);
  return { id: a.id, email, role: a.role, is_founder: a.is_founder };
}

// --- Changement de mot de passe depuis l'espace compte ---
// Vérifie l'ancien mot de passe pour éviter qu'une session volée serve à verrouiller le compte.
export async function changerMotDePasseAdmin(
  pool: Pool,
  adminId: number,
  ancienMdp: unknown,
  nouveauMdp: unknown,
): Promise<void> {
  const ancien = validerFormatMotDePasse(ancienMdp);
  const nouveau = validerNouveauMotDePasse(nouveauMdp);
  if (ancien === nouveau) {
    throw new ErreurAdminAuth(400, 'Le nouveau mot de passe doit être différent de l\'ancien.');
  }

  const { rows } = await pool.query<{ password_hash: string | null }>(
    'SELECT password_hash FROM admin_users WHERE id = $1',
    [adminId],
  );
  if (rows.length === 0 || !rows[0].password_hash) {
    throw new ErreurAdminAuth(404, 'Compte introuvable.');
  }

  const valide = await bcrypt.compare(ancien, rows[0].password_hash);
  if (!valide) throw new ErreurAdminAuth(401, 'Ancien mot de passe incorrect.');

  const hash = await bcrypt.hash(nouveau, 10);
  await pool.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, adminId]);
  console.log(`[admin:audit] mot de passe changé — admin_id=${adminId}`);
}

// --- Cookie & JWT ---
// Le payload porte deux expirations : `exp` (sliding, 12h, renouvelé à chaque requête via
// administrateurDepuisCookies+ ajout d'un setCookie) et `maxExp` (absolu, 24h depuis le 1er login,
// JAMAIS renouvelé — oblige à se reconnecter au bout de 24h même si la session est active).
interface JwtPayloadAdmin {
  sub: number;
  email: string;
  role: RoleAdmin;
  maxExp: number; // epoch secondes
}

export function creerJetonAdmin(a: AdminPublic): string {
  const maintenantSec = Math.floor(Date.now() / 1000);
  const maxExp = maintenantSec + MAX_SESSION_HEURES * 3600;
  return jwt.sign(
    { sub: a.id, email: a.email, role: a.role, maxExp },
    secretSession(),
    { expiresIn: `${DUREE_SESSION_HEURES}h` },
  );
}

// Rafraîchit un jeton (sliding) sans dépasser maxExp. Rend null si on a atteint la limite absolue
// — l'appelant doit renvoyer un cookie de déconnexion dans ce cas.
export function rafraichirJetonAdmin(payload: JwtPayloadAdmin): string | null {
  const maintenantSec = Math.floor(Date.now() / 1000);
  if (payload.maxExp <= maintenantSec) return null;
  // On capsule la nouvelle expiration par maxExp pour ne jamais la dépasser.
  const nouvelExp = Math.min(maintenantSec + DUREE_SESSION_HEURES * 3600, payload.maxExp);
  const dureeRestantesSec = nouvelExp - maintenantSec;
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role, maxExp: payload.maxExp },
    secretSession(),
    { expiresIn: dureeRestantesSec },
  );
}

export function cookieAdminSession(jeton: string): string {
  // On lit la vraie expiration dans le jeton pour que maxAge du cookie suive, sinon un cookie
  // envoyé par rafraichirJetonAdmin près de maxExp aurait un maxAge trop long.
  const decoded = jwt.decode(jeton) as { exp?: number } | null;
  const expSec = decoded?.exp ?? Math.floor(Date.now() / 1000) + DUREE_SESSION_HEURES * 3600;
  const maxAge = Math.max(0, expSec - Math.floor(Date.now() / 1000));
  return serialize(COOKIE_NOM, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function cookieDeconnexionAdmin(): string {
  return serialize(COOKIE_NOM, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export interface AdminSession {
  id: number;
  email: string;
  role: RoleAdmin;
  maxExp: number;
  payload: JwtPayloadAdmin; // pour rafraichirJetonAdmin
}

// Renvoie l'admin courant + le payload JWT (nécessaire au sliding) ou null si invalide/expiré.
// Ne lit JAMAIS le cookie "session" des médecins — seul "admin_session" est accepté.
export function administrateurDepuisCookies(cookieHeader: string | undefined): AdminSession | null {
  if (!cookieHeader) return null;
  const jeton = parse(cookieHeader)[COOKIE_NOM];
  if (!jeton) return null;
  try {
    const payload = jwt.verify(jeton, secretSession()) as unknown as JwtPayloadAdmin;
    if (payload.role !== 'admin') return null;
    if (!payload.maxExp || typeof payload.maxExp !== 'number') return null;
    // Garde-fou : le maxExp absolu peut être dépassé si l'horloge s'est décalée entre le signage et
    // la vérification (rare, mais possible). jwt.verify s'occupe de l'exp sliding, pas de maxExp.
    if (payload.maxExp <= Math.floor(Date.now() / 1000)) return null;
    return { id: payload.sub, email: payload.email, role: payload.role, maxExp: payload.maxExp, payload };
  } catch {
    return null;
  }
}
