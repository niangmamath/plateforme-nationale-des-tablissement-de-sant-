-- 7e critère démographique commun : part des moins de 15 ans (zones.pop0_14, HCP), avec son poids
-- par spécialité. Défaut 0 : une spécialité sans lien avec l'enfance n'est pas modifiée. Le
-- score normalise par la somme des poids, donc ajouter un critère ne casse pas les autres.
--
-- Poids choisis selon la part de la patientèle constituée d'enfants (ce sont des réglages
-- éditables dans Directus, pas des données mesurées) :
--   Pédiatrie 40      : patientèle quasi exclusivement < 15 ans -> le critère le plus déterminant.
--                       60+ ramené à 0 : sans objet ; 15-59 (les parents) reste à 20.
--   Dentisterie 20    : soins dentaires et orthodontie de l'enfant, à parité avec les autres critères.
--   ORL 20            : les infections ORL sont fréquentes chez l'enfant (angines, otites), à parité.
--   Médecine générale 20 : tous les âges, à parité avec les autres critères démographiques.
--   Clinique 10       : pluridisciplinaire (dont pédiatrie), même poids que 15-59 et 60+ (10 chacun).
--   Ophtalmologie 5   : dépistage visuel de l'enfant, secondaire face au poids senior (35).
--   Dermatologie 0    : la logique esthétique/pouvoir d'achat domine, l'enfant n'est pas la cible.
--   Autres 0          : pas de demande pédiatrique spécifique (cardiologie, néphrologie, oncologie...).
ALTER TABLE specialites ADD COLUMN poids_pop0_14 integer NOT NULL DEFAULT 0;

UPDATE specialites SET poids_pop0_14 = 40, poids_pop60plus = 0, cible_key = 'pop0_14', cible_label = 'Enfants (moins de 15 ans)' WHERE id = 'Pediatrie';
UPDATE specialites SET poids_pop0_14 = 20 WHERE id IN ('Dentisterie', 'ORL', 'MedecineGenerale');
UPDATE specialites SET poids_pop0_14 = 10 WHERE id = 'Clinique';
UPDATE specialites SET poids_pop0_14 = 5 WHERE id = 'Ophtalmologie';
