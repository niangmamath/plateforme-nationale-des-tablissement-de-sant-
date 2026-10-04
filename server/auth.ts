import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';
import type { Pool } from 'pg';

export class ErreurAuth extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COOKIE_NOM = 'session';
const DUREE_SESSION_JOURS = 30;

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

function validerMotDePasse(mdp: unknown): string {
  if (typeof mdp !== 'string' || mdp.length < 8) {
    throw new ErreurAuth(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
  if (mdp.length > 200) throw new ErreurAuth(400, 'Mot de passe trop long.');
  return mdp;
}

export interface UtilisateurPublic {
  id: number;
  email: string;
}

export async function inscrire(pool: Pool, emailBrut: unknown, mdpBrut: unknown): Promise<UtilisateurPublic> {
  const email = normaliserEmail(emailBrut);
  const motDePasse = validerMotDePasse(mdpBrut);

  const existant = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existant.rows.length > 0) {
    throw new ErreurAuth(409, 'Un compte existe déjà avec cette adresse e-mail.');
  }

  const hash = await bcrypt.hash(motDePasse, 10);
  const { rows } = await pool.query<{ id: number }>(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, hash]
  );
  return { id: rows[0].id, email };
}

export async function connecter(pool: Pool, emailBrut: unknown, mdpBrut: unknown): Promise<UtilisateurPublic> {
  const email = normaliserEmail(emailBrut);
  const motDePasse = validerMotDePasse(mdpBrut);

  const { rows } = await pool.query<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email]
  );
  // Même message que « mot de passe incorrect » : ne pas révéler si l'email existe en base.
  if (rows.length === 0) throw new ErreurAuth(401, 'E-mail ou mot de passe incorrect.');

  const valide = await bcrypt.compare(motDePasse, rows[0].password_hash);
  if (!valide) throw new ErreurAuth(401, 'E-mail ou mot de passe incorrect.');

  return { id: rows[0].id, email };
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
