"use client";

import { useEffect, useState } from "react";
import { getDataClient } from "@/lib/neon-client";
import type { Album } from "@/types/album";

export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("albums")
      .select("*")
      .order("title", { ascending: true })
      .then(({ data, error }) => {
        if (ignore) return;
        setError(error ? error.message : null);
        setAlbums(data ?? []);
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return { albums, loading, error };
}
