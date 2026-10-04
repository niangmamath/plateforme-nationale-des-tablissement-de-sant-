-- Protection contre le brute-force sur la connexion (aucune limite n'existait : testé en
-- production, 10 tentatives consécutives avec mauvais mot de passe toutes acceptées sans
-- ralentissement ni blocage). Même principe que le verrou OTP déjà en place (5 essais).
ALTER TABLE users ADD COLUMN login_fail_count integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN login_locked_until timestamptz;
