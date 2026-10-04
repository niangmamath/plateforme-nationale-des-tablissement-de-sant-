import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';
import { OAuth2Client } from 'google-auth-library';
import { randomInt, createHash } from 'crypto';
import type { Pool } from 'pg';
import { envoyerEmail, emailCodeVerification, emailBienvenue, emailCodeReinitialisation } from './email.js';

export class ErreurAuth extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COOKIE_NOM = 'session';
const DUREE_SESSION_JOURS = 6;

function secretSession(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new ErreurAuth(500, 'SESSION_SECRET non définie côté serveur.');
  return secret;
}

function normaliserEmail(email: unknown): string {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw new ErreurAuth(400, 'Adresse e-mail invalide.');
  }
  return email.trim().toLowerCase();
}

// Utilisée à la connexion : juste des bornes de taille (format), jamais de règle de robustesse —
// un compte créé avant un durcissement de la politique doit pouvoir continuer à se connecter avec
// son mot de passe existant, même s'il ne la respecterait plus rétroactivement.
function validerFormatMotDePasse(mdp: unknown): string {
  if (typeof mdp !== 'string' || mdp.length < 8) {
    throw new ErreurAuth(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
  if (mdp.length > 200) throw new ErreurAuth(400, 'Mot de passe trop long.');
  return mdp;
}

// Utilisée uniquement quand on FIXE un mot de passe (inscription, réinitialisation) : au moins une
// lettre ET un chiffre, pour qu'une suite de chiffres seule ("12345678") ne suffise plus.
function validerNouveauMotDePasse(mdp: unknown): string {
  const valeur = validerFormatMotDePasse(mdp);
  if (!/[a-zA-Z]/.test(valeur) || !/[0-9]/.test(valeur)) {
    throw new ErreurAuth(400, 'Le mot de passe doit contenir au moins une lettre et un chiffre.');
  }
  return valeur;
}

export interface UtilisateurPublic {
  id: number;
  email: string;
}

// --- OTP (vérification d'e-mail + réinitialisation de mot de passe) ---
// Code à 6 chiffres, jamais stocké en clair (seul son SHA-256 l'est — voir migration 029), valable
// 15 minutes, 5 essais max avant de devoir en redemander un, et un délai minimal entre deux envois
// pour limiter l'abus (coût Resend, spam de la boîte visée).
const OTP_DUREE_MIN = 15;
const OTP_ESSAIS_MAX = 5;
const OTP_DELAI_RENVOI_SEC = 60;

// Protection contre le brute-force sur la connexion — aucune limite n'existait auparavant
// (vérifié en production : 10 tentatives rapides toutes acceptées). Même principe que le verrou
// OTP : 5 échecs déclenchent un verrou de 15 minutes sur le compte.
const LOGIN_ESSAIS_MAX = 5;
const LOGIN_VERROU_MIN = 15;

function genererOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
function hacherOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
function expirationOtp(): Date {
  return new Date(Date.now() + OTP_DUREE_MIN * 60 * 1000);
}
function validerCodeOtp(code: unknown): string {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new ErreurAuth(400, 'Code invalide (6 chiffres attendus).');
  }
  return code;
}

export async function inscrire(pool: Pool, emailBrut: unknown, mdpBrut: unknown): Promise<UtilisateurPublic> {
  const email = normaliserEmail(emailBrut);
  const motDePasse = validerNouveauMotDePasse(mdpBrut);

  const existant = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existant.rows.length > 0) {
    throw new ErreurAuth(409, 'Un compte existe déjà avec cette adresse e-mail.');
  }

  const hash = await bcrypt.hash(motDePasse, 10);
  const code = genererOtp(); if (process.env.DEBUG_OTP) console.log("DEBUG_OTP:", email, code);
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, email_verification_otp_hash, email_verification_otp_expires)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, hash, hacherOtp(code), expirationOtp()]
  );

  const { sujet, html, texte } = emailCodeVerification(code);
  await envoyerEmail(email, sujet, html, texte);

  return { id: rows[0].id, email };
}

export async function connecter(pool: Pool, emailBrut: unknown, mdpBrut: unknown): Promise<UtilisateurPublic> {
  const email = normaliserEmail(emailBrut);
  const motDePasse = validerFormatMotDePasse(mdpBrut);

  const { rows } = await pool.query<{
    id: number; password_hash: string | null; email_verified: boolean;
    login_fail_count: number; login_locked_until: string | null;
  }>(
    'SELECT id, password_hash, email_verified, login_fail_count, login_locked_until FROM users WHERE email = $1',
    [email]
  );
  // Même message que « mot de passe incorrect » : ne pas révéler si l'email existe en base.
  if (rows.length === 0) throw new ErreurAuth(401, 'E-mail ou mot de passe incorrect.');
  const u = rows[0];

  if (u.login_locked_until && new Date(u.login_locked_until) > new Date()) {
    const minutesRestantes = Math.ceil((new Date(u.login_locked_until).getTime() - Date.now()) / 60000);
    throw new ErreurAuth(429, `Trop de tentatives échouées — réessayez dans ${minutesRestantes} minute${minutesRestantes > 1 ? 's' : ''}.`);
  }

  // Compte créé via Google, sans mot de passe défini.
  if (!u.password_hash) {
    throw new ErreurAuth(400, 'Ce compte a été créé avec Google — connectez-vous avec le bouton Google.');
  }

  const valide = await bcrypt.compare(motDePasse, u.password_hash);
  if (!valide) {
    const essais = u.login_fail_count + 1;
    if (essais >= LOGIN_ESSAIS_MAX) {
      await pool.query(
        'UPDATE users SET login_fail_count = 0, login_locked_until = $1 WHERE id = $2',
        [new Date(Date.now() + LOGIN_VERROU_MIN * 60 * 1000), u.id]
      );
    } else {
      await pool.query('UPDATE users SET login_fail_count = $1 WHERE id = $2', [essais, u.id]);
    }
    throw new ErreurAuth(401, 'E-mail ou mot de passe incorrect.');
  }

  if (!u.email_verified) {
    throw new ErreurAuth(403, 'Confirmez votre e-mail avant de vous connecter — entrez le code reçu, ou demandez-en un nouveau.');
  }

  if (u.login_fail_count > 0 || u.login_locked_until) {
    await pool.query('UPDATE users SET login_fail_count = 0, login_locked_until = NULL WHERE id = $1', [u.id]);
  }

  return { id: u.id, email };
}

export async function verifierEmail(pool: Pool, emailBrut: unknown, codeBrut: unknown): Promise<void> {
  const email = normaliserEmail(emailBrut);
  const code = validerCodeOtp(codeBrut);

  const { rows } = await pool.query<{
    id: number; email_verified: boolean; email_verification_otp_hash: string | null;
    email_verification_otp_expires: string | null; email_verification_otp_tries: number;
  }>(
    'SELECT id, email_verified, email_verification_otp_hash, email_verification_otp_expires, email_verification_otp_tries FROM users WHERE email = $1',
    [email]
  );
  if (rows.length === 0) throw new ErreurAuth(400, 'Code incorrect ou expiré.');
  const u = rows[0];
  if (u.email_verified) return; // déjà vérifié : pas une erreur, l'utilisateur a pu cliquer deux fois

  if (!u.email_verification_otp_hash || !u.email_verification_otp_expires || new Date(u.email_verification_otp_expires) < new Date()) {
    throw new ErreurAuth(400, 'Code expiré — demandez-en un nouveau.');
  }
  if (u.email_verification_otp_tries >= OTP_ESSAIS_MAX) {
    throw new ErreurAuth(400, 'Trop de tentatives — demandez un nouveau code.');
  }

  if (hacherOtp(code) !== u.email_verification_otp_hash) {
    await pool.query('UPDATE users SET email_verification_otp_tries = email_verification_otp_tries + 1 WHERE id = $1', [u.id]);
    throw new ErreurAuth(400, 'Code incorrect.');
  }

  await pool.query(
    `UPDATE users SET email_verified = true, email_verification_otp_hash = NULL,
       email_verification_otp_expires = NULL, email_verification_otp_tries = 0 WHERE id = $1`,
    [u.id]
  );

  const { sujet, html, texte } = emailBienvenue();
  await envoyerEmail(email, sujet, html, texte);
}

export async function renvoyerCodeVerification(pool: Pool, emailBrut: unknown): Promise<void> {
  const email = normaliserEmail(emailBrut);
  const { rows } = await pool.query<{ id: number; email_verified: boolean; email_verification_otp_expires: string | null }>(
    'SELECT id, email_verified, email_verification_otp_expires FROM users WHERE email = $1',
    [email]
  );
  if (rows.length === 0) throw new ErreurAuth(400, 'Aucun compte avec cette adresse.');
  const u = rows[0];
  if (u.email_verified) throw new ErreurAuth(400, 'Cette adresse est déjà vérifiée.');

  if (u.email_verification_otp_expires) {
    const envoyeDepuis = OTP_DUREE_MIN * 60 - (new Date(u.email_verification_otp_expires).getTime() - Date.now()) / 1000;
    if (envoyeDepuis < OTP_DELAI_RENVOI_SEC) {
      throw new ErreurAuth(429, `Patientez ${Math.ceil(OTP_DELAI_RENVOI_SEC - envoyeDepuis)} secondes avant de redemander un code.`);
    }
  }

  const code = genererOtp(); if (process.env.DEBUG_OTP) console.log("DEBUG_OTP:", email, code);
  await pool.query(
    'UPDATE users SET email_verification_otp_hash = $1, email_verification_otp_expires = $2, email_verification_otp_tries = 0 WHERE id = $3',
    [hacherOtp(code), expirationOtp(), u.id]
  );
  const { sujet, html, texte } = emailCodeVerification(code);
  await envoyerEmail(email, sujet, html, texte);
}

// Toujours une réponse générique côté appelant (voir api/auth.ts) : ne jamais laisser deviner si
// une adresse est enregistrée via ce flux.
export async function demanderReinitialisationMotDePasse(pool: Pool, emailBrut: unknown): Promise<void> {
  const email = normaliserEmail(emailBrut);
  const { rows } = await pool.query<{ id: number; password_reset_otp_expires: string | null }>(
    'SELECT id, password_reset_otp_expires FROM users WHERE email = $1',
    [email]
  );
  if (rows.length === 0) return;
  const u = rows[0];

  if (u.password_reset_otp_expires) {
    const envoyeDepuis = OTP_DUREE_MIN * 60 - (new Date(u.password_reset_otp_expires).getTime() - Date.now()) / 1000;
    if (envoyeDepuis < OTP_DELAI_RENVOI_SEC) return; // envoi déjà parti récemment, pas d'erreur visible (réponse générique)
  }

  const code = genererOtp(); if (process.env.DEBUG_OTP) console.log("DEBUG_OTP:", email, code);
  await pool.query(
    'UPDATE users SET password_reset_otp_hash = $1, password_reset_otp_expires = $2, password_reset_otp_tries = 0 WHERE id = $3',
    [hacherOtp(code), expirationOtp(), u.id]
  );
  const { sujet, html, texte } = emailCodeReinitialisation(code);
  await envoyerEmail(email, sujet, html, texte);
}

export async function reinitialiserMotDePasse(pool: Pool, emailBrut: unknown, codeBrut: unknown, nouveauMdpBrut: unknown): Promise<void> {
  const email = normaliserEmail(emailBrut);
  const code = validerCodeOtp(codeBrut);
  const nouveauMotDePasse = validerNouveauMotDePasse(nouveauMdpBrut);

  const { rows } = await pool.query<{
    id: number; password_reset_otp_hash: string | null; password_reset_otp_expires: string | null; password_reset_otp_tries: number;
  }>(
    'SELECT id, password_reset_otp_hash, password_reset_otp_expires, password_reset_otp_tries FROM users WHERE email = $1',
    [email]
  );
  if (rows.length === 0) throw new ErreurAuth(400, 'Code incorrect ou expiré.');
  const u = rows[0];

  if (!u.password_reset_otp_hash || !u.password_reset_otp_expires || new Date(u.password_reset_otp_expires) < new Date()) {
    throw new ErreurAuth(400, 'Code expiré — demandez-en un nouveau.');
  }
  if (u.password_reset_otp_tries >= OTP_ESSAIS_MAX) {
    throw new ErreurAuth(400, 'Trop de tentatives — demandez un nouveau code.');
  }
  if (hacherOtp(code) !== u.password_reset_otp_hash) {
    await pool.query('UPDATE users SET password_reset_otp_tries = password_reset_otp_tries + 1 WHERE id = $1', [u.id]);
    throw new ErreurAuth(400, 'Code incorrect.');
  }

  const hash = await bcrypt.hash(nouveauMotDePasse, 10);
  // Recevoir et saisir ce code prouve la possession de la boîte mail aussi sûrement que le code de
  // vérification d'inscription : on en profite pour vérifier l'e-mail au passage si ce n'était pas
  // déjà fait (compte créé avant l'ajout de cette fonctionnalité, par exemple).
  await pool.query(
    `UPDATE users SET password_hash = $1, email_verified = true,
       password_reset_otp_hash = NULL, password_reset_otp_expires = NULL, password_reset_otp_tries = 0
     WHERE id = $2`,
    [hash, u.id]
  );
}

let clientGoogle: OAuth2Client | undefined;
function clientIdGoogle(): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new ErreurAuth(500, 'GOOGLE_OAUTH_CLIENT_ID non définie côté serveur.');
  return clientId;
}

// `idToken` vient du bouton "Se connecter avec Google" (Google Identity Services) côté client —
// un JWT signé par Google, jamais le mot de passe ou un jeton d'accès. On le revérifie ici (ne
// jamais faire confiance à un email envoyé tel quel par le front) : signature Google valide,
// audience = notre client id, émetteur Google, non expiré.
export async function connecterAvecGoogle(pool: Pool, idToken: unknown): Promise<UtilisateurPublic> {
  if (typeof idToken !== 'string' || !idToken) {
    throw new ErreurAuth(400, 'Jeton Google manquant.');
  }

  const clientId = clientIdGoogle();
  if (!clientGoogle) clientGoogle = new OAuth2Client(clientId);

  let payload;
  try {
    const ticket = await clientGoogle.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw new ErreurAuth(401, 'Jeton Google invalide ou expiré.');
  }
  if (!payload?.email || !payload.sub) {
    throw new ErreurAuth(401, 'Jeton Google invalide.');
  }
  if (!payload.email_verified) {
    throw new ErreurAuth(401, 'E-mail Google non vérifié.');
  }

  const email = payload.email.toLowerCase();
  const sub = payload.sub;

  // Retrouver par google_sub d'abord (stable même si l'email Google change), puis par email
  // (compte déjà créé par mot de passe avec la même adresse — on le lie à Google plutôt que de
  // créer un doublon).
  const { rows } = await pool.query<{ id: number }>(
    'SELECT id FROM users WHERE google_sub = $1 OR email = $2 LIMIT 1',
    [sub, email]
  );

  if (rows.length > 0) {
    // email_verified = true ici aussi : Google vient de prouver la possession de l'adresse, un
    // signal au moins aussi fort que notre propre code OTP — sans ça, un compte créé par
    // formulaire puis lié à Google restait bloqué "non vérifié" pour toute future connexion par
    // mot de passe, alors que Google avait déjà confirmé l'e-mail.
    await pool.query('UPDATE users SET google_sub = $1, email_verified = true WHERE id = $2', [sub, rows[0].id]);
    return { id: rows[0].id, email };
  }

  const inserted = await pool.query<{ id: number }>(
    'INSERT INTO users (email, google_sub, email_verified) VALUES ($1, $2, true) RETURNING id',
    [email, sub]
  );
  return { id: inserted.rows[0].id, email };
}

export function creerJeton(utilisateur: UtilisateurPublic): string {
  return jwt.sign({ sub: utilisateur.id, email: utilisateur.email }, secretSession(), {
    expiresIn: `${DUREE_SESSION_JOURS}d`,
  });
}

export function cookieSession(jeton: string): string {
  return serialize(COOKIE_NOM, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DUREE_SESSION_JOURS * 24 * 60 * 60,
  });
}

export function cookieDeconnexion(): string {
  return serialize(COOKIE_NOM, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}

// Renvoie l'utilisateur courant à partir du cookie de session, ou null si absent/invalide/expiré
// (jamais une erreur : un visiteur non connecté est un cas normal, pas une anomalie).
export function utilisateurDepuisCookies(cookieHeader: string | undefined): { id: number; email: string } | null {
  if (!cookieHeader) return null;
  const jeton = parse(cookieHeader)[COOKIE_NOM];
  if (!jeton) return null;
  try {
    const payload = jwt.verify(jeton, secretSession()) as unknown as { sub: number; email: string };
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
