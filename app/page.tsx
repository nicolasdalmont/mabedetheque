"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { SearchBar } from "@/components/SearchBar";
import { FilterSortBar } from "@/components/FilterSortBar";
import { AlbumGrid } from "@/components/AlbumGrid";
import { AlbumTable } from "@/components/AlbumTable";
import type { SortKey, ViewMode } from "@/types/album";

export default function Home() {
  const { albums, loading, error } = useAlbums();
  const { user, signOut } = useSession();

  const [query, setQuery] = useState("");
  const [series, setSeries] = useState("");
  const [publisher, setPublisher] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const seriesOptions = useMemo(
    () =>
      Array.from(new Set(albums.map((a) => a.series_name).filter(Boolean))).sort() as string[],
    [albums],
  );
  const publisherOptions = useMemo(
    () =>
      Array.from(new Set(albums.map((a) => a.publisher).filter(Boolean))).sort() as string[],
    [albums],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return albums
      .filter((a) => {
        if (series && a.series_name !== series) return false;
        if (publisher && a.publisher !== publisher) return false;
        if (!q) return true;
        return [a.title, a.series_name, a.writer, a.illustrator, a.isbn]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (sortKey === "series") {
          if (!a.series_name && !b.series_name) return a.title.localeCompare(b.title);
          if (!a.series_name) return -1;
          if (!b.series_name) return 1;
          const seriesCmp = a.series_name.localeCompare(b.series_name);
          if (seriesCmp !== 0) return seriesCmp;
          const aIssue = a.issue_number ?? Infinity;
          const bIssue = b.issue_number ?? Infinity;
          if (aIssue !== bIssue) return aIssue - bIssue;
          return a.title.localeCompare(b.title);
        }
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        return String(av).localeCompare(String(bv));
      });
  }, [albums, query, series, publisher, sortKey]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Ma Bédéthèque</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/albums/new"
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            + Ajouter un album
          </Link>
          {user ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-zinc-500 hover:underline"
            >
              Déconnexion
            </button>
          ) : null}
        </div>
      </header>

      <SearchBar value={query} onChange={setQuery} />
      <FilterSortBar
        seriesOptions={seriesOptions}
        publisherOptions={publisherOptions}
        series={series}
        publisher={publisher}
        onSeriesChange={setSeries}
        onPublisherChange={setPublisher}
        sortKey={sortKey}
        onSortChange={setSortKey}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : viewMode === "grid" ? (
        <AlbumGrid albums={filtered} />
      ) : (
        <AlbumTable albums={filtered} />
      )}

      <p className="text-center text-xs text-zinc-400">
        {albums.length} album{albums.length > 1 ? "s" : ""} au total
        {filtered.length !== albums.length ? ` · ${filtered.length} affiché${filtered.length > 1 ? "s" : ""}` : ""}
      </p>
    </div>
  );
}
