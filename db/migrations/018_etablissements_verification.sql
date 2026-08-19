-- Jusqu'ici, un brouillon "peut-être déjà en base" (score de dédoublonnage dans la zone
-- incertaine) se distinguait d'un brouillon "vraiment nouveau" uniquement par un texte ajouté
-- au champ source (ex. "... — doublon possible avec etab-95, à vérifier") — invisible dans la
-- liste Directus par défaut, illisible sans ouvrir chaque fiche. Deux vraies colonnes, filtrables
-- et affichables comme colonne dans Directus, remplacent ce texte libre.
-- Pas de clé étrangère : c'est un indice informatif pour la revue humaine, pas une relation
-- stricte — l'établissement pointé peut être supprimé plus tard (ex. lui-même identifié comme
-- doublon et retiré) sans que ça doive invalider ou bloquer la fiche qui le référence.
ALTER TABLE etablissements ADD COLUMN verification_requise boolean NOT NULL DEFAULT false;
ALTER TABLE etablissements ADD COLUMN doublon_possible_id text;

-- Reprend les brouillons déjà marqués via le texte du champ source (extraction Google Maps et
-- scraping externe de cette session) et nettoie source pour ne garder que le libellé d'origine.
UPDATE etablissements
SET
  verification_requise = true,
  doublon_possible_id = substring(source FROM 'doublon possible avec (etab-[^,]+)'),
  source = trim(both ' ' FROM regexp_replace(source, ' — doublon possible avec etab-[^,]+, à vérifier', ''))
WHERE source LIKE '%doublon possible avec%';
