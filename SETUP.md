# Setup — connecter le projet à Neon

Le code est prêt mais tourne pour l'instant sur un `.env.local` avec des valeurs bidon (le
build et le rendu des pages fonctionnent, mais aucun appel réel à Neon n'aboutit). Voici les
étapes pour brancher votre vrai projet Neon.

## 1. Base de données

Le plus simple, sans rien installer : dashboard Neon → votre projet → **SQL Editor**, collez-y
le contenu de `db/migrations/0001_init.sql`, exécutez.

Si vous préférez la ligne de commande (nécessite `psql`, ex. `brew install libpq` sur Mac) :

```bash
psql "$NEON_DATABASE_URL" -f db/migrations/0001_init.sql
```

## 2. Data API

Dashboard Neon → votre projet → **Postgres database** → **Data API**.
- Auth provider : **Managed Better Auth** (fait à l'étape 3).
- Cochez "Grant public schema access" si proposé, sinon la migration a déjà posé les `GRANT`
  nécessaires.
- Cliquez **Enable Data API**.
- Copiez l'URL affichée → `NEXT_PUBLIC_NEON_DATA_API_URL`.

## 3. Auth (Managed Better Auth)

Dashboard Neon → votre projet → **Branch** → **Auth** → activer.
- Copiez la **Base URL** → `NEON_AUTH_BASE_URL`.
- Générez un secret de session (32 caractères min.) :
  ```bash
  openssl rand -base64 32
  ```
  → `NEON_AUTH_COOKIE_SECRET`.

Puis créez votre compte utilisateur (email/mot de passe) — soit via l'UI Auth du dashboard Neon
si elle propose de créer un premier utilisateur, soit en visitant `/login` une fois l'app
déployée et en s'inscrivant si un flux d'inscription est exposé par Managed Better Auth. Dites-
moi ce que vous voyez dans le dashboard à cette étape, l'inscription en beta peut varier.

## 4. Object Storage

Dashboard Neon → votre projet → **Object Storage** → activer, puis créer un bucket :
- Nom : `mabedetheque-covers` (ou adaptez `NEON_STORAGE_BUCKET`).
- Accès : **public_read** (les couvertures doivent être lisibles publiquement).
- Générez un credential (access key / secret key) pour ce bucket.

Renseignez `NEON_STORAGE_ENDPOINT`, `NEON_STORAGE_REGION`, `NEON_STORAGE_ACCESS_KEY_ID`,
`NEON_STORAGE_SECRET_ACCESS_KEY`.

## 5. `.env.local`

Copiez `.env.example` vers `.env.local` et remplissez avec les valeurs ci-dessus.

```bash
cp .env.example .env.local
```

## 6. Vérifier

```bash
npm run dev
```

Le serveur démarre en **HTTPS** sur `https://localhost:3000` (voir note ci-dessous — c'est
nécessaire, pas optionnel). Ouvrez cette URL, acceptez l'avertissement de certificat auto-signé
("Avancé" → "Continuer vers localhost"), puis testez : connexion sur `/login`, ajout d'un album
via un vrai ISBN sur `/albums/new` (recherche BnF + couverture Google Books/Open Library déjà
testées et fonctionnelles en conditions réelles pendant le développement), puis retour sur `/`
pour voir la galerie.

## Notes / limites connues à ce stade

- **Beta Neon** : Data API, Managed Better Auth et Object Storage sont en beta. Le code suit la
  documentation et les types publiés au 2026-09-04 ; un comportement différent en conditions
  réelles n'est pas à exclure — on ajustera ensemble à la première connexion.
- **Object Storage** : disponible uniquement sur AWS US East (Ohio) et AWS Europe (Frankfurt)
  pour l'instant.
- **Google Books** : l'app tente Google Books en premier pour la couverture, avec repli sur Open
  Library. Sans clé API (`GOOGLE_BOOKS_API_KEY`, optionnelle), Google impose un quota assez bas
  par IP — Open Library prend le relais automatiquement si Google échoue.
- **Scan caméra du code-barres** : pas encore implémenté, saisie manuelle de l'ISBN pour l'instant.
- **Next.js 16 / Serwist** : Serwist ne supporte pas encore Turbopack, donc `npm run build`
  utilise `--webpack` explicitement (voir `package.json`) ; `npm run dev` reste en Turbopack avec
  le service worker désactivé en dev (`disable` dans `next.config.ts`).
- **HTTPS obligatoire même en local** : Managed Better Auth pose son cookie de session avec
  l'attribut `Secure`, que les navigateurs refusent de stocker sur `http://localhost`. `npm run dev`
  lance donc le serveur avec un certificat auto-signé (`certificates/`, généré via `openssl`,
  jamais commité). Premier accès : accepter l'avertissement de sécurité dans le navigateur.
- **Client Data API séparé du client Auth** (`lib/neon-client.ts`) : le SDK unifié
  (`@neondatabase/neon-js`) est censé capturer automatiquement un JWT à la connexion via un
  header `set-auth-jwt`, mais ce déploiement de Managed Better Auth ne l'envoie pas — seul
  l'endpoint dédié `/token` en renvoie un vrai. `getDataClient()` va donc chercher ce token
  lui-même à chaque requête plutôt que de compter sur le cache interne du SDK.
