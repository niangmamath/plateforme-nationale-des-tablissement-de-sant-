-- Colonnes utilisées par l'onglet "Démographie" (StatsDashboard.tsx), jusqu'ici codées en
-- dur dans le frontend (ARRONDISSEMENTS_DEMO / SANTE_DATA_DICTIONARY) et donc absentes pour
-- tout pays autre que le Maroc.
ALTER TABLE zones ADD COLUMN pop15_59 numeric;
ALTER TABLE zones ADD COLUMN pop60_plus numeric;
ALTER TABLE zones ADD COLUMN densite numeric;
