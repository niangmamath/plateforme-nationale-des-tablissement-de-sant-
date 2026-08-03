-- L'onglet Démographie (StatsDashboard.tsx) et le module de Scoring (ScoringSection.tsx / maroc.ts)
-- affichaient chacun leur propre valeur de prix au m² pour les mêmes quartiers, déjà divergentes
-- dans le code d'origine. On les préserve toutes les deux telles quelles plutôt que d'en écraser
-- une par l'autre : "prix_m2" reste utilisé par la carte/le scoring, "prix_m2_demo" alimente
-- spécifiquement l'onglet Démographie.
ALTER TABLE zones ADD COLUMN prix_m2_demo numeric;
