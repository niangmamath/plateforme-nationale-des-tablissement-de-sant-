-- Surface de la zone (km²), mesurée sur son contour OpenStreetMap. Sert à recalculer la densité
-- (population HCP / surface) de façon vérifiable au lieu d'une valeur saisie à la main. NULL si
-- aucun contour fiable n'a été trouvé : la densité reste alors NULL, jamais estimée.
ALTER TABLE zones ADD COLUMN surface_km2 numeric;
