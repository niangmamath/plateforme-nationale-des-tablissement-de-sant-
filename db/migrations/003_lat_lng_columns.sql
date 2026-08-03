-- Colonnes lat/lng simples pour permettre un import CSV/Excel ordinaire
-- (au lieu d'écrire du GeoJSON à la main dans la colonne "location").
ALTER TABLE etablissements ADD COLUMN latitude double precision;
ALTER TABLE etablissements ADD COLUMN longitude double precision;

-- Backfill depuis la colonne géographique existante
UPDATE etablissements
SET latitude = ST_Y(location::geometry),
    longitude = ST_X(location::geometry);

ALTER TABLE etablissements ALTER COLUMN latitude SET NOT NULL;
ALTER TABLE etablissements ALTER COLUMN longitude SET NOT NULL;

-- "location" (PostGIS) devient dérivée de latitude/longitude : on ne l'édite plus à la main,
-- elle se recalcule automatiquement dès que latitude/longitude sont renseignées.
CREATE OR REPLACE FUNCTION etablissements_set_location() RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_etablissements_set_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON etablissements
FOR EACH ROW
EXECUTE FUNCTION etablissements_set_location();
