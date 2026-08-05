-- Config de recherche/filtrage Google Places par spécialité, jusqu'ici codée en dur dans
-- server/specialitesConfig.ts (3 entrées seulement). La déplacer en base permet à un admin
-- de définir une nouvelle spécialité d'extraction depuis Directus, sans changement de code.
-- Table indépendante de "specialites" (config business plan/scoring) : les deux ne se
-- recouvrent que par coïncidence pour les 3 spécialités actuelles (ex. "Dermatologie" côté
-- business plan vs "Dermatologue" côté catégorie d'établissement/recherche Google).
CREATE TABLE specialite_extraction (
  id            text PRIMARY KEY,   -- valeur exacte utilisée comme etablissements.categorie (ex. "Dermatologue")
  requete       text NOT NULL,      -- terme de recherche Google Places (ex. "dermatologue")
  mots_inclus   jsonb NOT NULL DEFAULT '[]',
  mots_exclus   jsonb NOT NULL DEFAULT '[]',
  types_google  jsonb NOT NULL DEFAULT '[]'
);

INSERT INTO specialite_extraction (id, requete, mots_inclus, mots_exclus, types_google) VALUES
('Ophtalmologie', 'ophtalmologue',
  '["ophtalmo", "œil", "oeil", "yeux", "vision", "rétine"]',
  '["dermato", "généraliste", "général", "cardio", "pédiat", "dent", "neuro", "ortho", "psy", "gynéco", "uro", "gastro", "kiné", "chirurgien", "plastique", "esthéticienne", "spa", "massage", "coiffure", "beauté", "onglerie", "pharma", "laboratoire", "radio", "opticien", "optique"]',
  '["doctor", "health"]'),
('Dermatologue', 'dermatologue',
  '["dermato", "peau", "vénérologie", "vénéréologie", "laser"]',
  '["généraliste", "général", "cardio", "pédiat", "dent", "ophtalmo", "neuro", "ortho", "psy", "gynéco", "uro", "gastro", "kiné", "chirurgien", "plastique", "esthéticienne", "spa", "massage", "coiffure", "beauté", "onglerie", "pharma", "laboratoire", "radio"]',
  '["doctor", "health"]'),
('Clinique Privée', 'clinique privée',
  '["clinique", "polyclinique"]',
  '["dentaire", "vétérinaire", "beauté", "esthétique", "spa", "onglerie", "coiffure"]',
  '["hospital", "health"]');
