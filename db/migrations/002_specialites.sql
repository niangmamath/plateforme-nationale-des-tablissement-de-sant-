CREATE TABLE specialites (
  id                   text PRIMARY KEY,           -- 'Dermatologie' | 'Ophtalmologie' | 'Clinique'
  nom                  text NOT NULL,
  couleur              text NOT NULL,
  titre_business_plan  text NOT NULL,
  specialite_nom_bp    text NOT NULL,
  cible_key            text,                        -- 'pop15_59' | 'pop60_plus' | null
  cible_label          text,
  poids_1              integer NOT NULL,             -- w1 (0-100 avant normalisation)
  poids_1_label        text NOT NULL,
  poids_2              integer NOT NULL,
  poids_2_label        text NOT NULL,
  poids_3              integer NOT NULL,
  poids_3_label        text NOT NULL,
  frais_preliminaires  numeric NOT NULL DEFAULT 5000,
  surface_defaut       integer NOT NULL DEFAULT 80,
  bfr                  numeric NOT NULL DEFAULT 25000
);

CREATE TABLE specialite_amenagements (
  id             serial PRIMARY KEY,
  specialite_id  text NOT NULL REFERENCES specialites(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  prix           numeric NOT NULL,
  ordre          integer NOT NULL DEFAULT 0
);

CREATE TABLE specialite_effectifs (
  id             serial PRIMARY KEY,
  specialite_id  text NOT NULL REFERENCES specialites(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  qte            integer NOT NULL,
  salaire        numeric NOT NULL,
  ordre          integer NOT NULL DEFAULT 0
);

CREATE TABLE specialite_machines (
  id             serial PRIMARY KEY,
  specialite_id  text NOT NULL REFERENCES specialites(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  prix           numeric NOT NULL,
  ordre          integer NOT NULL DEFAULT 0
);

CREATE TABLE specialite_actes (
  id             serial PRIMARY KEY,
  specialite_id  text NOT NULL REFERENCES specialites(id) ON DELETE CASCADE,
  type           text,
  nom            text NOT NULL,
  nbr_jour       integer NOT NULL,
  prix_unitaire  numeric NOT NULL,
  ordre          integer NOT NULL DEFAULT 0
);

CREATE INDEX specialite_amenagements_sid_idx ON specialite_amenagements (specialite_id);
CREATE INDEX specialite_effectifs_sid_idx ON specialite_effectifs (specialite_id);
CREATE INDEX specialite_machines_sid_idx ON specialite_machines (specialite_id);
CREATE INDEX specialite_actes_sid_idx ON specialite_actes (specialite_id);
