-- Permet à un admin de traiter un signalement depuis le dashboard : changer son statut, écrire
-- une note interne, envoyer une réponse par email au signaleur. On trace qui fait quoi dans un
-- audit log séparé (admin_audit_log) pour pouvoir reconstituer l'historique en cas de litige.
--
-- Pas de FK ON DELETE CASCADE côté admin_users : si on supprime un admin, on ne veut pas perdre
-- l'historique de ses actions (ON DELETE SET NULL garde la trace de l'action, juste anonymisée).

-- 1. Audit log générique — toutes les actions d'écriture faites via le dashboard admin passent par
-- là. Volontairement souple (action_type en texte + donnees JSONB) pour ne pas devoir migrer la
-- table à chaque nouvelle action.
CREATE TABLE admin_audit_log (
  id serial PRIMARY KEY,
  admin_id integer REFERENCES admin_users(id) ON DELETE SET NULL,
  action_type text NOT NULL,            -- ex: 'signalement.statut', 'signalement.repondre'
  entite_type text NOT NULL,            -- ex: 'signalement'
  entite_id text NOT NULL,              -- id de l'entité touchée (en texte pour supporter uuid/int)
  donnees jsonb,                        -- payload de l'action (avant/après, contenu email, etc.)
  date_action timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_entite_idx ON admin_audit_log (entite_type, entite_id, date_action DESC);
CREATE INDEX admin_audit_log_admin_idx ON admin_audit_log (admin_id, date_action DESC);

-- 2. Signalements : colonnes de traitement
-- traite_par : qui a pris la décision (statut traite/rejete)
-- reponse_envoyee_a : timestamp du dernier email de réponse envoyé au signaleur (null = pas de réponse)
ALTER TABLE signalements
  ADD COLUMN traite_par integer REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN reponse_envoyee_a timestamptz;

CREATE INDEX IF NOT EXISTS signalements_date_creation_idx ON signalements (date_creation DESC);
