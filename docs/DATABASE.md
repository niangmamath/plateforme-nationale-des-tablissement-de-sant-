# Base de données — Documentation

Ce document décrit l'architecture de données du projet : outils utilisés, schéma, workflow de
publication, et pièges connus. Il complète (sans le remplacer) le code lui-même, qui reste la
source de vérité — voir en particulier `db/migrations/`, `db/migrate.ts`, `db/seed*.ts` et
`server/queries.ts`.

## 1. Vue d'ensemble

| Composant | Outil | Rôle |
|---|---|---|
| Base de données | PostgreSQL 16 + extension **PostGIS** 3.4 | Stockage relationnel + géospatial |
| Local | `postgis/postgis:16-3.4-alpine` via Docker (`docker-compose.yml`) | Dev local, port `5433` |
| Production | **Supabase** (Postgres managé) | `SUPABASE_DATABASE_URL` (pooler transaction, port 6543) et `SUPABASE_DATABASE_URL_SESSION` (pooler session, port 5432, pour migrations/pg_dump) |
| CMS admin | **Directus 11** (`directus/directus:11`, Docker en local, déployé sur **Render** en prod) | Interface d'administration/édition du contenu, pointe sur la même base que l'app |
| Driver Node | [`pg`](https://node-postgres.com/) (`Pool`/`Client`), pas d'ORM | `server/db.ts`, `api/_lib/db.ts`, scripts `db/*.ts` |
| Migrations | Runner **maison** (`db/migrate.ts`), pas de framework (Prisma/Knex/Drizzle) | Fichiers SQL bruts, appliqués une fois, trackés en base |
| Seed | Scripts TypeScript (`db/seed.ts`, `db/seed_specialites.ts`, `db/seed_zones_demographie.ts`) | Données de référence (pas de fixtures JSON) |

Il n'y a **pas** de couche ORM : toutes les requêtes sont du SQL manuscrit via `pg`
(`server/queries.ts`, `server/extraction.ts`).

## 2. Connexion — variables d'environnement

Toute la config vit dans `.env` (gitignored — chacun a le sien, cf `.env.example` pour le
template). Variable centrale : `DATABASE_URL`, lue par `server/db.ts`, `db/migrate.ts`,
`db/seed*.ts` et `api/_lib/db.ts`.

```
# Local (Docker) — valeur par défaut de .env.example
DATABASE_URL="postgresql://medimplant:medimplant@localhost:5433/medimplant"

# Production — pointe sur Supabase à la place
SUPABASE_DATABASE_URL="postgresql://...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
SUPABASE_DATABASE_URL_SESSION="postgresql://...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

Directus a ses propres variables (`DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`,
`DIRECTUS_ADMIN_PASSWORD`, `DB_*`) définies dans `docker-compose.yml`. En local il pointe sur le
même conteneur Postgres que l'app (`db`, service Docker) ; en prod (Render) il pointe sur
Supabase, configuré directement dans le dashboard Render (pas dans ce repo).

`ADMIN_EMAIL`/`ADMIN_PASSWORD` de Directus ne servent qu'au tout premier démarrage (bootstrap du
compte admin quand `directus_users` est vide) — sans effet sur une base déjà initialisée.

Deux pools distincts existent côté app : `server/db.ts` (un seul `Pool` global, pour le serveur
Express local) et `api/_lib/db.ts` (un `Pool` avec `max: 3`, réutilisé entre invocations d'une
fonction serverless Vercel « chaude »).

## 3. Système de migrations

`db/migrate.ts` est un runner minimaliste :

1. Crée (si absente) une table `schema_migrations (filename text PRIMARY KEY, applied_at timestamptz)`.
2. Liste les fichiers de `db/migrations/*.sql`, triés par nom (convention `NNN_description.sql`).
3. Pour chaque fichier non encore présent dans `schema_migrations`, l'exécute dans une transaction
   (`BEGIN` / `COMMIT`, `ROLLBACK` si erreur) puis enregistre son nom.

Commande : `npm run db:migrate`. Idempotent — rejouable sans risque, ignore ce qui est déjà appliqué.

### Historique des migrations

| # | Fichier | Effet |
|---|---|---|
| 001 | `init` | Active PostGIS ; crée `pays`, `villes`, `zones`, `etablissements` (avec colonne géo `location geography(Point,4326)`) |
| 002 | `specialites` | Crée `specialites` + 4 tables filles (`specialite_amenagements/effectifs/machines/actes`) — module business plan/scoring |
| 003 | `lat_lng_columns` | Ajoute `latitude`/`longitude` sur `etablissements` ; trigger qui recalcule `location` (PostGIS) automatiquement à partir d'elles |
| 004 | `location_nullable` | `location` n'est plus `NOT NULL` en saisie directe (dérivée par trigger) |
| 005 | `zones_demographie` | Ajoute `pop15_59`, `pop60_plus`, `densite` sur `zones` |
| 006 | `zones_prix_demographie` | Ajoute (temporairement) `prix_m2_demo` sur `zones` |
| 007 | `remove_prix_m2_demo` | Retour sur 006 — supprime `prix_m2_demo`, un seul `prix_m2` utilisé partout |
| 008 | `etablissements_statut` | Ajoute le workflow `statut` (`brouillon`/`publie`) sur `etablissements` |
| 009 | `statut_toutes_tables` | Étend le workflow `statut` à `pays`, `villes`, `zones`, `specialites` + ses 4 tables filles |
| 010 | `specialite_extraction` | Crée `specialite_extraction` (config de recherche Google Places par spécialité) |
| 011 | `etablissements_date_created` | Ajoute `date_created` (tri des nouveaux établissements extraits) |
| 012 | `specialites_criteres_communs` | Remplace les 3 critères `poids_1/2/3` (+labels) par 5 critères communs (`poids_prix`, `poids_population`, `poids_densite`, `poids_pop1559`, `poids_concurrence`) |
| 013 | `specialites_pop60plus` | Ajoute un 6e critère commun : `poids_pop60plus` |

## 4. Schéma

### Contenu géographique/annuaire

```
pays (id PK, nom, devise, statut)
 └─ villes (id PK, pays_id FK→pays, nom, lat, lng, zoom_base, statut)
     └─ zones (id PK, ville_id FK→villes, nom, lat, lng, population,
                prix_m2, loyer_m2, pop15_59, pop60_plus, densite, statut)

etablissements (id PK, nom, categorie, ville, quartier, arrondissement, adresse,
                latitude, longitude, location [geography, dérivée par trigger],
                source, place_id, statut, date_created)
  index: GIST(location), btree(ville), btree(categorie)
```

`etablissements` référence `ville`/`quartier` par **texte libre**, pas de FK vers `villes`/`zones`
(dénormalisé — l'app fait le rapprochement par nom côté application, cf `App.tsx` :
`scopedEstablishments`).

### Module business plan / scoring

```
specialites (id PK 'Dermatologie'|'Ophtalmologie'|'Clinique', nom, couleur,
             titre_business_plan, specialite_nom_bp, cible_key, cible_label,
             poids_prix, poids_population, poids_densite, poids_pop1559,
             poids_pop60plus, poids_concurrence,
             frais_preliminaires, surface_defaut, bfr, statut)
 ├─ specialite_amenagements (id, specialite_id FK, nom, prix, ordre, statut)
 ├─ specialite_effectifs    (id, specialite_id FK, nom, qte, salaire, ordre, statut)
 ├─ specialite_machines     (id, specialite_id FK, nom, prix, ordre, statut)
 └─ specialite_actes        (id, specialite_id FK, type, nom, nbr_jour, prix_unitaire, ordre, statut)
```

Les 6 poids (`poids_*`) pilotent le module de scoring par zone (`ScoringSection.tsx`) — critères
harmonisés en migration 012/013, communs aux 3 spécialités mais avec un poids de départ propre à
chacune.

### Extraction automatisée

```
specialite_extraction (id PK, requete, mots_inclus jsonb, mots_exclus jsonb, types_google jsonb)
```

Indépendante de `specialites` (coïncidence de nommage pour les 3 entrées actuelles seulement,
cf commentaire dans la migration 010) : cette table configure la recherche Google Places
(`server/extraction.ts`), l'autre configure le business plan/scoring.

## 5. Spécificité PostGIS

- `etablissements.location` est de type `geography(Point, 4326)` (WGS84), indexé en `GIST` pour
  des requêtes géospatiales performantes.
- Depuis la migration 003, on ne l'édite plus à la main : un trigger `BEFORE INSERT OR UPDATE`
  (`etablissements_set_location`) la recalcule automatiquement à partir de `latitude`/`longitude`
  (`ST_SetSRID(ST_MakePoint(lng, lat), 4326)`). Ça permet d'importer via CSV/Excel ou Directus avec
  de simples nombres, sans écrire de GeoJSON/WKT à la main.
- `latitude`/`longitude` sont `NOT NULL` ; `location` ne l'est plus (dérivée, migration 004).

## 6. Workflow de publication (`statut`)

Toutes les tables de contenu ont une colonne `statut text NOT NULL DEFAULT 'brouillon'` avec
`CHECK (statut IN ('brouillon', 'publie'))` (migrations 008/009).

- **But** : une nouvelle ligne (import, extraction automatique, saisie manuelle) démarre invisible
  côté public ; un humain la bascule en `'publie'` via **Directus** avant qu'elle apparaisse sur le
  site.
- **Application côté lecture** : `server/queries.ts` (et son miroir `api/*.ts` pour Vercel) filtre
  systématiquement `WHERE statut = 'publie'` sur toutes les tables de contenu.
- **Application côté écriture automatisée** : `server/extraction.ts` insère volontairement les
  nouveaux établissements en `statut = 'brouillon'` (ligne ~200) — c'est le comportement voulu,
  ils doivent être validés dans Directus avant publication.

> ⚠️ **Piège connu (déjà rencontré)** : les scripts de seed (`db/seed.ts`,
> `db/seed_specialites.ts`) font un `TRUNCATE ... RESTART IDENTITY CASCADE` puis ré-insèrent les
> données de référence. Comme `statut` vaut `'brouillon'` par défaut, toute ligne réinsérée sans
> préciser `statut` redevient invisible côté API — l'app reste bloquée sur
> « Chargement des données... » sans erreur explicite, malgré des lignes bien présentes en base.
> **Les deux scripts publient désormais explicitement leurs données** (`UPDATE ... SET statut =
> 'publie'` juste avant le `COMMIT`) — à reproduire dans tout nouveau script qui truncate/réinsère
> des données de référence.

## 7. Couche d'accès applicatif

- **Local (dev)** : `server/index.ts` (Express, port `4000` par défaut) expose
  `GET /api/pays`, `GET /api/etablissements`, `GET /api/specialites`, et
  `POST /api/admin/extraction` (déclenche `extraireEtInserer`, appelé depuis un Flow Directus).
  Vite proxy `/api` vers ce serveur (`vite.config.ts`).
- **Production (Vercel)** : `api/pays.ts`, `api/etablissements.ts`, `api/specialites.ts` sont des
  fonctions serverless qui appellent les **mêmes fonctions** `server/queries.ts` (import direct,
  extensions `.js` explicites requises car le projet est en ESM). `api/_lib/db.ts` fournit un pool
  séparé, dimensionné pour le serverless (`max: 3`).
- Toutes les requêtes de lecture publique passent par `server/queries.ts` — c'est le point unique
  à modifier si le filtre `statut` ou la forme des données change.

## 8. Seed — données de référence

Commande : `npm run db:seed` = `tsx db/seed.ts && tsx db/seed_specialites.ts && tsx db/seed_zones_demographie.ts`.

| Script | Truncate | Source des données | Remplit |
|---|---|---|---|
| `db/seed.ts` | `etablissements, zones, villes, pays` | `src/data` (`AVAILABLE_COUNTRIES`, `ESTABLISHMENTS_DATA`) | Annuaire pays/villes/zones/établissements |
| `db/seed_specialites.ts` | `specialite_actes, specialite_machines, specialite_effectifs, specialite_amenagements, specialites` | Config codée dans le script + `src/config/specialities` (`DERMATO_CONFIG`, `OPHTALMO_CONFIG`, `CLINIQUE_CONFIG`) | Module business plan/scoring |
| `db/seed_zones_demographie.ts` | — (`UPDATE` ciblé, pas de truncate ; dépend des zones créées par `db/seed.ts`, doit donc s'exécuter après) | Constantes `MAROC_DEMO`/`SENEGAL_DEMO` codées dans le script | `pop15_59`/`pop60_plus`/`densite` des zones existantes |

Aucun des scripts de seed ne dépend des fichiers `.xlsx` du repo (ceux-ci ne sont utilisés que par
les scrapers Python `scraper_*.py`, en dehors du flux `npm run db:seed`).

## 9. Directus (CMS admin)

- Rôle : interface d'administration pour publier/dépublier le contenu (`statut`), éditer les
  zones/établissements/spécialités, et héberger le **Flow** qui déclenche l'extraction automatique
  (`POST /api/admin/extraction` côté app).
- Se connecte en `DB_CLIENT=pg` directement sur les mêmes tables que l'app — pas de schéma
  Directus séparé, il lit/écrit le schéma applicatif décrit ci-dessus (plus ses propres tables
  internes `directus_*` pour les utilisateurs, permissions, flows, etc.).
- En local : conteneur Docker `medimplant-directus`, port `8055`, pointe sur le conteneur
  `medimplant-postgres` local (`DB_HOST: db` dans `docker-compose.yml`).
- En prod : déployé sur Render, configuré (hors de ce repo, dans le dashboard Render) pour pointer
  sur Supabase — **la même base que l'app en production**.

## 10. Points d'attention

- **Pas de FK entre `etablissements` et `villes`/`zones`** : le rapprochement se fait par nom de
  ville en texte libre côté frontend (`App.tsx`). Renommer une ville dans `villes.nom` sans mettre
  à jour `etablissements.ville` casse le filtrage par ville.
- **Tout nouveau script qui `TRUNCATE`+réinsère** une table de contenu doit explicitement publier
  (`statut = 'publie'`) sinon les données deviennent invisibles côté API sans erreur visible
  (cf §6).
- **`specialites` vs `specialite_extraction`** : deux tables distinctes qui partagent des noms
  proches par coïncidence pour les 3 spécialités actuelles — ne pas supposer qu'ajouter une ligne
  dans l'une suffit pour l'autre.
- **Deux environnements de données possibles en local** : `DATABASE_URL` peut pointer sur le
  Postgres Docker local *ou* directement sur Supabase (en changeant simplement la valeur dans
  `.env`) — toujours vérifier que le script qu'on exécute (seed, migration) et le serveur qui sert
  l'API tapent sur la **même** base avant de diagnostiquer un bug de données.
