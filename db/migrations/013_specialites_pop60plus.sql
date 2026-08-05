-- Ajout de la population 60 ans et plus comme 6e critère commun (oublié dans la première
-- harmonisation, migration 012) — important notamment pour l'Ophtalmologie.
ALTER TABLE specialites ADD COLUMN poids_pop60plus integer NOT NULL DEFAULT 20;

UPDATE specialites SET poids_prix = 35, poids_population = 10, poids_densite = 5,  poids_pop1559 = 25, poids_pop60plus = 10, poids_concurrence = 15 WHERE id = 'Dermatologie';
UPDATE specialites SET poids_prix = 10, poids_population = 15, poids_densite = 5,  poids_pop1559 = 10, poids_pop60plus = 35, poids_concurrence = 25 WHERE id = 'Ophtalmologie';
UPDATE specialites SET poids_prix = 20, poids_population = 30, poids_densite = 15, poids_pop1559 = 10, poids_pop60plus = 10, poids_concurrence = 15 WHERE id = 'Clinique';
