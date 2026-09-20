import { createHash } from 'crypto';
import type { Pool } from 'pg';

export const TYPES_PROBLEME = ['position', 'nom', 'adresse', 'specialite', 'doublon', 'ferme', 'autre'] as const;

// Endpoint public en écriture : aucun secret, aucune session — la limite de fréquence par IP est
// le seul frein contre un script qui remplirait la table (voir migration 019 pour ip_hash).
const MAX_PAR_10_MIN = 5;
const MAX_PAR_24H = 20;

export class ErreurSignalement extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Caractères de contrôle (dont NUL, que Postgres refuse dans un text) — on garde \n et \t.
const CONTROLE_RE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

function nettoyer(valeur: unknown, champ: string, min: number, max: number, multiligne = false): string {
  if (typeof valeur !== 'string') throw new ErreurSignalement(400, `Le champ « ${champ} » est requis.`);
  let t = valeur.replace(CONTROLE_RE, '').replace(/\r\n?/g, '\n');
  t = multiligne ? t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : t.replace(/\s+/g, ' ').trim();
  if (t.length < min) throw new ErreurSignalement(400, `Le champ « ${champ} » est trop court (minimum ${min} caractères).`);
  if (t.length > max) throw new ErreurSignalement(400, `Le champ « ${champ} » est trop long (maximum ${max} caractères).`);
  return t;
}

export function extraireIp(xForwardedFor: string | string[] | undefined, repli?: string): string | undefined {
  const brut = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
  const premiere = brut?.split(',')[0]?.trim();
  return premiere || repli || undefined;
}

function hacherIp(ip: string): string {
  const sel = process.env.SIGNALEMENT_IP_SALT ?? process.env.ADMIN_EXTRACTION_SECRET ?? 'empower-doctor';
  return createHash('sha256').update(`${sel}:${ip}`).digest('hex');
}

export async function enregistrerSignalement(pool: Pool, corps: unknown, ip: string | undefined): Promise<void> {
  const b = (corps ?? {}) as Record<string, unknown>;

  // Champ leurre invisible côté formulaire : un humain ne le remplit jamais, un robot qui remplit
  // tout ce qu'il trouve, si. On répond comme si tout allait bien pour ne rien lui apprendre.
  if (typeof b.site_web === 'string' && b.site_web.trim() !== '') return;

  const type = b.type;
  if (type !== 'correction' && type !== 'absence') throw new ErreurSignalement(400, 'Type de signalement invalide.');

  let etablissementId: string | null = null;
  let typeProbleme: string | null = null;
  let precisionProbleme: string | null = null;
  if (type === 'correction') {
    etablissementId = nettoyer(b.etablissement_id, 'établissement', 1, 100);
    if (typeof b.type_probleme !== 'string' || !(TYPES_PROBLEME as readonly string[]).includes(b.type_probleme)) {
      throw new ErreurSignalement(400, 'Type de problème invalide.');
    }
    typeProbleme = b.type_probleme;
    // "Autre" n'a de sens qu'avec le détail saisi par l'utilisateur.
    if (typeProbleme === 'autre') precisionProbleme = nettoyer(b.type_probleme_precision, 'précision du problème', 2, 100);
  }

  const nomPrenom = nettoyer(b.nom_prenom, 'nom et prénom', 2, 120);
  // Email facultatif : absent ou vide -> null ; s'il est fourni, il doit être valide.
  let email: string | null = null;
  if (typeof b.email === 'string' && b.email.trim() !== '') {
    email = nettoyer(b.email, 'email', 5, 254);
    if (!EMAIL_RE.test(email)) throw new ErreurSignalement(400, "L'adresse email n'est pas valide.");
  }
  const profession = nettoyer(b.profession, 'profession', 2, 80);
  const message = nettoyer(b.message, 'message', 10, 2000, true);

  if (etablissementId) {
    const { rows } = await pool.query(`SELECT 1 FROM etablissements WHERE id = $1 AND statut = 'publie'`, [etablissementId]);
    if (rows.length === 0) throw new ErreurSignalement(400, 'Établissement introuvable.');
  }

  const ipHash = ip ? hacherIp(ip) : null;
  if (ipHash) {
    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE date_creation > now() - interval '10 minutes')::int AS recents, count(*)::int AS jour
       FROM signalements WHERE ip_hash = $1 AND date_creation > now() - interval '24 hours'`,
      [ipHash]
    );
    if (rows[0].recents >= MAX_PAR_10_MIN || rows[0].jour >= MAX_PAR_24H) {
      throw new ErreurSignalement(429, 'Trop de signalements envoyés depuis votre connexion. Réessayez un peu plus tard.');
    }
  }

  await pool.query(
    `INSERT INTO signalements (type, etablissement_id, type_probleme, type_probleme_precision, nom_prenom, email, profession, message, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [type, etablissementId, typeProbleme, precisionProbleme, nomPrenom, email, profession, message, ipHash]
  );
}
