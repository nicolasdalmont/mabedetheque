# Documentation technique — Ma Bédéthèque

Cette documentation décrit l'ensemble des éléments constitutifs de l'application, à
l'usage de quiconque doit la reprendre, la maintenir ou l'étendre.

## Sommaire

1. [Architecture générale](./01-architecture.md) — stack, structure des dossiers, flux de données
2. [Modèle de données](./02-donnees.md) — tables, migrations, RLS
3. [Authentification](./03-authentification.md) — Neon Managed Better Auth, session, proxy
4. [Recherche ISBN / BnF](./04-recherche-isbn-bnf.md) — providers, UNIMARC, séries, texte libre
5. [Stockage des couvertures](./05-stockage-couvertures.md) — Object Storage, traitement d'image
6. [Pages et fonctionnalités](./06-pages-et-fonctionnalites.md) — tour de chaque onglet/écran
7. [Composants et hooks](./07-composants-et-hooks.md) — référence des composants partagés
8. [PWA](./08-pwa.md) — Serwist, manifest, mise à jour, icônes
9. [Configuration et déploiement](./09-configuration-et-deploiement.md) — env, scripts, build, Vercel

## Résumé en une page

**Ma Bédéthèque** est une PWA (Next.js 16 / React 19 / TypeScript) de gestion d'une
collection personnelle de bandes dessinées, mono-utilisateur (au sens : chaque compte ne
voit que ses propres données, via RLS Postgres — rien n'empêche plusieurs comptes).

- **Backend** : [Neon](https://neon.tech) (Postgres serverless) via trois briques beta :
  - **Data API** (compatible PostgREST) pour toutes les opérations CRUD depuis le client ;
  - **Managed Better Auth** pour l'authentification email/mot de passe ;
  - **Object Storage** (S3-compatible) pour les couvertures d'albums.
- **Recherche automatique des métadonnées** : catalogue SRU de la BnF (UNIMARC), avec
  repli sur Google Books / Open Library pour la couverture.
- **PWA** : installable, service worker (Serwist), icônes clair/sombre.
- **6 onglets** : Albums, Séries, Achats, Ventes, Idées, Stats.

Toute la donnée applicative vit dans 3 tables Postgres (`albums`, `wishlist_items`,
`ideas`), chacune protégée par Row Level Security sur `owner_id`.
