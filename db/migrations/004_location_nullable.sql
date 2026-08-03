-- "location" est désormais entièrement dérivée par le trigger (voir 003_lat_lng_columns.sql).
-- On retire la contrainte NOT NULL pour que les outils (Directus, imports CSV) ne l'exigent plus
-- en saisie directe — en pratique elle est toujours renseignée par le trigger tant que
-- latitude/longitude (elles, NOT NULL) sont fournies.
ALTER TABLE etablissements ALTER COLUMN location DROP NOT NULL;
