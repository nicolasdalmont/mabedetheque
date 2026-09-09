# 9. Configuration et déploiement

## Variables d'environnement (`.env.example`)

```bash
# --- Neon Postgres ---
# Connexion directe, uniquement pour les migrations locales (psql) ou scripts one-off.
# Jamais lue par l'app au runtime (le Data API est la seule voie d'accès aux données).
NEON_DATABASE_URL=

# --- Neon Data API ---
NEXT_PUBLIC_NEON_DATA_API_URL=

# --- Neon Managed Better Auth ---
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=          # min. 32 caractères — openssl rand -base64 32

# --- Neon Object Storage ---
NEON_STORAGE_ENDPOINT=
NEON_STORAGE_REGION=
NEON_STORAGE_ACCESS_KEY_ID=
NEON_STORAGE_SECRET_ACCESS_KEY=
NEON_STORAGE_BUCKET=mabedetheque-covers
```

Optionnelle et non listée dans `.env.example` : `GOOGLE_BOOKS_API_KEY` (relève le quota
Google Books par IP — sans elle, repli automatique sur Open Library, voir
[04](./04-recherche-isbn-bnf.md)).

`NEXT_PUBLIC_NEON_DATA_API_URL` est la seule variable exposée au client (préfixe
`NEXT_PUBLIC_`) — toutes les autres (secrets Auth, credentials Object Storage) ne sont
utilisées que côté serveur (routes API, `proxy.ts`).

## Provisionnement Neon (étapes manuelles, détaillées dans `SETUP.md`)

Ces trois briques Neon sont en **beta** au moment de l'écriture (comportement susceptible
d'évoluer) :

1. **Base de données** — créer le projet Neon, exécuter `db/migrations/0001_init.sql`
   (puis les migrations suivantes dans l'ordre) via l'éditeur SQL du dashboard ou `psql`.
2. **Data API** — Postgres database → Data API → provider "Managed Better Auth" → activer
   → copier l'URL dans `NEXT_PUBLIC_NEON_DATA_API_URL`.
3. **Auth** — Branch → Auth → activer → copier la Base URL
   (`NEON_AUTH_BASE_URL`) → générer un secret de session (`NEON_AUTH_COOKIE_SECRET`).
4. **Object Storage** — activer, créer un bucket `mabedetheque-covers` en accès
   `public_read`, générer un credential (access key / secret key) pour la branche.
   Disponible uniquement sur AWS US East (Ohio) et AWS Europe (Frankfurt) au moment de
   l'écriture.
5. Remplir `.env.local` (copié depuis `.env.example`).
6. Créer le compte utilisateur (email/mot de passe) via le dashboard Neon ou `/login` si un
   flux d'inscription est exposé — variable selon l'état de la beta.

## Scripts npm (`package.json`)

```json
"dev":   "next dev --experimental-https --experimental-https-key ./certificates/localhost-key.pem --experimental-https-cert ./certificates/localhost.pem",
"build": "next build --webpack",
"start": "next start",
"lint":  "eslint"
```

- **`npm run dev`** — serveur de développement Turbopack, HTTPS local obligatoire (voir
  [08-pwa.md](./08-pwa.md)), service worker désactivé.
- **`npm run build`** — **toujours avec `--webpack`**, requis par le plugin Serwist (pas
  encore compatible Turbopack). C'est la commande utilisée avant tout déploiement.
- **`npm run lint`** — ESLint (config `eslint.config.mjs`, base `eslint-config-next`).

Workflow standard avant tout push : `npm run lint` puis `npm run build --webpack`, tous
deux sans erreur, avant de committer et déployer.

## Scripts one-off (`scripts/`)

- **`scripts/db/`** — outils liés à l'import initial de la collection depuis un export CSV
  externe (`prepare-import.py`, `run-import.mjs`) et à la correction en masse de
  couvertures (`retry-covers.mjs`). Utilisent `NEON_DATABASE_URL` en connexion directe,
  hors du chemin applicatif normal (Data API).
- **`scripts/generate-icons.mjs`** — génère les différentes tailles/variantes d'icônes
  PWA (`public/icons/`) à partir des sources vectorielles `scripts/icon-source.svg` /
  `scripts/icon-source-dark.svg`.

## Déploiement

Hébergement Vercel (repo GitHub `nicolasdalmont/mabedetheque`, déploiement automatique sur
push vers `main`). Le workflow de vérification établi pour ce projet :

1. `npm run lint` et `npm run build --webpack` en local, sans erreur.
2. Commit avec message technique explicite (français, explique la cause racine pas
   seulement le symptôme) et push sur `main`.
3. Confirmation du déploiement via l'API de statut de commit GitHub
   (`api.github.com/repos/nicolasdalmont/mabedetheque/commits/{sha}/status`), pas
   directement l'API Vercel.

Les variables d'environnement listées ci-dessus doivent être répliquées dans la
configuration du projet Vercel (elles ne sont jamais commitées — `.env.local` est dans
`.gitignore`).

## Certificats locaux (`certificates/`)

Générés via `openssl` pour le HTTPS local, jamais commités (`.gitignore`). À régénérer si
absents — voir `SETUP.md`/[08-pwa.md](./08-pwa.md) pour la procédure et la raison de leur
nécessité.

## `AGENTS.md` / `CLAUDE.md`

`CLAUDE.md` (racine) inclut `AGENTS.md`, qui prévient que ce Next.js peut différer du
Next.js connu par un outil d'assistance IA et renvoie vers la documentation locale
(`node_modules/next/dist/docs/`). Ce fichier est **régénéré automatiquement par
`next dev`** — le committer tel quel (ne pas le retirer d'un diff) garde l'arbre propre.
