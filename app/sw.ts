/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // `defaultCache`'s blanket `/api/auth/.*` → NetworkOnly rule (there to
    // avoid caching the auth callback, see serwist/serwist#28) also covers
    // this token mint. That's fatal for offline use: `getDataClient()`
    // (lib/neon-client.ts) fetches this token *first* on every Data API
    // call, and `fetchWithToken` throws before ever issuing the actual
    // request if this fetch rejects — so with no cached token, the albums/
    // séries/etc. queries never even reach the runtime-caching rules below,
    // network or no. A stale cached token is fine here: offline, the Data
    // API call it unlocks is itself served from cache, not actually
    // verified by Neon, so the token only needs to be a truthy string.
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname === "/api/auth/token",
      method: "GET",
      handler: new NetworkFirst({
        cacheName: "auth-token",
        plugins: [new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 30 * DAY })],
      }),
    },
    // App icons (manifest, apple-touch-icon, favicon): defaultCache's
    // extension-based image rule below would otherwise catch these under
    // `StaleWhileRevalidate`, which answers instantly from whatever is
    // already cached and only refreshes in the background. That's fine for
    // photos, but these files are how iOS resolves the home-screen icon —
    // deleting and re-adding the PWA doesn't clear this cache (it's site
    // data tied to the origin, not to the home-screen shortcut), so a
    // shipped icon fix can appear to never take effect. NetworkFirst always
    // tries the network before falling back to cache.
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/icons/"),
      handler: new NetworkFirst({
        cacheName: "app-icons",
        plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 30 * DAY })],
      }),
    },
    // Album covers (Neon Object Storage, cross-origin): defaultCache's
    // extension-based image rule already matches these, but its 64-entry
    // cap is well below the size of the actual collection, and evicting a
    // cover just means "no cover" until back online, unlike the two rules
    // below where an eviction means a whole tab looks empty. Covers are
    // immutable (a re-uploaded cover gets a new UUID key, see
    // lib/storage.ts), so there's nothing to revalidate — CacheFirst avoids
    // a pointless network round-trip for something that never changes.
    {
      matcher: ({ sameOrigin, request }) => !sameOrigin && request.destination === "image",
      handler: new CacheFirst({
        cacheName: "album-covers",
        plugins: [
          new ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: 90 * DAY, maxAgeFrom: "last-used" }),
        ],
      }),
    },
    // The collection itself: GET calls to the Neon Data API
    // (NEXT_PUBLIC_NEON_DATA_API_URL, cross-origin). Without this rule they
    // fall through to defaultCache's generic cross-origin bucket, shared
    // with anything else cross-origin and capped at 1 hour — so "hors ligne
    // depuis hier" was long past that window and every tab came up empty.
    // NetworkFirst still prefers live data whenever there is a network.
    {
      matcher: ({ sameOrigin, request }) => !sameOrigin && request.destination !== "image",
      method: "GET",
      handler: new NetworkFirst({
        cacheName: "neon-data-api",
        networkTimeoutSeconds: 8,
        plugins: [
          new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * DAY, maxAgeFrom: "last-used" }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

// When a runtime-caching strategy can't produce a response — typically
// offline with nothing cached, but also e.g. a BnF request that times out —
// Serwist rejects the FetchEvent and Chrome logs "FetchEvent.respondWith
// received an error: no-response" for every such request. Return something
// concrete instead: the cached document for a navigation, an empty 503
// otherwise (the app and <OfflineBanner> already handle a failed request).
serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
  }
  return new Response(null, { status: 503, statusText: "Hors ligne" });
});

serwist.addEventListeners();
