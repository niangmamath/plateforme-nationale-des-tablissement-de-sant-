// Authentification du dashboard admin interne — isolée de l'auth des médecins (server/auth.ts).
// Même pattern (bcrypt + JWT + cookie), mais : table distincte (admin_users), cookie distinct
// (admin_session), secret JWT distinct (ADMIN_SESSION_SECRET), fonctions distinctes.
// Les deux systèmes ne partagent AUCUN code côté runtime : un bug ou une faille sur l'un ne doit
// pas pouvoir compromettre l'autre.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';
import { randomBytes, createHash } from 'crypto';
import type { Pool } from 'pg';
import { envoyerEmail, emailInvitationAdmin } from './email.js';
import { RateLimit } from './rateLimit.js';

export class ErreurAdminAuth extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_MAX_LONGUEUR = 254; // RFC 5321
const COOKIE_NOM = 'admin_session';
const DUREE_SESSION_JOURS = 6;
const INVITATION_DUREE_JOURS = 7;

// Protection brute-force par COMPTE : 5 essais → verrou 15 min (login_fail_count/login_locked_until).
const LOGIN_ESSAIS_MAX = 5;
const LOGIN_VERROU_MIN = 15;

// Protection brute-force par IP : complémentaire du verrou par compte (sinon un attaquant pourrait
// essayer 5 mdp sur chaque compte en séquence). 20 tentatives / 15 min / IP.
export const loginAdminRateLimit = new RateLimit(20, 15 * 60 * 1000, 'login-admin');

// Protection anti-spam sur /inviter : un admin dont la session serait volée pourrait sinon
// envoyer des centaines d'invitations (coût Resend + bruit).
export const inviterRateLimit = new RateLimit(10, 60 * 60 * 1000, 'inviter');

// Hash bcrypt factice pour éviter les timing attacks : si l'email n'existe pas, on exécute quand
// même un compare contre ce hash pour que le temps de réponse soit identique à un email existant.
// Généré une seule fois au boot avec bcrypt.hashSync('timing-attack-decoy', 10).
const HASH_FACTICE = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8f6Yh2qkCvDxYgvD5ZcLjKxP4ZcDa6';

export type RoleAdmin = 'admin' | 'lecteur';

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

function hacherToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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

    // Si le compte existe déjà (même sans hash), on ne touche à rien : un fondateur a pu changer
    // son mot de passe via l'UI, ou le seed précédent a déjà fait le travail.
    const { rows } = await pool.query<{ id: number; password_hash: string | null }>(
      'SELECT id, password_hash FROM admin_users WHERE email = $1',
      [email]
    );
    if (rows.length > 0) {
      // Compte existant : s'il a déjà un hash, on ne touche à rien. S'il n'en a pas (cas d'un
      // premier démarrage interrompu), on complète avec le mdp env si disponible.
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
    // Log sans email en clair : si les logs Vercel/Render sont consultés par un tiers, on ne veut
    // pas exposer les adresses des admins.
    console.log(`[admin] Fondateur #${i + 1} seedé.`);
  }
}

// --- Connexion ---
// Message d'erreur TOUJOURS identique pour email inexistant, mdp faux, ou compte non activé :
// évite l'énumération d'emails valides et l'identification des lecteurs en attente d'activation.
// Timing : on exécute un bcrypt.compare même quand l'email n'existe pas (contre un hash factice),
// pour que le temps de réponse ne révèle pas l'existence du compte.
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
    // Dummy bcrypt pour aligner le temps de réponse avec un email existant.
    await bcrypt.compare(motDePasse, HASH_FACTICE);
    throw new ErreurAdminAuth(401, MSG_INCORRECT);
  }
  const a = rows[0];

  if (a.login_locked_until && new Date(a.login_locked_until) > new Date()) {
    const minutesRestantes = Math.ceil((new Date(a.login_locked_until).getTime() - Date.now()) / 60000);
    throw new ErreurAdminAuth(429, `Trop de tentatives échouées — réessayez dans ${minutesRestantes} minute${minutesRestantes > 1 ? 's' : ''}.`);
  }

  if (!a.password_hash) {
    // Compte en attente d'activation (lecteur invité qui n'a pas encore cliqué son lien, ou
    // fondateur dont le hash n'a pas pu être seedé). Message volontairement générique, mais on
    // exécute quand même un compare factice pour aligner le timing.
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

  console.log(`[admin:audit] login OK — email=${email} role=${a.role} id=${a.id}`);
  return { id: a.id, email, role: a.role, is_founder: a.is_founder };
}

// --- Invitation d'un lecteur par un admin ---
export async function inviterLecteur(pool: Pool, emailBrut: unknown, parAdminId: number): Promise<{ urlDebug?: string }> {
  const email = normaliserEmail(emailBrut);

  const existe = await pool.query<{ id: number }>('SELECT id FROM admin_users WHERE email = $1', [email]);
  if (existe.rows.length > 0) {
    throw new ErreurAdminAuth(409, 'Un compte admin ou lecteur existe déjà avec cette adresse.');
  }

  const token = randomBytes(32).toString('hex');
  const expiration = new Date(Date.now() + INVITATION_DUREE_JOURS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO admin_users (email, role, is_founder, invited_by_admin_id, invitation_token_hash, invitation_expires)
     VALUES ($1, 'lecteur', false, $2, $3, $4)`,
    [email, parAdminId, hacherToken(token), expiration]
  );

  const baseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5174';
  const url = `${baseUrl}/admin/activer?token=${token}`;

  const { sujet, html, texte } = emailInvitationAdmin(url);
  await envoyerEmail(email, sujet, html, texte);

  // Audit : trace l'invitation sans jamais logger l'URL (qui contient le token). Le token n'est
  // visible qu'en dev (via urlDebug dans la réponse HTTP, jamais dans les logs serveur).
  console.log(`[admin:audit] invitation lecteur créée — par_admin_id=${parAdminId}`);
  const estDev = process.env.NODE_ENV !== 'production';
  return estDev ? { urlDebug: url } : {};
}

// --- Activation (clic sur le lien d'invitation) ---
export async function activerCompteParToken(pool: Pool, tokenBrut: unknown, mdpBrut: unknown): Promise<void> {
  if (typeof tokenBrut !== 'string' || !/^[0-9a-f]{64}$/i.test(tokenBrut)) {
    throw new ErreurAdminAuth(400, 'Lien d\'activation invalide.');
  }
  const mdp = validerNouveauMotDePasse(mdpBrut);

  const hash = hacherToken(tokenBrut);
  const { rows } = await pool.query<{ id: number; invitation_expires: string | null }>(
    'SELECT id, invitation_expires FROM admin_users WHERE invitation_token_hash = $1',
    [hash]
  );
  if (rows.length === 0) throw new ErreurAdminAuth(400, 'Lien d\'activation invalide ou déjà utilisé.');
  const a = rows[0];
  if (!a.invitation_expires || new Date(a.invitation_expires) < new Date()) {
    throw new ErreurAdminAuth(400, 'Lien d\'activation expiré — demandez une nouvelle invitation.');
  }

  const motDePasseHash = await bcrypt.hash(mdp, 10);
  await pool.query(
    `UPDATE admin_users
     SET password_hash = $1, invitation_token_hash = NULL, invitation_expires = NULL
     WHERE id = $2`,
    [motDePasseHash, a.id]
  );
}

// --- Révocation d'un lecteur par un admin ---
export async function revoquerLecteur(pool: Pool, parAdminId: number, cibleId: number): Promise<void> {
  if (cibleId === parAdminId) throw new ErreurAdminAuth(400, 'Impossible de révoquer son propre compte.');
  if (!Number.isInteger(cibleId) || cibleId <= 0) throw new ErreurAdminAuth(400, 'Identifiant invalide.');

  const { rows } = await pool.query<{ is_founder: boolean; role: RoleAdmin }>(
    'SELECT is_founder, role FROM admin_users WHERE id = $1',
    [cibleId]
  );
  if (rows.length === 0) throw new ErreurAdminAuth(404, 'Compte introuvable.');
  if (rows[0].is_founder) throw new ErreurAdminAuth(403, 'Impossible de révoquer un compte fondateur.');

  await pool.query('DELETE FROM admin_users WHERE id = $1', [cibleId]);
  console.log(`[admin:audit] révocation — par_admin_id=${parAdminId} cible_id=${cibleId}`);
}

// --- Lister les admins/lecteurs ---
export interface AdminListItem {
  id: number;
  email: string;
  role: RoleAdmin;
  is_founder: boolean;
  date_creation: string;
  active: boolean; // true si password_hash existe, false si invitation pas encore activée
  invite_par_email: string | null;
}

export async function listerAdmins(pool: Pool): Promise<AdminListItem[]> {
  const { rows } = await pool.query<AdminListItem>(
    `SELECT a.id, a.email, a.role, a.is_founder, a.date_creation,
            (a.password_hash IS NOT NULL) AS active,
            inv.email AS invite_par_email
     FROM admin_users a
     LEFT JOIN admin_users inv ON inv.id = a.invited_by_admin_id
     ORDER BY a.is_founder DESC, a.date_creation ASC`
  );
  return rows;
}

// --- Cookie & JWT ---
export function creerJetonAdmin(a: AdminPublic): string {
  return jwt.sign({ sub: a.id, email: a.email, role: a.role }, secretSession(), {
    expiresIn: `${DUREE_SESSION_JOURS}d`,
  });
}

export function cookieAdminSession(jeton: string): string {
  return serialize(COOKIE_NOM, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DUREE_SESSION_JOURS * 24 * 60 * 60,
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

// Renvoie l'admin courant à partir du cookie, ou null si absent/invalide/expiré.
// Ne lit JAMAIS le cookie "session" des médecins — seul "admin_session" est accepté.
export function administrateurDepuisCookies(cookieHeader: string | undefined): { id: number; email: string; role: RoleAdmin } | null {
  if (!cookieHeader) return null;
  const jeton = parse(cookieHeader)[COOKIE_NOM];
  if (!jeton) return null;
  try {
    const payload = jwt.verify(jeton, secretSession()) as unknown as { sub: number; email: string; role: RoleAdmin };
    if (payload.role !== 'admin' && payload.role !== 'lecteur') return null;
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
