-- Comptes du dashboard d'administration : population totalement séparée des utilisateurs du site
-- (table `users`, qui contient les médecins inscrits via le générateur de business plan). Aucune
-- clé étrangère entre les deux : un médecin ne peut jamais devenir admin par escalade et
-- vice-versa, et le cookie de session de l'un n'ouvre jamais l'autre (voir server/adminAuth.ts,
-- cookie "admin_session" distinct de "session").
--
-- Deux rôles : "admin" (fondateurs, seuls à pouvoir inviter) et "lecteur" (invités, consultation).
-- is_founder marque les comptes seedés depuis ADMIN_FOUNDER_EMAILS : ils ne peuvent être ni
-- supprimés ni rétrogradés (garde-fou côté application dans server/adminAuth.ts).
--
-- password_hash NULL = compte lecteur invité qui n'a pas encore cliqué sur le lien d'activation.
-- Les fondateurs sont seedés avec un hash dès le démarrage du serveur (voir seedFondateurs()).
--
-- invitation_token_hash / invitation_expires : exactement le même pattern que email_verification_otp
-- sur users (migration 029) — seul le SHA-256 du token est stocké, jamais le token en clair.
CREATE TABLE admin_users (
  id                    serial PRIMARY KEY,
  email                 text NOT NULL UNIQUE,
  password_hash         text,
  role                  text NOT NULL CHECK (role IN ('admin', 'lecteur')),
  is_founder            boolean NOT NULL DEFAULT false,
  date_creation         timestamptz NOT NULL DEFAULT now(),
  invited_by_admin_id   integer REFERENCES admin_users(id) ON DELETE SET NULL,
  invitation_token_hash text,
  invitation_expires    timestamptz,
  login_fail_count      integer NOT NULL DEFAULT 0,
  login_locked_until    timestamptz
);

CREATE INDEX admin_users_email_idx ON admin_users (email);
