"use client";

import { useMemo, useState } from "react";
import type { Album } from "@/types/album";

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400";

/**
 * Searches the user's own collection (not the BnF) by title/series, for
 * picking an already-owned album to act on — e.g. adding it to the Vente
 * list. `albums` should already exclude anything the caller doesn't want
 * offered (e.g. albums already for sale).
 */
export function LocalAlbumSearch({
  albums,
  onSelect,
  placeholder = "Rechercher un album de ma bédéthèque (titre, série)",
}: {
  albums: Album[];
  onSelect: (album: Album) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return albums
      .filter((a) => [a.title, a.series_name].filter(Boolean).some((f) => f!.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [albums, query]);

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClass}
      />
      {query.trim() ? (
        results.length ? (
          <ul className="max-h-56 divide-y divide-black/5 overflow-y-auto rounded-md border border-black/10 dark:divide-white/10 dark:border-white/10">
            {results.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(a);
                    setQuery("");
                  }}
                  className="block w-full px-2 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="font-medium">{a.title}</span>
                  {a.series_name ? (
                    <span className="text-zinc-500">
                      {" "}
                      — {a.series_name}
                      {a.issue_number != null ? ` #${a.issue_number}` : ""}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">Aucun album ne correspond.</p>
        )
      ) : null}
    </div>
  );
}
