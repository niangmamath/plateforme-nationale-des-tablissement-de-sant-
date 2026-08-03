CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE pays (
  id      text PRIMARY KEY,
  nom     text NOT NULL,
  devise  text NOT NULL
);

CREATE TABLE villes (
  id         text PRIMARY KEY,
  pays_id    text NOT NULL REFERENCES pays(id) ON DELETE CASCADE,
  nom        text NOT NULL,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  zoom_base  integer NOT NULL DEFAULT 12
);

CREATE TABLE zones (
  id          text PRIMARY KEY,
  ville_id    text NOT NULL REFERENCES villes(id) ON DELETE CASCADE,
  nom         text NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  population  integer NOT NULL,
  prix_m2     numeric NOT NULL,
  loyer_m2    numeric NOT NULL
);

CREATE TABLE etablissements (
  id              text PRIMARY KEY,
  nom             text NOT NULL,
  categorie       text NOT NULL,
  ville           text NOT NULL,
  quartier        text NOT NULL,
  arrondissement  text,
  adresse         text NOT NULL DEFAULT '',
  location        geography(Point, 4326) NOT NULL,
  source          text NOT NULL,
  place_id        text
);

CREATE INDEX etablissements_location_idx ON etablissements USING GIST (location);
CREATE INDEX etablissements_ville_idx ON etablissements (ville);
CREATE INDEX etablissements_categorie_idx ON etablissements (categorie);
CREATE INDEX zones_ville_id_idx ON zones (ville_id);
