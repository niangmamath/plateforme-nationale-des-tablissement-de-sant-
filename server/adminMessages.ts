// Messagerie interne entre admins : un fil commun unique (format "canal Slack") où chaque admin
// peut lire tous les messages et en poster. Pas de notion de destinataire ni de thread — c'est le
// format le plus simple pour une petite équipe (2-5 personnes).
//
// Chaque admin a un pointeur messages_dernier_vu_id (sur admin_users, migration 037) pour afficher
// un badge "N nouveaux" sur l'onglet. Le pointeur bouge quand l'admin ouvre l'onglet.
//
// Pas d'édition de message : réécrire l'historique après coup ouvre la porte à des contestations.
// Suppression possible par l'auteur dans les 15 min (voir supprimerMessage).

import type { Pool } from 'pg';

export class ErreurMessages extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const DELAI_SUPPRESSION_MIN = 15;
const CONTENU_MAX = 2000;

export interface Message {
  id: number;
  auteur_id: number | null;
  auteur_email: string | null; // null si l'admin a été supprimé (ON DELETE SET NULL)
  contenu: string;
  date_envoi: string;
  est_moi: boolean;
}

// Liste des N derniers messages (plus récents en bas, comme un chat). On applique un ORDER BY ASC
// pour que l'ordre côté UI soit déjà le bon (évite un reverse en JS).
export async function listerMessages(
  pool: Pool,
  adminId: number,
  limite = 100,
): Promise<{ messages: Message[]; dernier_id: number; non_lus: number }> {
  limite = Math.min(Math.max(limite, 1), 500);

  const { rows } = await pool.query<{
    id: number; auteur_id: number | null; auteur_email: string | null;
    contenu: string; date_envoi: string;
  }>(
    `SELECT m.id, m.auteur_id, a.email AS auteur_email, m.contenu, m.date_envoi
     FROM admin_messages m
     LEFT JOIN admin_users a ON a.id = m.auteur_id
     ORDER BY m.id DESC
     LIMIT $1`,
    [limite],
  );

  const messages: Message[] = rows
    .map(r => ({
      id: r.id,
      auteur_id: r.auteur_id,
      auteur_email: r.auteur_email,
      contenu: r.contenu,
      date_envoi: r.date_envoi,
      est_moi: r.auteur_id === adminId,
    }))
    .reverse(); // Plus anciens en haut, plus récents en bas (ordre naturel de lecture d'un chat).

  // Compteur de non-lus : messages dont l'id > messages_dernier_vu_id de cet admin.
  const vuRes = await pool.query<{ v: number }>(
    `SELECT messages_dernier_vu_id AS v FROM admin_users WHERE id = $1`,
    [adminId],
  );
  const dernierVu = vuRes.rows[0]?.v ?? 0;

  const nonLusRes = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM admin_messages WHERE id > $1 AND auteur_id <> $2`,
    [dernierVu, adminId],
  );
  const nonLus = Number(nonLusRes.rows[0].n);

  const dernierId = messages.length > 0 ? messages[messages.length - 1].id : 0;
  return { messages, dernier_id: dernierId, non_lus: nonLus };
}

// Compteur léger pour l'onglet (polling fréquent) : juste le nombre de non-lus et le dernier id
// global, sans charger les messages.
export async function compterNonLus(pool: Pool, adminId: number): Promise<{ non_lus: number; dernier_id: number }> {
  const vuRes = await pool.query<{ v: number }>(
    `SELECT messages_dernier_vu_id AS v FROM admin_users WHERE id = $1`,
    [adminId],
  );
  const dernierVu = vuRes.rows[0]?.v ?? 0;

  const [nonLusRes, dernierRes] = await Promise.all([
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM admin_messages WHERE id > $1 AND auteur_id <> $2`,
      [dernierVu, adminId],
    ),
    pool.query<{ max_id: number | null }>(`SELECT MAX(id) AS max_id FROM admin_messages`),
  ]);

  return {
    non_lus: Number(nonLusRes.rows[0].n),
    dernier_id: Number(dernierRes.rows[0].max_id ?? 0),
  };
}

export async function envoyerMessage(pool: Pool, adminId: number, contenuBrut: unknown): Promise<Message> {
  if (typeof contenuBrut !== 'string') throw new ErreurMessages(400, 'Contenu invalide.');
  const contenu = contenuBrut.trim();
  if (contenu.length === 0) throw new ErreurMessages(400, 'Le message est vide.');
  if (contenu.length > CONTENU_MAX) throw new ErreurMessages(400, `Message trop long (max ${CONTENU_MAX} caractères).`);

  const { rows } = await pool.query<{ id: number; date_envoi: string }>(
    `INSERT INTO admin_messages (auteur_id, contenu) VALUES ($1, $2) RETURNING id, date_envoi`,
    [adminId, contenu],
  );

  // L'auteur a par définition "lu" son propre message. On met son pointeur à jour pour éviter
  // qu'il voie "1 non lu" immédiatement après avoir posté.
  await pool.query(
    `UPDATE admin_users SET messages_dernier_vu_id = GREATEST(messages_dernier_vu_id, $1) WHERE id = $2`,
    [rows[0].id, adminId],
  );

  const emailRes = await pool.query<{ email: string }>('SELECT email FROM admin_users WHERE id = $1', [adminId]);

  return {
    id: rows[0].id,
    auteur_id: adminId,
    auteur_email: emailRes.rows[0]?.email ?? null,
    contenu,
    date_envoi: rows[0].date_envoi,
    est_moi: true,
  };
}

// Marque tout comme lu jusqu'à l'id donné. Appelé par le frontend quand l'onglet est ouvert.
export async function marquerLuJusquA(pool: Pool, adminId: number, dernierId: number): Promise<void> {
  if (!Number.isInteger(dernierId) || dernierId < 0) {
    throw new ErreurMessages(400, 'dernier_id invalide.');
  }
  await pool.query(
    `UPDATE admin_users SET messages_dernier_vu_id = GREATEST(messages_dernier_vu_id, $1) WHERE id = $2`,
    [dernierId, adminId],
  );
}

// Suppression par l'auteur dans les 15 minutes. Au-delà, on refuse — un historique sans trous est
// plus utile en cas de litige.
export async function supprimerMessage(pool: Pool, adminId: number, messageId: number): Promise<void> {
  if (!Number.isInteger(messageId) || messageId <= 0) {
    throw new ErreurMessages(400, 'id invalide.');
  }

  const { rows } = await pool.query<{ auteur_id: number | null; date_envoi: string }>(
    `SELECT auteur_id, date_envoi FROM admin_messages WHERE id = $1`,
    [messageId],
  );
  if (rows.length === 0) throw new ErreurMessages(404, 'Message introuvable.');
  if (rows[0].auteur_id !== adminId) throw new ErreurMessages(403, 'Seul l\'auteur peut supprimer son message.');

  const ageMs = Date.now() - new Date(rows[0].date_envoi).getTime();
  if (ageMs > DELAI_SUPPRESSION_MIN * 60 * 1000) {
    throw new ErreurMessages(403, `Suppression possible uniquement dans les ${DELAI_SUPPRESSION_MIN} premières minutes.`);
  }

  await pool.query(`DELETE FROM admin_messages WHERE id = $1`, [messageId]);
}
