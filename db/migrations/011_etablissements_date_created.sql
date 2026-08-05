-- Sans colonne de date d'ajout, les nouveaux établissements extraits automatiquement se
-- retrouvent noyés au milieu de la liste (tri par défaut sur id, lexicographique) — l'admin
-- ne les voit pas après une extraction. Ajoute une date de création pour trier du plus récent.
ALTER TABLE etablissements ADD COLUMN date_created timestamptz NOT NULL DEFAULT now();
