"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { SearchBar } from "@/components/SearchBar";
import { FilterSortBar } from "@/components/FilterSortBar";
import { AlbumGrid } from "@/components/AlbumGrid";
import { AlbumTable } from "@/components/AlbumTable";
import type { SortKey, ViewMode } from "@/types/album";
import { LAST_ALBUM_KEY } from "@/lib/constants";

function HomeContent() {
  const { albums, loading, error } = useAlbums();
  const { user, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters/sort/view live in the URL (not useState): navigating to an
  // album is a normal push, so going back restores this exact URL — no
  // extra plumbing needed to keep them across a visit to an album's page.
  const query = searchParams.get("q") ?? "";
  const series = searchParams.get("series") ?? "";
  const publisher = searchParams.get("publisher") ?? "";
  const sortKey = (searchParams.get("sort") as SortKey | null) ?? "title";
  const viewMode = (searchParams.get("view") as ViewMode | null) ?? "grid";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Scroll to the album that was open, once its list has loaded.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (loading || scrolledRef.current) return;
    scrolledRef.current = true;
    const lastId = sessionStorage.getItem(LAST_ALBUM_KEY);
    if (!lastId) return;
    sessionStorage.removeItem(LAST_ALBUM_KEY);
    requestAnimationFrame(() => {
      document
        .getElementById(`album-${lastId}`)
        ?.scrollIntoView({ block: "center" });
    });
  }, [loading]);

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

      <SearchBar value={query} onChange={(v) => updateParams({ q: v })} />
      <FilterSortBar
        seriesOptions={seriesOptions}
        publisherOptions={publisherOptions}
        series={series}
        publisher={publisher}
        onSeriesChange={(v) => updateParams({ series: v })}
        onPublisherChange={(v) => updateParams({ publisher: v })}
        sortKey={sortKey}
        onSortChange={(v) => updateParams({ sort: v })}
        viewMode={viewMode}
        onViewModeChange={(v) => updateParams({ view: v })}
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

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
