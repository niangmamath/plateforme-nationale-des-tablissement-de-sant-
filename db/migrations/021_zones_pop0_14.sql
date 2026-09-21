-- Part de la population de moins de 15 ans (%), lue chez HCP (RGPH 2024, indicateur "Part de la
-- population de moins de 15 ans (%)") comme pop15_59 et pop60_plus. NULL tant que la zone n'a pas
-- été rapprochée d'une commune HCP : jamais estimée.
ALTER TABLE zones ADD COLUMN pop0_14 numeric;
