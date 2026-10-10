"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDataClient } from "@/lib/neon-client";
import type { Album } from "@/types/album";

export function useAlbums() {
  const [allAlbums, setAllAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    let ignore = false;

    const fetchAlbums = () => {
      getDataClient()
        .from("albums")
        .select("*")
        // A sold album leaves the active collection everywhere this hook
        // feeds (gallery, séries, stats) without being deleted — it stays
        // reachable from the Vente tab, which queries albums directly
        // instead of going through this hook.
        .neq("sale_status", "vendu")
        .order("title", { ascending: true })
        .then(({ data, error }) => {
          if (ignore) return;
          setError(error ? error.message : null);
          setAllAlbums(data ?? []);
          setLoading(false);
          loaded.current = true;
        });
    };
    fetchRef.current = fetchAlbums;

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

  const refetch = () => fetchRef.current();

  // `albums` is the collection proper (what stats, gaps, etc. count); the
  // "achat"-tagged ones (is_wishlist) are exposed separately, and `allAlbums`
  // has both for the screens that show them together (gallery's "tous"
  // scope, series detail).
  const albums = useMemo(() => allAlbums.filter((a) => !a.is_wishlist), [allAlbums]);
  const wishlist = useMemo(() => allAlbums.filter((a) => a.is_wishlist), [allAlbums]);

  return { albums, wishlist, allAlbums, loading, error, refetch };
}
