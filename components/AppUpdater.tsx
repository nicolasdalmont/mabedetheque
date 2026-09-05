"use client";

import { useEffect } from "react";

// Keeps an installed PWA (added to the home screen) from getting stuck on a
// stale version. A backgrounded PWA often resumes without a full reload, so
// the browser's own lazy service-worker update check may not run for a
// while — this forces a check on every open/foreground, and reloads once a
// new version has taken over (sw.ts already sets skipWaiting/clientsClaim,
// so the new worker activates immediately once found).
export function AppUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    };
    checkForUpdate();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", checkForUpdate);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", checkForUpdate);
    };
  }, []);

  return null;
}
