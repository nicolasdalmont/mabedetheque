# 8. PWA

L'app est installable (Progressive Web App) via [Serwist](https://serwist.pages.dev),
successeur maintenu de `next-pwa` avec support App Router.

## Service worker (`app/sw.ts` → `public/sw.js`)

```ts
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    /* règles dédiées, voir plus bas */
    ...defaultCache,
  ],
});

serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
  }
  return new Response(null, { status: 503, statusText: "Hors ligne" });
});

serwist.addEventListeners();
```

- `skipWaiting` + `clientsClaim` : un nouveau service worker prend le contrôle
  immédiatement dès qu'il est activé, sans attendre la fermeture de tous les onglets —
  nécessaire pour que la logique de mise à jour forcée (`AppUpdater`) fonctionne (voir
  plus bas).
- `runtimeCaching` — trois règles dédiées (voir "Hors ligne : cache des données"
  ci-dessous), placées **avant** `defaultCache` (`@serwist/next/worker`) dont elles
  outrepassent les règles génériques par ordre de déclaration (Serwist prend la première
  règle qui matche).
- **`setCatchHandler`** : les stratégies de `defaultCache` rejettent le `FetchEvent`
  quand elles ne peuvent produire de réponse (hors ligne sans cache, ou requête réseau
  échouée — timeout BnF…), ce qui fait logger `FetchEvent.respondWith received an error:
  no-response` par Chrome pour **chaque** requête concernée. Le catch handler renvoie une
  réponse concrète (document en cache pour une navigation, `503` vide sinon) — l'app et
  `OfflineBanner` gèrent déjà une requête en échec.

### Hors ligne : cache des données (token, Data API, couvertures)

`defaultCache` seul rendait l'app quasi inutilisable hors ligne au-delà d'une heure sans
réseau, pour deux raisons :

1. **`/api/auth/token`** tombe dans la règle générale `/api/auth/.*` de `defaultCache`
   (`NetworkOnly`, volontaire — voir
   [serwist/serwist#28](https://github.com/serwist/serwist/discussions/28) pour éviter de
   mettre en cache le callback d'auth). Or `getDataClient()` (`lib/neon-client.ts`)
   récupère ce token **avant** chaque appel au Data API, et `fetchWithToken` lève une
   erreur si ce fetch échoue — sans jamais émettre la requête Data API elle-même. Hors
   ligne, plus aucune donnée ne pouvait donc être servie, même si elle était par ailleurs
   en cache.
2. **Les appels au Data API Neon** (`NEXT_PUBLIC_NEON_DATA_API_URL`, cross-origin)
   tombaient, faute de règle dédiée, dans le cache cross-origin générique de
   `defaultCache` : 1h de validité, 32 entrées partagées avec toute autre requête
   cross-origin (dont les couvertures, si elles ne matchaient pas déjà la règle image de
   `defaultCache`).

Trois règles, ajoutées en tête de `runtimeCaching` :

| Cache | Requêtes | Stratégie | Rétention |
|---|---|---|---|
| `auth-token` | `GET /api/auth/token` (same-origin) | `NetworkFirst` | 1 entrée, 30 jours |
| `album-covers` | images cross-origin (Neon Object Storage) | `CacheFirst` | 1000 entrées, 90 jours (`last-used`) |
| `neon-data-api` | `GET` cross-origin non-image (Data API) | `NetworkFirst`, timeout 8s | 64 entrées, 30 jours (`last-used`) |

- **`auth-token`** : un token périmé suffit — hors ligne, l'appel Data API qu'il débloque
  est lui-même servi depuis le cache `neon-data-api`, jamais réellement vérifié par Neon.
  Le but est seulement de ne pas laisser `fetchWithToken` lever une exception avant que la
  requête de données ait une chance d'être tentée.
- **`album-covers`** : `CacheFirst` (pas de revalidation réseau) car les couvertures sont
  immuables — un remplacement de couverture change d'URL (nouvel UUID, voir
  `lib/storage.ts`), il n'y a donc jamais de contenu à rafraîchir sous une même URL. 1000
  entrées pour couvrir toute la collection sans éviction prématurée.
- **`neon-data-api`** : `NetworkFirst` — privilégie toujours la donnée fraîche quand le
  réseau répond, ne retombe sur le cache qu'en cas d'échec réseau (ou timeout > 8s). 30
  jours de rétention pour survivre à plusieurs jours sans connexion.

Le matcher distingue image vs. non-image (`request.destination === "image"`) plutôt que de
cibler une extension ou un hostname : il n'y a que deux familles de requêtes cross-origin
dans l'app (Data API JSON, couvertures Object Storage), donc pas besoin de connaître
l'URL exacte du Data API — utile pour que la règle reste valable quel que soit
l'environnement (`NEXT_PUBLIC_NEON_DATA_API_URL` diffère entre local/prod).

Généré uniquement au **build de production** (`next build --webpack`) : `next.config.ts`
désactive explicitement le plugin Serwist hors production
(`disable: process.env.NODE_ENV !== "production"`), car son plugin webpack n'est pas
compatible avec Turbopack, utilisé par `next dev`.

```ts
// next.config.ts
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});
```

## Mise à jour forcée — `AppUpdater` (`components/AppUpdater.tsx`)

Une PWA ajoutée à l'écran d'accueil reprend souvent son exécution sans rechargement
complet après avoir été mise en arrière-plan ; la vérification de mise à jour "lazy" du
navigateur peut donc tarder à se déclencher. `AppUpdater`, monté dans `app/layout.tsx` :
- Appelle `registration.update()` au montage, puis à chaque reprise de focus
  (`visibilitychange` visible + `focus`).
- Écoute `controllerchange` sur `navigator.serviceWorker` et recharge la page une seule
  fois (`reloading` flag) dès qu'un nouveau worker prend le contrôle — combiné à
  `skipWaiting`/`clientsClaim` côté worker, l'utilisateur voit la nouvelle version sans
  action manuelle.

## Manifest (`public/manifest.json`)

```json
{
  "name": "Ma Bédéthèque",
  "short_name": "Bédéthèque",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FACC15",
  "theme_color": "#FACC15",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Un `manifest-dark.json` existe en parallèle (mêmes icônes, variante de couleurs) — voir
ci-dessous pour comment/quand il est utilisé.

## Icône clair/sombre — deux mécanismes best-effort distincts

Le Web App Manifest n'a **aucune notion standard** de variante d'icône par thème clair/sombre
— deux contournements best-effort sont appliqués, chacun avec ses limites documentées en
commentaire dans le code :

1. **iOS / Safari** — `app/layout.tsx` déclare deux icônes Apple Touch via des media
   queries dans les `Metadata` Next :
   ```ts
   apple: [
     { url: "/icons/apple-touch-icon.png", media: "(prefers-color-scheme: light)" },
     { url: "/icons/apple-touch-icon-dark.png", media: "(prefers-color-scheme: dark)" },
   ],
   ```
   Le support réel de Safari pour ce mécanisme sur une icône **déjà installée** est
   non documenté/incohérent ; cela n'affecte au mieux que l'icône au moment précis où
   l'utilisateur fait "Ajouter à l'écran d'accueil", jamais rétroactivement si le thème
   système change ensuite.

2. **Android / Chrome** — `ManifestThemeSwitcher` (composant client, monté dans le
   layout racine) réécrit dynamiquement le `href` du `<link rel="manifest">` vers
   `/manifest-dark.json` si `prefers-color-scheme: dark` au montage. Dépend entièrement de
   si Chrome relit le manifest après cette réécriture au moment où il évalue "Ajouter à
   l'écran d'accueil" — non garanti non plus, et une icône déjà ajoutée ne change pas si
   le thème système change après coup.

`themeColor` (couleur de la barre de navigateur/système), lui, est un vrai média Next
standard et fonctionne de façon fiable :
```ts
export const viewport: Viewport = {
  themeColor: [
    { color: "#FACC15", media: "(prefers-color-scheme: light)" },
    { color: "#111111", media: "(prefers-color-scheme: dark)" },
  ],
};
```

## HTTPS en développement local

Managed Better Auth pose son cookie de session avec l'attribut `Secure`, refusé par tout
navigateur sur `http://localhost`. `npm run dev` lance donc `next dev` avec
`--experimental-https` et un certificat auto-signé dans `certificates/` (généré via
`openssl`, jamais commité — voir `.gitignore`). Premier accès : accepter l'avertissement
de sécurité du navigateur ("Avancé" → "Continuer vers localhost").

C'est aussi pour cette raison que le navigateur sandboxé utilisé pour les vérifications
visuelles pendant le développement de cette app ne peut pas atteindre le vrai serveur de
dev (certificat auto-signé non approuvé) ni la production (authentification requise) — les
changements CSS/layout sont vérifiés via une maquette HTML statique équivalente servie en
local (`python3 -m http.server`) plutôt que l'app réelle.

## Piège : contraste du glyphe sur l'icône sombre à l'écran d'accueil iOS

`scripts/icon-source-dark.svg` (fond → `apple-touch-icon-dark.png` / `icon-*-dark.png` via
`scripts/generate-icons.mjs`) doit dessiner le glyphe en **aplat plein**, pas en simple
contour fin (`stroke` sans `fill`). Le rendu noir/teinté automatique qu'iOS applique aux
icônes d'écran d'accueil (Réglages → Écran d'accueil → Apparence des icônes) garde lisibles
les formes pleines à gros aplat (cf. les icônes tierces qui passent bien ce traitement) mais
délave les traits fins sur fond sombre jusqu'à les rendre quasi invisibles. Le glyphe actuel
est donc une bulle BD remplie en blanc (`fill="#FFFFFF"`) avec le `#` en creux noir
(traits `stroke="#111111"` par-dessus), plutôt qu'une bulle en contour blanc avec un `#` en
traits blancs comme la variante claire (qui, elle, reste lisible car fond jaune/noir déjà
très contrasté nativement).

## Piège : cache du service worker sur les icônes (`/icons/*`)

La règle par défaut de Serwist pour les images (`defaultCache`, voir `app/sw.ts`) matche
toute extension `.png` en `StaleWhileRevalidate` : elle répond instantanément avec la
réponse déjà en cache et ne rafraîchit qu'en tâche de fond. Pour la plupart des images
(couvertures) c'est le comportement voulu, mais pour les icônes d'app c'est un piège — un
correctif visuel sur une icône peut sembler ne jamais arriver sur un appareil qui l'avait
déjà chargée une fois, **y compris après avoir supprimé puis recollé le raccourci à l'écran
d'accueil** : ce raccourci n'a aucun lien avec le Cache Storage du service worker, qui est
une donnée de site rattachée à l'origine et persiste indépendamment.

`app/sw.ts` déclare donc une règle dédiée pour `/icons/*` **avant** `...defaultCache` (les
règles sont évaluées dans l'ordre, la première qui matche gagne), en `NetworkFirst` plutôt
que `StaleWhileRevalidate` : le réseau est toujours tenté en premier, le cache ne sert que
de repli hors ligne. En cas de doute sur un appareil déjà utilisé avant ce correctif, la
mise à jour du service worker (voir `AppUpdater`) suffit à corriger le comportement pour les
requêtes suivantes — pas besoin de purge manuelle.
