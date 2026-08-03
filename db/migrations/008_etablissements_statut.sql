-- Workflow de validation humaine avant publication : toute nouvelle ligne (import CSV,
-- futur scraper, saisie manuelle) démarre en "brouillon" et n'apparaît pas sur le site public
-- tant qu'un humain ne la bascule pas en "publie" via Directus.
ALTER TABLE etablissements ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE etablissements ADD CONSTRAINT etablissements_statut_check CHECK (statut IN ('brouillon', 'publie'));

-- Les 404 établissements déjà en place restent visibles : ils passent en "publie".
UPDATE etablissements SET statut = 'publie';
