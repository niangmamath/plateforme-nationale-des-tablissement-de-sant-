-- Même workflow de validation humaine que sur etablissements (008), étendu à toutes les
-- tables de contenu : une nouvelle ligne démarre en "brouillon" et n'apparaît nulle part sur
-- le site public tant qu'elle n'est pas basculée en "publie" via Directus.

ALTER TABLE pays ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE pays ADD CONSTRAINT pays_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE pays SET statut = 'publie';

ALTER TABLE villes ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE villes ADD CONSTRAINT villes_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE villes SET statut = 'publie';

ALTER TABLE zones ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE zones ADD CONSTRAINT zones_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE zones SET statut = 'publie';

ALTER TABLE specialites ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE specialites ADD CONSTRAINT specialites_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE specialites SET statut = 'publie';

ALTER TABLE specialite_amenagements ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE specialite_amenagements ADD CONSTRAINT specialite_amenagements_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE specialite_amenagements SET statut = 'publie';

ALTER TABLE specialite_effectifs ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE specialite_effectifs ADD CONSTRAINT specialite_effectifs_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE specialite_effectifs SET statut = 'publie';

ALTER TABLE specialite_machines ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE specialite_machines ADD CONSTRAINT specialite_machines_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE specialite_machines SET statut = 'publie';

ALTER TABLE specialite_actes ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE specialite_actes ADD CONSTRAINT specialite_actes_statut_check CHECK (statut IN ('brouillon', 'publie'));
UPDATE specialite_actes SET statut = 'publie';
