-- Signalements des utilisateurs : correction d'une fiche existante ("correction") ou
-- établissement manquant ("absence"). Table séparée de etablissements : un signalement ne
-- modifie jamais une fiche par lui-même, un humain le relit dans Directus (statut "nouveau" →
-- "en_cours" → "traite"/"rejete") et corrige la fiche à la main si le signalement est fondé.
--
-- Pas de clé étrangère sur etablissement_id : même choix que doublon_possible_id (018) — la fiche
-- peut être supprimée ou fusionnée plus tard sans que le signalement, qui garde son message,
-- devienne invalide ou bloque cette suppression.
--
-- ip_hash : empreinte (SHA-256 salée) de l'adresse IP de l'expéditeur, uniquement pour limiter
-- la fréquence d'envoi (endpoint public en écriture, aucun autre garde-fou n'existe) — l'IP en
-- clair n'est jamais stockée.
CREATE TABLE signalements (
  id serial PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('correction', 'absence')),
  etablissement_id text,
  type_probleme text CHECK (type_probleme IN ('position', 'nom', 'adresse', 'specialite', 'doublon', 'ferme', 'autre')),
  nom_prenom text NOT NULL,
  email text NOT NULL,
  profession text NOT NULL,
  message text NOT NULL,
  statut text NOT NULL DEFAULT 'nouveau' CHECK (statut IN ('nouveau', 'en_cours', 'traite', 'rejete')),
  note_interne text,
  date_creation timestamptz NOT NULL DEFAULT now(),
  date_traitement timestamptz,
  ip_hash text,
  CONSTRAINT signalements_coherence CHECK (
    (type = 'correction' AND etablissement_id IS NOT NULL AND type_probleme IS NOT NULL)
    OR (type = 'absence' AND etablissement_id IS NULL AND type_probleme IS NULL)
  )
);

CREATE INDEX signalements_statut_idx ON signalements (statut);
CREATE INDEX signalements_etablissement_idx ON signalements (etablissement_id);
CREATE INDEX signalements_ip_recente_idx ON signalements (ip_hash, date_creation);

-- date_traitement suit automatiquement le passage à un statut final, pour qu'on n'ait pas à la
-- saisir à la main dans Directus (et qu'elle ne puisse pas être oubliée).
CREATE FUNCTION signalements_date_traitement() RETURNS trigger AS $$
BEGIN
  IF NEW.statut IN ('traite', 'rejete') AND (OLD.statut IS DISTINCT FROM NEW.statut) THEN
    NEW.date_traitement := now();
  ELSIF NEW.statut IN ('nouveau', 'en_cours') THEN
    NEW.date_traitement := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signalements_date_traitement_trg
  BEFORE UPDATE OF statut ON signalements
  FOR EACH ROW EXECUTE FUNCTION signalements_date_traitement();
