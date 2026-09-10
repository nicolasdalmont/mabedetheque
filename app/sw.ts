/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
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
