-- Rend le sélecteur de spécialités du module de scoring piloté par la base (comme les 6
-- critères communs le sont déjà) : categorie_etablissement relie une spécialité "business
-- plan" à sa catégorie réelle dans etablissements (pour calculer la vraie concurrence), et
-- icone permet d'afficher un bouton dynamique sans code pour une nouvelle spécialité.
ALTER TABLE specialites ADD COLUMN categorie_etablissement text;
ALTER TABLE specialites ADD COLUMN icone text NOT NULL DEFAULT 'Stethoscope';

UPDATE specialites SET categorie_etablissement = 'Dermatologue', icone = 'Stethoscope' WHERE id = 'Dermatologie';
UPDATE specialites SET categorie_etablissement = 'Ophtalmologie', icone = 'Eye' WHERE id = 'Ophtalmologie';
UPDATE specialites SET categorie_etablissement = 'Clinique Privée', icone = 'Building2' WHERE id = 'Clinique';

ALTER TABLE specialites ALTER COLUMN categorie_etablissement SET NOT NULL;
