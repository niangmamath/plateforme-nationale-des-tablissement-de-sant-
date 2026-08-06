# Backend — Documentation

Ce document décrit la couche API du projet : structure, endpoints, flux métier (extraction
automatisée) et déploiement. Complémentaire à [DATABASE.md](DATABASE.md) pour tout ce qui touche
au schéma/à la donnée. Source de vérité : `server/`, `api/`, `vite.config.ts`.

## 1. Vue d'ensemble

Le backend existe en **deux surfaces qui partagent la même logique métier** :

| Surface | Utilisée pour | Runtime | Entrée |
|---|---|---|---|
| `server/` (Express) | Dev local | Process Node long-vivant (`tsx watch server/index.ts`), port `4000` | `server/index.ts` |
| `api/` (fonctions Vercel) | Production | Serverless, une fonction par fichier (convention Vercel) | `api/pays.ts`, `api/etablissements.ts`, `api/specialites.ts` |

Les deux surfaces **importent les mêmes fonctions** de `server/queries.ts` (et
`server/extraction.ts` pour l'extraction) — aucune logique dupliquée, seule la façon de les
exposer (route Express vs handler serverless) diffère. Pas d'ORM, pas de couche service
supplémentaire : les handlers appellent directement les fonctions qui font le SQL.

Pas de `cors` ni de middleware d'authentification/rate-limiting installés (`package.json` ne liste
que `express`, `pg`, `dotenv` côté runtime) : en dev, le frontend appelle l'API en même origine via
le proxy Vite ; en prod (Vercel), frontend et fonctions API sont servis depuis le même domaine.

## 2. Structure des fichiers

```
server/
  index.ts       # Serveur Express (dev local) — déclare les routes
  db.ts          # Pool pg partagé (process long-vivant)
  queries.ts     # 3 fonctions de lecture (pays, établissements, spécialités) — partagées avec api/
  extraction.ts  # Logique métier de l'extraction Google Places → insertion en base

api/
  _lib/db.ts     # Pool pg dédié au serverless (max: 3, réutilisé entre invocations "chaudes")
  pays.ts               # GET  /api/pays              → getPays(getPool())
  etablissements.ts     # GET  /api/etablissements     → getEtablissements(getPool())
  specialites.ts        # GET  /api/specialites        → getSpecialites(getPool())
  admin/extraction.ts   # POST /api/admin/extraction   → extraireEtInserer(...), protégé par secret partagé
```

`api/*.ts` importe `server/queries.ts` avec des **extensions `.js` explicites**
(`from '../server/queries.js'`) : requis car le projet est en ESM (`"type": "module"` dans
`package.json`) — TypeScript ne réécrit pas les extensions, donc on écrit directement l'extension
de sortie attendue.

## 3. `server/index.ts` — serveur de dev

Express, `express.json()` comme unique middleware, port `process.env.API_PORT ?? 4000`.

| Méthode | Route | Handler | Description |
|---|---|---|---|
| GET | `/api/pays` | `getPays(pool)` | Pays → villes → zones (imbriqué), filtré `statut = 'publie'` |
| GET | `/api/etablissements` | `getEtablissements(pool)` | Liste plate des établissements publiés |
| GET | `/api/specialites` | `getSpecialites(pool)` | Spécialités + leurs aménagements/effectifs/machines/actes |
| POST | `/api/admin/extraction` | `extraireEtInserer(pool, ...)` | Déclenche une extraction Google Places (voir §5) |

`vite.config.ts` proxy `/api` vers `http://localhost:4000` (ou `API_URL` si défini) — c'est ce qui
permet au frontend (port `5174`) d'appeler `/api/...` en relatif sans souci de CORS en dev.

## 4. `server/queries.ts` — lectures publiques

Trois fonctions, toutes `async (pool: Pool) => rows`, toutes filtrées `WHERE statut = 'publie'`
(voir [DATABASE.md §6](DATABASE.md#6-workflow-de-publication-statut)) :

- **`getEtablissements`** — `SELECT` direct sur `etablissements`, colonnes renommées en camelCase
  côté SQL (`place_id AS "placeId"`).
- **`getPays`** — 3 requêtes séparées (`pays`, `villes`, `zones`), puis assemblage en mémoire
  (`.map`/`.filter`) en structure imbriquée `pays → villes → zones`. Les valeurs `numeric` de
  Postgres (retournées en string par `pg`) sont explicitement converties en `Number` (`prixM2`,
  `loyerM2`, `pop15_59`, `pop60_plus`, `densite`).
- **`getSpecialites`** — même pattern : `specialites` + 4 requêtes filles, assemblées par
  `specialiteId`. Reconstruit un objet `poids: { prix, population, densite, pop1559, pop60plus,
  concurrence }` à partir des colonnes `poids_*` (voir migration 012/013).

C'est le **point unique** à modifier si le filtre de publication ou la forme des données exposées
change — les deux surfaces (`server/index.ts` et `api/*.ts`) en dépendent.

## 5. `server/extraction.ts` — extraction automatisée

Fonction principale : `extraireEtInserer(pool, specialite, pays, ville)`, appelée depuis
`POST /api/admin/extraction` (déclenché par un **Flow Directus**, formulaire pays/ville/spécialité
côté admin). Nécessite `GOOGLE_PLACES_API_KEY` (sinon lève une erreur explicite).

Déroulé :

1. Charge en parallèle (`Promise.all`) :
   - la config de recherche pour la spécialité demandée (table `specialite_extraction` —
     requête Google, mots inclus/exclus, types Google requis) ;
   - les centroïdes de zones publiées pour le couple pays/ville (clé composite
     `pays::ville` en minuscules, car deux pays peuvent avoir une ville homonyme) ;
   - l'ensemble des `place_id` déjà en base (dédoublonnage) ;
   - le prochain numéro disponible pour l'id `etab-N` (les établissements extraits suivent la même
     numérotation que ceux saisis à la main).
2. Erreurs explicites et actionnables si la spécialité ou la ville n'est pas configurée dans
   Directus (message qui dit quoi faire, pas juste "not found").
3. Appelle l'**API Google Places (Text Search)**, avec pagination automatique via
   `next_page_token` (délai de 2s requis par Google avant qu'un token de page suivante soit
   valide).
4. Filtre chaque résultat : exclut si un mot-clé exclu apparaît dans le nom, exige au moins un
   type Google requis ET un mot-clé inclus dans le nom. Ignore les résultats sans coordonnées.
5. Calcule l'arrondissement/quartier de chaque candidat par **plus proche voisin** (distance
   euclidienne simple sur lat/lng, pas de calcul de distance géodésique — suffisant à l'échelle
   d'une ville) parmi les centroïdes de zones chargés à l'étape 1.
6. Dédoublonne par `place_id` contre l'existant, assigne les nouveaux ids `etab-N`.
7. Insère les nouveaux établissements avec **`statut = 'brouillon'`** (volontaire — ils doivent
   être validés/publiés manuellement dans Directus) et `source = 'Google Maps (automatisé)'`,
   `ON CONFLICT (id) DO NOTHING`.
8. Retourne un résumé (`extraits`, `doublons`, `nombreNouveaux`, détail des nouveaux) — c'est ce
   JSON que Directus affiche à l'admin après un run.

## 6. `api/` — déploiement Vercel (production)

- Convention Vercel : chaque fichier de `api/` devient une route serverless du même nom
  (`api/pays.ts` → `GET /api/pays`, `api/admin/extraction.ts` → `POST /api/admin/extraction`).
  Pas de `vercel.json` dans le repo — comportement par défaut.
- `api/_lib/db.ts` crée un `Pool` avec `max: 3` (dimensionné pour le serverless : chaque instance
  de fonction ne doit pas ouvrir trop de connexions ; le pool est mémoïsé au niveau module pour
  être réutilisé entre invocations d'une même instance "chaude").
- `api/admin/extraction.ts` porte la même route que `server/index.ts` (dev) vers le serverless,
  **avec une protection que le serveur Express n'a pas** : elle exige un header
  `x-admin-secret` égal à la variable d'env `ADMIN_EXTRACTION_SECRET`, sinon `401` — et refuse par
  défaut si la variable n'est pas définie (`!secret` → non autorisé). C'est ce que le Flow Directus
  déployé en production appelle réellement pour déclencher une extraction (voir commit
  `e57b5e7`).

## 7. Variables d'environnement utilisées par le backend

| Variable | Lue par | Rôle |
|---|---|---|
| `DATABASE_URL` | `server/db.ts`, `api/_lib/db.ts`, `db/*.ts` | Connexion Postgres (voir DATABASE.md §2) |
| `API_PORT` | `server/index.ts` | Port du serveur Express en dev (défaut `4000`) |
| `API_URL` | `vite.config.ts` | Cible du proxy `/api` en dev (défaut `http://localhost:4000`) |
| `GOOGLE_PLACES_API_KEY` | `server/extraction.ts` | Requis uniquement pour `POST /api/admin/extraction` |
| `ADMIN_EXTRACTION_SECRET` | `api/admin/extraction.ts` | Secret partagé exigé en header `x-admin-secret` (prod Vercel uniquement — absent côté `server/index.ts`) |

## 8. Points d'attention

- **`server/index.ts` (dev) n'a pas la même protection que `api/admin/extraction.ts` (prod)** —
  la route Express locale ne vérifie aucun secret, contrairement à son équivalent Vercel. Sans
  conséquence tant que `server/index.ts` ne tourne qu'en local, mais à ne pas oublier si ce serveur
  Express est un jour exposé au-delà de la machine de dev.
- **Messages d'erreur bruts renvoyés au client** sur toutes les routes, y compris
  `api/admin/extraction.ts:29` : `res.status(500).json({ error: err.message })` — pratique pour le
  debug admin via Directus, mais une source d'information (structure de requêtes, noms de
  colonnes) pour qui parviendrait à déclencher une erreur, même avec le secret.
- **Comparaison du secret par égalité stricte** (`!==`), pas en temps constant — risque théorique
  de timing attack sur `ADMIN_EXTRACTION_SECRET`, impact pratique faible ici mais à corriger si la
  route devient plus sensible.
- **Distance euclidienne pour le rattachement zone/arrondissement** (`extraction.ts`) : approximation
  suffisante à l'échelle d'une ville, mais pas une vraie distance géodésique — à ne pas réutiliser
  tel quel pour des calculs à plus grande échelle.
- **Logique dupliquée entre les 2 surfaces uniquement pour le "branchement"** (route Express vs
  handler Vercel) — toute évolution des requêtes elles-mêmes se fait dans `server/queries.ts`
  uniquement, jamais à dupliquer dans `api/*.ts`.
