-- Retour sur 006 : on n'utilise plus qu'une seule valeur de prix/m² par zone (prix_m2, celle de
-- maroc.ts déjà utilisée par la carte/le scoring), y compris pour l'onglet Démographie.
ALTER TABLE zones DROP COLUMN prix_m2_demo;
