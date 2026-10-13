// Actions d'un admin sur les signalements : lister avec filtres, voir le détail, changer de
// statut, écrire une note interne, envoyer une réponse par email au signaleur. Chaque action
// d'écriture est tracée dans admin_audit_log (voir migration 036).
//
// Lecture seule pour un lecteur : les signaleurs ont des noms/emails personnels qu'un lecteur ne
// doit pas voir. Les routes qui modifient (statut, note, email) sont réservées à role=admin dans
// adminRouter.ts.

import type { Pool, PoolClient } from 'pg';
import { envoyerEmail, emailReponseSignalement } from './email.js';

const STATUTS_VALIDES = ['nouveau', 'en_cours', 'traite', 'rejete'] as const;
export type StatutSignalement = typeof STATUTS_VALIDES[number];

export class ErreurSignalement extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ErreurSignalement';
  }
}

// --- Audit log ---
// Toujours loguer après l'écriture métier (si l'INSERT métier échoue, on n'écrit pas de ligne
// orpheline dans l'audit). Si le log d'audit lui-même échoue (table en vrac, etc.), on le remonte
// comme une erreur serveur plutôt que de passer silencieusement : perdre l'historique n'est pas
// acceptable sur un dashboard admin.
async function logAudit(
  client: PoolClient | Pool,
  adminId: number,
  actionType: string,
  entiteType: string,
  entiteId: string | number,
  donnees: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO admin_audit_log (admin_id, action_type, entite_type, entite_id, donnees)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, actionType, entiteType, String(entiteId), donnees],
  );
}

export interface Signalement {
  id: number;
  type: 'correction' | 'absence';
  etablissement_id: string | null;
  type_probleme: string | null;
  nom_prenom: string;
  email: string;
  profession: string;
  message: string;
  statut: StatutSignalement;
  note_interne: string | null;
  date_creation: string;
  date_traitement: string | null;
  traite_par_email: string | null;
  reponse_envoyee_a: string | null;
}

// Liste des signalements avec filtres (statut, texte libre). Pagination simple : limit + offset.
export async function listerSignalements(
  pool: Pool,
  filtres: { statut?: string; q?: string; limite?: number; offset?: number },
): Promise<{ total: number; signalements: Signalement[] }> {
  const limite = Math.min(Math.max(filtres.limite ?? 25, 1), 100);
  const offset = Math.max(filtres.offset ?? 0, 0);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filtres.statut && (STATUTS_VALIDES as readonly string[]).includes(filtres.statut)) {
    params.push(filtres.statut);
    conditions.push(`s.statut = $${params.length}`);
  }
  if (filtres.q && filtres.q.trim()) {
    params.push(`%${filtres.q.trim().toLowerCase()}%`);
    const i = params.length;
    conditions.push(`(LOWER(s.nom_prenom) LIKE $${i} OR LOWER(s.email) LIKE $${i} OR LOWER(s.message) LIKE $${i})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM signalements s ${where}`,
    params,
  );

  params.push(limite, offset);
  const { rows } = await pool.query<Signalement>(
    `SELECT s.id, s.type, s.etablissement_id, s.type_probleme, s.nom_prenom, s.email, s.profession,
            s.message, s.statut, s.note_interne, s.date_creation, s.date_traitement,
            a.email AS traite_par_email, s.reponse_envoyee_a
     FROM signalements s
     LEFT JOIN admin_users a ON a.id = s.traite_par
     ${where}
     ORDER BY
       CASE s.statut WHEN 'nouveau' THEN 0 WHEN 'en_cours' THEN 1 WHEN 'traite' THEN 2 ELSE 3 END,
       s.date_creation DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { total: Number(total.rows[0].n), signalements: rows };
}

// Change le statut d'un signalement et/ou met à jour la note interne. Les deux sont optionnels
// mais au moins un doit être fourni.
export async function mettreAJourSignalement(
  pool: Pool,
  adminId: number,
  id: number,
  patch: { statut?: string; note_interne?: string | null },
): Promise<Signalement> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErreurSignalement(400, 'id invalide.');
  }
  if (patch.statut === undefined && patch.note_interne === undefined) {
    throw new ErreurSignalement(400, 'Rien à mettre à jour.');
  }
  if (patch.statut !== undefined && !(STATUTS_VALIDES as readonly string[]).includes(patch.statut)) {
    throw new ErreurSignalement(400, `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(', ')}.`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const avant = await client.query<Signalement>(
      `SELECT id, statut, note_interne FROM signalements WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (avant.rows.length === 0) {
      throw new ErreurSignalement(404, 'Signalement introuvable.');
    }
    const ancien = avant.rows[0];

    const champs: string[] = [];
    const params: unknown[] = [];
    if (patch.statut !== undefined && patch.statut !== ancien.statut) {
      params.push(patch.statut);
      champs.push(`statut = $${params.length}`);
      // Si on passe à un statut final, on marque qui a tranché.
      if (patch.statut === 'traite' || patch.statut === 'rejete') {
        params.push(adminId);
        champs.push(`traite_par = $${params.length}`);
      }
    }
    if (patch.note_interne !== undefined && patch.note_interne !== ancien.note_interne) {
      params.push(patch.note_interne);
      champs.push(`note_interne = $${params.length}`);
    }

    if (champs.length > 0) {
      params.push(id);
      await client.query(`UPDATE signalements SET ${champs.join(', ')} WHERE id = $${params.length}`, params);
    }

    await logAudit(client, adminId, 'signalement.majour', 'signalement', id, {
      avant: { statut: ancien.statut, note_interne: ancien.note_interne },
      apres: patch,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const apres = await obtenirSignalement(pool, id);
  if (!apres) throw new ErreurSignalement(404, 'Signalement introuvable après mise à jour.');
  return apres;
}

// Envoie un email de réponse au signaleur et log l'action. On ne change pas le statut
// automatiquement — l'admin choisit explicitement (certaines réponses sont des demandes de
// précision, le signalement reste "en_cours").
export async function repondreSignalement(
  pool: Pool,
  adminId: number,
  id: number,
  message: string,
): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErreurSignalement(400, 'id invalide.');
  }
  if (!message || message.trim().length < 10) {
    throw new ErreurSignalement(400, 'Le message doit faire au moins 10 caractères.');
  }
  if (message.length > 5000) {
    throw new ErreurSignalement(400, 'Le message dépasse 5000 caractères.');
  }

  const { rows } = await pool.query<{ email: string; nom_prenom: string }>(
    `SELECT email, nom_prenom FROM signalements WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) throw new ErreurSignalement(404, 'Signalement introuvable.');
  const { email } = rows[0];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErreurSignalement(400, 'Email du signaleur invalide ou absent — impossible de répondre.');
  }

  const { sujet, html, texte } = emailReponseSignalement(message);
  await envoyerEmail(email, sujet, html, texte);

  // On marque le signalement et on log après l'envoi. envoyerEmail avale ses erreurs réseau en
  // interne (voir server/email.ts), donc on considère que l'intention a été prise en compte même
  // si Resend a renvoyé un 5xx — l'admin aura un retour par le log serveur si c'était le cas.
  await pool.query(
    `UPDATE signalements SET reponse_envoyee_a = now() WHERE id = $1`,
    [id],
  );
  await logAudit(pool, adminId, 'signalement.repondre', 'signalement', id, {
    destinataire: email,
    longueur_message: message.length,
  });
}

export async function obtenirSignalement(pool: Pool, id: number): Promise<Signalement | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const { rows } = await pool.query<Signalement>(
    `SELECT s.id, s.type, s.etablissement_id, s.type_probleme, s.nom_prenom, s.email, s.profession,
            s.message, s.statut, s.note_interne, s.date_creation, s.date_traitement,
            a.email AS traite_par_email, s.reponse_envoyee_a
     FROM signalements s
     LEFT JOIN admin_users a ON a.id = s.traite_par
     WHERE s.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
