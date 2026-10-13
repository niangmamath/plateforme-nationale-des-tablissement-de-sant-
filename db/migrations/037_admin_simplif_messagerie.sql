-- Simplification du modèle admin : plus d'invitation de lecteurs, uniquement les fondateurs.
-- + Nouvelle messagerie interne (fil commun) entre admins.

-- 1. Supprimer la logique d'invitation : les colonnes et la FK ne servent plus à rien, les
-- comptes admin sont uniquement seedés via ADMIN_FOUNDER_EMAILS au démarrage du serveur, et le
-- code applicatif correspondant est supprimé en même temps.
--
-- Les lignes avec password_hash IS NULL (lecteurs invités qui n'ont jamais activé) sont supprimées
-- avant le drop du rôle : sinon le CHECK constraint ne peut pas se recalculer. Les lignes
-- role='lecteur' avec un hash (lecteurs actifs) sont également supprimées — après cette migration,
-- seuls les fondateurs restent.
DELETE FROM admin_users WHERE role = 'lecteur';

ALTER TABLE admin_users
  DROP COLUMN invited_by_admin_id,
  DROP COLUMN invitation_token_hash,
  DROP COLUMN invitation_expires;

-- Un seul rôle désormais, mais on garde la colonne pour éviter de casser le code qui lit `role`.
-- Le CHECK est recréé pour n'accepter que 'admin'.
ALTER TABLE admin_users DROP CONSTRAINT admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role = 'admin');

-- 2. Messagerie interne — fil commun unique entre les admins, format "canal Slack".
-- Pas de notion de destinataire (tout le monde lit tout) : plus simple à 2-5 personnes, aucune
-- règle de visibilité à gérer. Chaque admin voit la liste et peut écrire. Un message peut être
-- supprimé par son auteur dans les 15 minutes (politique côté application).
CREATE TABLE admin_messages (
  id serial PRIMARY KEY,
  auteur_id integer REFERENCES admin_users(id) ON DELETE SET NULL,
  contenu text NOT NULL CHECK (length(trim(contenu)) > 0 AND length(contenu) <= 2000),
  date_envoi timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_messages_date_envoi_idx ON admin_messages (date_envoi DESC);

-- 3. Pour que chaque admin puisse marquer "jusqu'où j'ai lu" (badge "nouveaux messages"), on garde
-- un pointeur par admin sur le dernier message vu. Pas une table "lu" granulaire (overkill ici) :
-- juste le timestamp (ou id) du dernier message consulté.
ALTER TABLE admin_users ADD COLUMN messages_dernier_vu_id integer DEFAULT 0;
