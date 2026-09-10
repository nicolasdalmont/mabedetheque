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
  runtimeCaching: defaultCache,
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
- `runtimeCaching: defaultCache` — stratégie de cache par défaut fournie par
  `@serwist/next/worker`.
- **`setCatchHandler`** : les stratégies de `defaultCache` rejettent le `FetchEvent`
  quand elles ne peuvent produire de réponse (hors ligne sans cache, ou requête réseau
  échouée — timeout BnF…), ce qui fait logger `FetchEvent.respondWith received an error:
  no-response` par Chrome pour **chaque** requête concernée. Le catch handler renvoie une
  réponse concrète (document en cache pour une navigation, `503` vide sinon) — l'app et
  `OfflineBanner` gèrent déjà une requête en échec.

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
