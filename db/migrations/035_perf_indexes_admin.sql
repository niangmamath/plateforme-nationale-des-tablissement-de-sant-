-- Index de performance pour le dashboard admin. Toutes les requêtes stats font des GROUP BY ou
-- des WHERE sur des colonnes de temps, qui déclenchent aujourd'hui des seq scans sur les tables
-- volumineuses (etablissements = 12 500+ lignes aujourd'hui, bien plus demain avec le scraping).
-- À l'échelle actuelle, le seq scan sur etablissements prend ~5 ms ; à 100 000 lignes, un index
-- ramène ça sous la milliseconde pour les COUNT filtrés par statut, et pour les séries temporelles.
--
-- Index partiel sur statut : la grande majorité des établissements est en 'publie' après validation.
-- Un index partiel WHERE statut = 'publie' est plus compact qu'un index complet et accélère les
-- COUNT (statut = 'publie') ou les filtres par source/ville/categorie restreints aux publiés.

CREATE INDEX IF NOT EXISTS etablissements_statut_publie_idx
  ON etablissements (statut) WHERE statut = 'publie';

CREATE INDEX IF NOT EXISTS etablissements_date_created_idx
  ON etablissements (date_created);

CREATE INDEX IF NOT EXISTS users_date_creation_idx
  ON users (date_creation);

CREATE INDEX IF NOT EXISTS business_plan_drafts_date_creation_idx
  ON business_plan_drafts (date_creation);

CREATE INDEX IF NOT EXISTS signalements_date_creation_idx
  ON signalements (date_creation);
