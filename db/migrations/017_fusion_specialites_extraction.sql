-- Fusionne specialite_extraction dans specialites : une spécialité n'était scindée en deux
-- tables (une pour le scoring/business plan, une pour l'extraction Google) que par accident
-- d'implémentation — ça obligeait à publier deux fois la même chose dans deux endroits
-- différents pour qu'elle soit pleinement active. Une seule table, une seule publication.
ALTER TABLE specialites ADD COLUMN requete text;
ALTER TABLE specialites ADD COLUMN variantes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE specialites ADD COLUMN mots_inclus jsonb NOT NULL DEFAULT '[]';
ALTER TABLE specialites ADD COLUMN mots_exclus jsonb NOT NULL DEFAULT '[]';
ALTER TABLE specialites ADD COLUMN types_google jsonb NOT NULL DEFAULT '[]';

UPDATE specialites s
SET requete = se.requete, variantes = se.variantes, mots_inclus = se.mots_inclus,
    mots_exclus = se.mots_exclus, types_google = se.types_google
FROM specialite_extraction se
WHERE s.categorie_etablissement = se.id;

ALTER TABLE specialites ALTER COLUMN requete SET NOT NULL;

DROP TABLE specialite_extraction;
