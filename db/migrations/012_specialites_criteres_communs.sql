-- Harmonisation des critères personnalisables du module de scoring : les 3 spécialités
-- avaient chacune 3 critères différents, codés en dur (ex. "Connectivité Routière" pour
-- Clinique, "Accessibilité Foncier" pour Ophtalmologie — des données fictives, jamais
-- alimentées en base). On passe à 5 critères communs, réellement disponibles par zone
-- (prix, population, densité, population 15-59 ans, concurrence), avec un poids de départ
-- propre à chaque spécialité mais la même liste de critères pour toutes.
ALTER TABLE specialites
  ADD COLUMN poids_prix        integer NOT NULL DEFAULT 20,
  ADD COLUMN poids_population  integer NOT NULL DEFAULT 20,
  ADD COLUMN poids_densite     integer NOT NULL DEFAULT 20,
  ADD COLUMN poids_pop1559     integer NOT NULL DEFAULT 20,
  ADD COLUMN poids_concurrence integer NOT NULL DEFAULT 20;

UPDATE specialites SET poids_prix = 40, poids_population = 10, poids_densite = 5,  poids_pop1559 = 30, poids_concurrence = 15 WHERE id = 'Dermatologie';
UPDATE specialites SET poids_prix = 15, poids_population = 25, poids_densite = 10, poids_pop1559 = 20, poids_concurrence = 30 WHERE id = 'Ophtalmologie';
UPDATE specialites SET poids_prix = 25, poids_population = 35, poids_densite = 20, poids_pop1559 = 10, poids_concurrence = 10 WHERE id = 'Clinique';

ALTER TABLE specialites
  DROP COLUMN poids_1, DROP COLUMN poids_1_label,
  DROP COLUMN poids_2, DROP COLUMN poids_2_label,
  DROP COLUMN poids_3, DROP COLUMN poids_3_label;
