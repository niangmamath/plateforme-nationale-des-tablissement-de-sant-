-- Description-type de la patientèle par spécialité, pour pré-remplir la section "La Clientèle" du
-- business plan (Partie IV, Étude Commerciale) sans jamais afficher un profil de patientèle propre
-- à une autre spécialité : nullable, chaque spécialité sans texte renseigné laisse le champ vide et
-- éditable, exactement comme avant. Texte rédigé à partir d'une documentation professionnelle sur le
-- champ d'exercice de la spécialité (patientèle et types de prise en charge), pas une invention.
ALTER TABLE specialites ADD COLUMN clientele_type text;

UPDATE specialites SET clientele_type =
'Patientèle de tous âges présentant une affection de l''œil ou de ses structures connexes, émergente, aiguë ou chronique, ou toute pathologie ayant une incidence sur la vision : troubles congénitaux, troubles primaires acquis et manifestations ophtalmiques de maladies systémiques.

Le cabinet assure aussi bien les soins préventifs (dépistage, évaluation, diagnostic) que la prise en charge thérapeutique : prescription de dispositifs optiques, traitement médical, interventions (injections intravitréennes, laser, chirurgie), suivi et réadaptation, ainsi que l''accompagnement des patients face aux répercussions d''une perte de vision.'
WHERE id = 'Ophtalmologie';
