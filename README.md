# Ma Bédéthèque

PWA de gestion d'une collection personnelle de bandes dessinées : recherche automatisée par
ISBN (BnF, Google Books, Open Library), galerie/liste, recherche et filtres, édition et
suppression. Voir le cahier des charges pour le détail fonctionnel.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Serwist](https://serwist.pages.dev) pour la PWA (installabilité, service worker)
- [Neon](https://neon.tech) : Postgres + Data API (compatible PostgREST) + Managed Better Auth +
  Object Storage (S3-compatible) — voir [`SETUP.md`](./SETUP.md) pour le branchement complet.

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis suivre SETUP.md pour remplir les valeurs
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — serveur de développement (Turbopack).
- `npm run build` — build de production (`--webpack`, requis par Serwist).
- `npm run lint` — ESLint.

## Structure

- `app/` — pages et routes API (App Router).
- `lib/` — clients Neon (Data API, Auth, Object Storage) et logique de recherche ISBN.
- `components/`, `hooks/` — UI et logique client.
- `db/migrations/` — schéma SQL (table `albums`, RLS) à exécuter sur le projet Neon.
- `types/album.ts` — types partagés (album, base de données pour le client Data API).
