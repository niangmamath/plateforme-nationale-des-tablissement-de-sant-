-- Comptes utilisateurs : nécessaires pour que le générateur de business plan puisse sauvegarder
-- un brouillon par utilisateur et le restaurer à la reconnexion (sans compte, le formulaire se
-- vidait entièrement à chaque fermeture — aucune persistance n'existait auparavant).
-- email est normalisé en minuscules par le code applicatif avant toute lecture/écriture, donc
-- l'UNIQUE simple suffit (pas besoin d'index fonctionnel lower(email)).
CREATE TABLE users (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  date_creation timestamptz NOT NULL DEFAULT now()
);
