-- Même filet de sécurité que partout ailleurs dans le projet : une config d'extraction
-- nouvellement créée reste en brouillon (non utilisable) jusqu'à validation explicite.
ALTER TABLE specialite_extraction ADD COLUMN statut text NOT NULL DEFAULT 'brouillon';
ALTER TABLE specialite_extraction ADD CONSTRAINT specialite_extraction_statut_check CHECK (statut IN ('brouillon', 'publie'));

UPDATE specialite_extraction SET statut = 'publie' WHERE id IN ('Ophtalmologie', 'Dermatologue', 'Clinique Privée');
