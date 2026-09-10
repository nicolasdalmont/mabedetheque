"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// The service worker caches the app shell, so it keeps opening offline — but
// data fetches then fail silently. This makes the state explicit.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-black">
      <WifiOff size={13} aria-hidden="true" />
      Hors ligne — les données affichées peuvent être obsolètes.
    </div>
  );
}
