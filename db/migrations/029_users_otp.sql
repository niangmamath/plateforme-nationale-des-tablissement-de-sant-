-- Vérification d'e-mail (par code OTP) + récupération de mot de passe (même mécanisme OTP) :
-- un seul couple colonnes par usage, jamais le code en clair (hashé en SHA-256, comme ip_hash
-- dans signalements — un OTP est une valeur aléatoire haute entropie générée par nous, pas un mot
-- de passe choisi par l'utilisateur, donc pas besoin du coût bcrypt, juste éviter qu'une fuite de
-- la base donne un accès/une réinitialisation immédiats).
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE users ADD COLUMN email_verification_otp_hash text;
ALTER TABLE users ADD COLUMN email_verification_otp_expires timestamptz;
ALTER TABLE users ADD COLUMN email_verification_otp_tries integer NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN password_reset_otp_hash text;
ALTER TABLE users ADD COLUMN password_reset_otp_expires timestamptz;
ALTER TABLE users ADD COLUMN password_reset_otp_tries integer NOT NULL DEFAULT 0;

-- Un compte Google a déjà son e-mail vérifié par Google lui-même (voir connecterAvecGoogle,
-- qui refuse déjà payload.email_verified = false côté Google) — inutile de le refaire vérifier.
UPDATE users SET email_verified = true WHERE google_sub IS NOT NULL;
