"use client";

import { useEffect, useRef, useState } from "react";
import { getDataClient } from "@/lib/neon-client";
import type { Album } from "@/types/album";

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let ignore = false;

    const fetchAlbums = () => {
      getDataClient()
        .from("albums")
        .select("*")
        .order("title", { ascending: true })
        .then(({ data, error }) => {
          if (ignore) return;
          setError(error ? error.message : null);
          setAlbums(data ?? []);
          setLoading(false);
          loaded.current = true;
        });
    };

    fetchAlbums();

    // Re-fetch when the app regains focus (a backgrounded PWA resumes
    // without a full reload, so this is the only way its data gets a
    // chance to catch up with changes made elsewhere in the meantime).
    // Skipped until the first load has completed, so it never fires
    // before there's anything to compare against.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && loaded.current) fetchAlbums();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    return () => {
      ignore = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, []);

  return { albums, loading, error };
}
