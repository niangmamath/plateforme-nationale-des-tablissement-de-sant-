-- Connexion avec Google : un compte créé via Google n'a pas de mot de passe (password_hash
-- devient optionnel), et google_sub (identifiant Google stable, immuable même si l'email change)
-- permet de retrouver le compte sans dépendre uniquement de l'email.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN google_sub text UNIQUE;
