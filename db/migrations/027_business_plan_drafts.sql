-- Brouillon de business plan : un par (utilisateur, zone, spécialité), tout le formulaire
-- sérialisé dans `data` plutôt que modélisé en colonnes séparées — le formulaire compte une
-- quarantaine de champs (textes, tableaux de lignes, paramètres financiers) qui évoluent avec le
-- générateur ; les figer en colonnes obligerait à migrer la table à chaque ajout de champ.
CREATE TABLE business_plan_drafts (
  id            serial PRIMARY KEY,
  user_id       integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone_id       text NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  specialite_id text NOT NULL REFERENCES specialites(id) ON DELETE CASCADE,
  data          jsonb NOT NULL,
  date_creation timestamptz NOT NULL DEFAULT now(),
  date_maj      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, zone_id, specialite_id)
);

CREATE INDEX business_plan_drafts_user_idx ON business_plan_drafts (user_id);

-- date_maj suit automatiquement chaque sauvegarde (auto-save périodique côté client), pour
-- pouvoir un jour trier/purger les brouillons abandonnés sans dépendre du client pour la tenir à
-- jour.
CREATE FUNCTION business_plan_drafts_date_maj() RETURNS trigger AS $$
BEGIN
  NEW.date_maj := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_plan_drafts_date_maj_trg
  BEFORE UPDATE ON business_plan_drafts
  FOR EACH ROW EXECUTE FUNCTION business_plan_drafts_date_maj();
