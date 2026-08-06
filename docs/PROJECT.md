# Documentation du projet

Vue d'ensemble du projet : ce qu'il fait, comment il est structuré, et comment le faire tourner.
Pour le détail de la base de données et de l'API, voir [DATABASE.md](DATABASE.md) et
[BACKEND.md](BACKEND.md) — ce document donne le contexte global et couvre le frontend, les
scrapers et le déploiement, non traités ailleurs.

## 1. Objet du projet

Plateforme d'aide à la décision pour l'implantation de cabinets médicaux/cliniques au Maroc (et
extensible à d'autres pays — le Sénégal est déjà préparé dans les données). Trois usages
principaux, réunis dans une seule app :

1. **Annuaire géolocalisé** des établissements de santé (cliniques, dermatologues,
   ophtalmologues) — carte interactive, filtres, export.
2. **Module de scoring par zone** : pour une spécialité donnée, note chaque quartier/zone selon
   des critères pondérés (prix, population, démographie, concurrence) pour identifier les
   meilleurs emplacements.
3. **Générateur de business plan** par spécialité (aménagements, effectifs, machines, actes,
   projection financière) à partir d'une zone choisie.

Une administration **Directus** permet à un non-développeur de gérer le contenu (publier de
nouveaux établissements, ajuster les zones/spécialités) et de déclencher une **extraction
automatisée** de nouveaux établissements via l'API Google Places.

## 2. Stack technique

| Couche | Techno |
|---|---|
| Frontend | React 19 + TypeScript, Vite 6, Tailwind CSS 4, Leaflet (carte), Recharts (graphiques), `motion` (animations) |
| Backend | Express (dev) / fonctions serverless Vercel (prod) — voir [BACKEND.md](BACKEND.md) |
| Base de données | PostgreSQL 16 + PostGIS (Docker local / Supabase en prod) — voir [DATABASE.md](DATABASE.md) |
| CMS admin | Directus 11 |
| Scrapers | Python (`googlemaps`, `pandas`, `psycopg2`) |
| Déploiement | Vercel (app + API), Render (Directus), Supabase (DB managée) |

Pas d'ORM, pas de framework de test, pas de CI configurée dans le repo (pas de `.github/workflows`).

## 3. Structure du repo

```
src/                      Frontend React
  App.tsx                 Composant racine : fetch initial, état global (pays/ville sélectionnés, filtres)
  components/
    GlobalLocationSelector.tsx   Sélecteur pays/ville en haut de page (scope toute la page)
    KpiSection.tsx               Cartes d'indicateurs (totaux par catégorie)
    FilterSection.tsx            Filtres de l'annuaire (recherche, ville, quartier, catégorie, source)
    SidebarList.tsx              Liste des établissements filtrés
    InteractiveMap.tsx           Carte Leaflet (styles clair/sombre/satellite, sélection d'un établissement)
    StatsDashboard.tsx           Onglets Démographie / Scoring / répartitions (ville, quartier, catégorie, source)
    ScoringSection.tsx           Module de scoring par zone (curseurs de pondération par spécialité)
    BusinessPlanGenerator.tsx    Générateur de business plan générique (surface, aménagements, effectifs...)
    BusinessPlan{Clinique,Dermato,Ophtalmo}.tsx   Variantes par spécialité du générateur
    ChatbotWidget.tsx            Widget de chat — réponses simulées par mots-clés, PAS d'appel IA réel
  config/
    specialities/{dermato,ophtalmo,clinique}.ts   Config par défaut (aménagements/effectifs/machines/actes) — reprise par db/seed_specialites.ts
  data/
    etablissements.ts       Données de secours/seed (398 établissements) — source de db/seed.ts
    locations/maroc.ts      Hiérarchie pays→villes→zones (Maroc) — source de db/seed.ts
  types.ts                 Types partagés (Etablissement, PaysGeo/VilleGeo/ZoneGeo, FilterState, KpiData)

server/                   API Express (dev local) — voir BACKEND.md
api/                       Fonctions serverless Vercel (prod) — voir BACKEND.md
db/                        Migrations + scripts de seed — voir DATABASE.md
docs/                       Cette documentation

scraper_etablissements.py   Scraper générique multi-spécialités (Google Places → .xlsx)
scraper_ophtalmo.py         Scraper spécifique ophtalmologie (antérieur, probablement superseded)
scraper_immo.py             Vide — non implémenté

docker-compose.yml          Postgres+PostGIS et Directus, pour le dev local
clean.cjs                   Script ponctuel de nettoyage de src/data/etablissements.ts (dette technique, pas réutilisé en pipeline)
```

## 4. Frontend — flux de données

`App.tsx` charge `/api/pays` et `/api/etablissements` au montage (`useEffect` + `Promise.all`),
garde `countries`/`baseEstablishments` en state, et sélectionne le premier pays par défaut. Toute
la page est ensuite **scopée** par le couple pays/ville actif
(`GlobalLocationSelector` → `scopedEstablishments`), puis filtrée localement (recherche,
ville/quartier/catégorie/source) sans nouvel appel réseau — un seul aller-retour API au chargement,
tout le reste est calculé côté client (`useMemo`).

`/api/specialites` est chargé séparément, à l'intérieur de `ScoringSection`/
`BusinessPlanGenerator` (pas dans `App.tsx`), pour alimenter le module de scoring et les
générateurs de business plan avec les poids/coûts définis en base (éditables depuis Directus).

Le **`ChatbotWidget`** est un mock : les réponses sont des chaînes codées en dur, choisies par
correspondance de mots-clés dans le message de l'utilisateur (`ChatbotWidget.tsx:42-52`) — malgré
la présence de `GEMINI_API_KEY` dans `.env` (résidu du template AI Studio d'origine), **aucun appel
à une API IA n'est fait dans le code actuel**.

## 5. Scrapers Python

- `scraper_etablissements.py` : générique, piloté par un dict `SPECIALITES_CONFIG` (requête
  Google Places, mots inclus/exclus, types requis) — la même logique de filtrage que
  `server/extraction.ts` et la table `specialite_extraction`, mais en **standalone**, écrivant
  vers des fichiers `.xlsx` plutôt que directement en base. Lit `DATABASE_URL_LOCAL` en **lecture
  seule** (jamais Supabase, jamais d'écriture — commentaire explicite dans le fichier) pour
  récupérer les centroïdes de zones.
- `scraper_ophtalmo.py` : version antérieure spécifique à l'ophtalmologie, probablement remplacée
  par la version générique ci-dessus (à confirmer avant suppression).
- `scraper_immo.py` : fichier vide, non implémenté.
- Ces scripts sont **indépendants du flux applicatif** : ils produisent des `.xlsx` (gitignorés,
  `*.xlsx` dans `.gitignore`) qui ne sont consommés par aucun script `npm run db:seed*` — à
  importer manuellement si besoin. Le flux d'extraction *en production* passe par
  `server/extraction.ts` (déclenché depuis Directus), pas par ces scripts.

Pas de `requirements.txt` dans le repo — dépendances Python (`googlemaps`, `pandas`, `psycopg2`,
`python-dotenv`) à installer manuellement.

## 6. Environnements & déploiement

| Environnement | Frontend + API | Base de données | Directus |
|---|---|---|---|
| **Local (dev)** | Vite (`5174`) + Express (`4000`) via `npm run dev` | Docker `medimplant-postgres` (port `5433`) | Docker `medimplant-directus` (port `8055`) |
| **Production** | **Vercel** (build Vite + fonctions `api/`) | **Supabase** (Postgres managé) | **Render** (config hors repo, dans le dashboard Render) |

Pas de pipeline CI/CD versionné : le déploiement Vercel/Render se fait vraisemblablement par
intégration Git directe (push → déploiement automatique) ou déclenchement manuel depuis leurs
dashboards respectifs — à confirmer selon la config réelle des projets Vercel/Render.

## 7. Démarrer le projet en local

```
npm install
cp .env.example .env   # puis compléter DIRECTUS_KEY/SECRET, GOOGLE_PLACES_API_KEY, etc.
docker compose up -d   # Postgres+PostGIS + Directus
npm run db:migrate
npm run db:seed
npm run dev             # Vite (5174) + API Express (4000) en parallèle
```

Détails complets (variables requises, pièges connus) : voir la checklist donnée en cours de
conversation, à terme à formaliser dans un `README.md` dédié si besoin.

## 8. Points d'attention généraux

- **`README.md` à la racine est un résidu du template AI Studio** ("Run and deploy your AI Studio
  app") — ne décrit ni Docker, ni Directus, ni la base de données ; à mettre à jour ou remplacer
  par un renvoi vers `docs/`.
- **`GEMINI_API_KEY`/`APP_URL`** dans `.env`/`.env.example` ne sont utilisés par aucun code actuel
  (vérifié par recherche dans `src/`, `server/`, `api/`) — résidus du template, sans effet sur le
  fonctionnement réel de l'app.
- **Workflow de publication `statut`** (voir DATABASE.md §6) : central à comprendre avant de
  toucher à n'importe quel script d'insertion de données — piège déjà rencontré deux fois pendant
  le développement (colonnes de scoring désynchronisées après migration, puis données de seed
  invisibles faute de publication).
- **Deux implémentations de la logique d'extraction Google Places** qui doivent rester
  cohérentes : `server/extraction.ts` (prod, écrit en base) et `scraper_etablissements.py`
  (standalone, écrit en `.xlsx`) — même filtrage conceptuel, dupliqué dans deux langages.
- **Le seed reproduit les données de référence, pas le contenu édité via Directus.** Un clone
  frais + `npm run db:seed` donne la même base "de départ" à tout le monde (schéma + données
  codées dans `src/data`/`src/config`), mais tout ce qui a été ajouté ou modifié depuis l'admin
  Directus (établissements extraits et publiés, statuts, poids de scoring ajustés à la main) reste
  propre à chaque base locale — et un `db:seed` relancé l'écrase (`TRUNCATE` avant réinsertion).
