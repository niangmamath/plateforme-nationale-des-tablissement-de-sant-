-- Plusieurs formulations de requête par spécialité (en plus de "requete") + recherche Nearby
-- Search complémentaire : testé, donne un gain réel de couverture (+13% à +175% selon les cas,
-- voir conversation) sans les défauts de la grille géographique testée précédemment.
ALTER TABLE specialite_extraction ADD COLUMN variantes jsonb NOT NULL DEFAULT '[]';

UPDATE specialite_extraction SET variantes = '["ophtalmologiste", "cabinet d''ophtalmologie", "clinique ophtalmologique"]' WHERE id = 'Ophtalmologie';
UPDATE specialite_extraction SET variantes = '["dermatologiste", "cabinet de dermatologie", "clinique dermatologique"]' WHERE id = 'Dermatologue';
UPDATE specialite_extraction SET variantes = '["polyclinique", "clinique médicale", "centre médical privé"]' WHERE id = 'Clinique Privée';
