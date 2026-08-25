# Empower Doctor

Plateforme d'aide à la décision pour l'implantation de cabinets médicaux et cliniques au Maroc.
Annuaire géolocalisé des établissements de santé existants, scoring par zone (concurrence,
démographie), générateur de business plan par spécialité, et un pipeline d'extraction automatisé
qui alimente la base depuis Google Maps et 5 sites médicaux marocains.

## Stack technique

| Couche | Techno |
|---|---|
| Frontend | React 19 + TypeScript, Vite 6, Tailwind CSS 4, Leaflet (carte), Recharts |
| Backend | Express (dev local) / fonctions serverless Vercel (prod) — voir [docs/BACKEND.md](docs/BACKEND.md) |
| Base de données | PostgreSQL 16 + PostGIS — Docker en local, Supabase en production — voir [docs/DATABASE.md](docs/DATABASE.md) |
| CMS admin | Directus 11 (Docker en local, Render en production) |
| Extraction/scraping | Scripts TypeScript autonomes (`server/scraping/`), exécutés via GitHub Actions |

## Démarrer en local

**Prérequis :** Node.js, Docker.

```bash
npm install
cp .env.example .env      # compléter DIRECTUS_KEY/SECRET, GOOGLE_PLACES_API_KEY, etc.
docker compose up -d      # Postgres+PostGIS (5433) + Directus (8055)
npm run db:migrate
npm run db:seed
npm run dev                # Vite (5174) + API Express (4000) en parallèle
```

Autres scripts utiles : `npm run lint` (`tsc --noEmit`), `npm run test:e2e`, `npm run build`.

## Structure du repo

```
src/                 Frontend React (voir docs/PROJECT.md pour le détail par composant)
server/              API Express (dev) + pipeline d'extraction/scraping
  extraction.ts        Extraction Google Places → insertion en base
  scraping/
    sources.ts           Scrapers DabaDoc, Doctori.ma, Télécontact/PagesJaunes, Med.ma, Medicalis.ma
    dedup.ts             Algorithme de dédoublonnage (scoring nom/GPS/adresse), partagé par tous les pipelines
    orchestrateur.ts     Scraping externe : fusion multi-sources, géocodage, insertion
    config.ts            Slugs vérifiés manuellement par site/spécialité/ville
    notifier.ts          Notification Directus de fin de scraping
    run-cible.ts          CLI : une seule combinaison ville/catégorie
    run-generalisation.ts CLI : balayage complet de toutes les combinaisons
api/                 Fonctions serverless Vercel (prod) — miroir de server/
db/                  Migrations SQL + scripts de seed
docs/                Documentation approfondie (base de données, backend, projet)
.github/workflows/   CI (tests e2e) + scraping-externe.yml (extraction planifiée/manuelle)
docker-compose.yml   Postgres+PostGIS et Directus pour le dev local
```

## Le pipeline d'extraction

Chaque établissement en base vient de l'un de deux pipelines, indépendants mais partageant le même
algorithme de dédoublonnage :

1. **Google Maps** (`server/extraction.ts`) — Google Places Text Search (une requête par variante
   configurée dans Directus) + un Nearby Search complémentaire.
2. **Scraping externe** (`server/scraping/orchestrateur.ts`) — DabaDoc, Doctori.ma, Télécontact /
   PagesJaunes, Med.ma, et Medicalis.ma pour les catégories vérifiées. Chaque site a sa propre
   pagination et son propre format, gérés dans `server/scraping/sources.ts`.

```bash
# Une seule combinaison
npx tsx server/scraping/run-cible.ts "Casablanca" "Ophtalmologie"

# Balayage complet (toutes les villes × catégories couvertes)
npx tsx server/scraping/run-generalisation.ts
```

Tourne uniquement via GitHub Actions (`.github/workflows/scraping-externe.yml`, déclenchable
manuellement ou depuis un Flow Directus) — jamais sur Vercel, car Med.ma/Medicalis.ma nécessitent
Selenium + un vrai Chrome, incompatible avec les fonctions serverless. **Toute insertion se fait en
statut `brouillon`** : aucune publication automatique, revue manuelle dans Directus quelle que soit
la source ou le score de confiance.

### Dédoublonnage (`server/scraping/dedup.ts`)

Une seule fonction, `scoreCorrespondance(a, b) → { score: 0-1, signaux }`, utilisée identiquement
par les deux pipelines pour comparer un candidat à l'existant :

1. **Téléphone identique** (9 derniers chiffres) → 0,97, prioritaire sur tout le reste.
2. **Nom complet quasi-identique** (≥ 0,92) → 0,90, sauf contradiction GPS (> 400 m).
3. Sinon, score composite : **nom 55 % / GPS 30 % / adresse 20 %** — GPS et adresse ne comptent
   comme corroboration que si les noms partagent déjà un minimum de mots réels (sinon un simple
   quartier en commun suffirait à faire matcher deux médecins sans aucun rapport).

Seuils : `SEUIL_DOUBLON_CONFIRME = 0.75` (exclu ou auto-supprimé), `SEUIL_INCERTAIN = 0.35`
(inséré en brouillon, à vérifier manuellement dans Directus).

**Point de vigilance :** `revaliderIncertains` (dans `orchestrateur.ts`) re-vérifie chaque fiche
"à vérifier" une fois son géocodage terminé et **supprime automatiquement, sans relecture humaine**,
tout ce qui atteint le seuil de confirmation — y compris des correspondances inter-catégories sur
simple prénom partagé. Ce n'est pas un cas isolé : cette passe tourne après chaque scraping.

Ajouter une nouvelle spécialité : publier son entrée dans la collection Directus `specialites`
(active Google Maps immédiatement), puis vérifier manuellement le slug de chaque site externe avec
le vrai scraper (un code HTTP 200 ne garantit pas un vrai résultat) avant de l'ajouter à
`CATEGORIE_SLUGS` dans `server/scraping/config.ts`.

## Documentation approfondie

- [docs/PROJECT.md](docs/PROJECT.md) — structure détaillée du frontend, business plan, déploiement
- [docs/DATABASE.md](docs/DATABASE.md) — schéma, migrations, workflow de publication `statut`
- [docs/BACKEND.md](docs/BACKEND.md) — endpoints API, double surface Express/Vercel

> `docs/PROJECT.md` décrit encore d'anciens scrapers Python (`scraper_etablissements.py`) comme
> flux de production — ils ont été remplacés par le pipeline TypeScript décrit ci-dessus
> (`server/scraping/`), qui écrit directement en base au lieu de produire des `.xlsx`.
