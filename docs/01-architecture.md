# 1. Architecture générale

## Stack technique

| Brique | Choix | Package(s) |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | `next`, `react`, `react-dom` |
| Style | Tailwind CSS v4 | `tailwindcss`, `@tailwindcss/postcss` |
| PWA | Serwist (successeur de next-pwa) | `@serwist/next`, `serwist` |
| Base de données | Neon Postgres | — |
| Accès données client | Neon Data API (compatible PostgREST) | `@neondatabase/postgrest-js` |
| Auth | Neon Managed Better Auth | `@neondatabase/auth`, `@neondatabase/neon-js` |
| Stockage couvertures | Neon Object Storage (S3-compatible) | `@aws-sdk/client-s3` |
| Traitement image | Resize/compression WebP côté serveur | `sharp` |
| Scan code-barres | Lecture EAN-13 via caméra | `@zxing/browser`, `@zxing/library` |
| Parsing XML (BnF) | UNIMARC / SRU | `fast-xml-parser` |
| Icônes | `lucide-react` |

Le projet est un pilote pour valider la stack Neon (Data API + Auth + Storage, toutes en
beta au moment de l'écriture) en remplacement de Supabase, dont les deux projets gratuits
de l'utilisateur étaient déjà consommés par d'autres applications.

## Next.js 16 : particularités

- **App Router uniquement**, pas de Pages Router.
- **`proxy.ts`** remplace `middleware.ts` (renommage Next 16 — "Proxy" remplace
  "Middleware"). Tourne toujours en runtime Node.js (nécessaire pour `jose`, utilisé par
  le middleware Neon Auth, qui a besoin de `CompressionStream`/`process.cwd`) ; l'option
  `runtime` n'existe plus sur ce fichier et lève une erreur si elle est présente.
- **Build de production obligatoirement en webpack** (`next build --webpack`) : le plugin
  webpack de Serwist ne supporte pas encore Turbopack. `next.config.ts` désactive Serwist
  hors production (`disable: process.env.NODE_ENV !== "production"`) pour que `next dev`
  (Turbopack) n'essaie jamais de charger ce plugin.
- **HTTPS obligatoire même en local** : Managed Better Auth pose son cookie de session
  avec l'attribut `Secure`, refusé par les navigateurs sur `http://localhost`. Le script
  `dev` lance donc `next dev --experimental-https` avec un certificat auto-signé dans
  `certificates/` (généré via `openssl`, jamais commité — voir `.gitignore`).
- Le fichier `AGENTS.md` (racine du repo, chargé par `CLAUDE.md`) rappelle que ce Next.js
  peut différer du Next.js connu et renvoie vers `node_modules/next/dist/docs/` — ce
  bloc est régénéré automatiquement par `next dev`, il doit être commité tel quel.

## Structure des dossiers

```
mabedetheque/
├── app/                          # App Router : pages + routes API
│   ├── layout.tsx                # layout racine (fonts, PWA updater, thème manifest)
│   ├── page.tsx                  # onglet Albums (galerie/liste)
│   ├── sw.ts                     # source du service worker (compilé par Serwist)
│   ├── login/page.tsx            # connexion (email/mot de passe)
│   ├── series/page.tsx           # onglet Séries
│   ├── wishlist/page.tsx         # onglet Achats
│   ├── vente/page.tsx            # onglet Ventes
│   ├── ideas/page.tsx            # onglet Idées
│   ├── stats/page.tsx            # onglet Stats
│   ├── albums/new/page.tsx       # ajout d'un album
│   ├── albums/[id]/edit/page.tsx # édition/suppression/statut vente d'un album
│   └── api/
│       ├── auth/[...path]/route.ts   # handler Better Auth (GET/POST)
│       ├── covers/route.ts           # upload/traitement/suppression de couverture
│       ├── isbn/[isbn]/route.ts      # lookup métadonnées + couverture par ISBN
│       ├── series-search/route.ts    # recherche BnF de tous les tomes d'une série
│       └── text-search/route.ts      # recherche BnF libre par titre/série
├── components/                   # composants UI et logique client réutilisables
│   ├── AppHeader.tsx / AppTabs / BottomNav / navTabs.ts  # navigation (desktop + mobile)
│   ├── ConfirmDialog.tsx         # boîte de confirmation unique de l'app
│   └── Toast.tsx                 # ToastProvider + useToast (notifications éphémères)
├── hooks/                        # hooks React partagés (useAlbums, useSession)
├── lib/                          # clients Neon, logique métier ISBN/BnF, constantes
│   ├── auth/server.ts            # instance serveur Neon Auth (singleton)
│   └── format.ts                 # formatage de date fr-FR (formatDate/formatDateTime)
├── types/                        # types partagés (Album, Idea, WishlistItem, Database)
├── db/migrations/                # schéma SQL versionné, à exécuter manuellement sur Neon
├── scripts/                      # scripts one-off (import CSV, génération d'icônes...)
├── public/                       # manifest PWA, icônes
├── certificates/                 # certificat HTTPS auto-signé pour le dev local (non commité)
├── proxy.ts                      # protection des routes (ex-middleware.ts)
└── next.config.ts                # config Next + Serwist
```

## Flux de données

Toute la donnée transite exclusivement par le **Neon Data API**, jamais par une connexion
Postgres directe depuis le code applicatif (`NEON_DATABASE_URL` ne sert qu'aux migrations
manuelles/scripts one-off). Deux clients distincts, tous deux définis dans
`lib/neon-client.ts` :

- **`getNeonClient()`** — client d'authentification uniquement (connexion, déconnexion),
  pointé sur le mount local `/api/auth` (et non l'hôte Neon Auth directement) afin que le
  cookie de session soit posé sur le domaine de l'app.
- **`getDataClient()`** — client Data API (`NeonPostgrestClient`, syntaxe identique à
  `supabase-js` : `.from(table).select()/.insert()/.update()/.delete()`). Chaque requête va
  chercher elle-même un token via `/api/auth/token` (voir
  [03-authentification.md](./03-authentification.md) pour le pourquoi).

Chaque page/onglet appelle directement `getDataClient()` (ou le hook `useAlbums()` pour la
table `albums`) ; il n'y a pas de couche "API interne" pour le CRUD — les seules routes API
internes (`app/api/*`) gèrent l'auth, l'upload de couverture et les recherches externes
(BnF/ISBN), c'est-à-dire tout ce qui doit rester côté serveur (secrets, clés, traitement
d'image).

## Sécurité des données : Row Level Security

Chaque table applicative (`albums`, `wishlist_items`, `ideas`) a une colonne `owner_id`
et est protégée par des policies RLS Postgres comparant `owner_id` au `auth.user_id()` de
la requête (dérivé du JWT émis par Managed Better Auth). Voir
[02-donnees.md](./02-donnees.md) pour le détail et un piège de syntaxe important.

## Thème visuel

Palette jaune/noir constante dans toute l'app : accent `#FACC15` (jaune), fond clair
`zinc-50`/blanc, fond sombre `black`/`zinc-950`, bordures `black/10` ou `white/10` selon
le thème. `theme-color` du manifest suit le `prefers-color-scheme` (`#FACC15` en clair,
`#111111` en sombre — voir [08-pwa.md](./08-pwa.md)).
