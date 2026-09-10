"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAlbums } from "@/hooks/useAlbums";
import { AppHeader } from "@/components/AppHeader";
import { SearchBar } from "@/components/SearchBar";
import { FilterSortBar } from "@/components/FilterSortBar";
import { AlbumGrid } from "@/components/AlbumGrid";
import { AlbumTable } from "@/components/AlbumTable";
import { CardGridSkeleton } from "@/components/CardGridSkeleton";
import type { SortKey, ViewMode } from "@/types/album";
import { KNOWN_DEAD_COVER_URL, LAST_ALBUM_KEY } from "@/lib/constants";

const MISSING_LABEL: Record<string, string> = {
  cover: "sans couverture",
  tome: "en série, sans numéro de tome",
  achat: "sans date d'achat",
};

function HomeContent() {
  const { albums, loading, error } = useAlbums();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters/sort/view live in the URL (not useState): navigating to an
  // album is a normal push, so going back restores this exact URL — no
  // extra plumbing needed to keep them across a visit to an album's page.
  const query = searchParams.get("q") ?? "";
  const series = searchParams.get("series") ?? "";
  const publisher = searchParams.get("publisher") ?? "";
  const author = searchParams.get("author") ?? "";
  const missing = searchParams.get("missing") ?? ""; // cover | tome | achat (depuis Stats › Anomalies)
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
  // Writer and illustrator merged into one list — picking a name matches
  // either role, since which role someone had isn't always the point.
  const authorOptions = useMemo(
    () =>
      Array.from(
        new Set(albums.flatMap((a) => [a.writer, a.illustrator]).filter(Boolean)),
      ).sort() as string[],
    [albums],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return albums
      .filter((a) => {
        if (series && a.series_name !== series) return false;
        if (publisher && a.publisher !== publisher) return false;
        if (author && a.writer !== author && a.illustrator !== author) return false;
        if (missing === "cover" && a.cover_url && a.cover_url !== KNOWN_DEAD_COVER_URL) return false;
        if (missing === "tome" && !(a.series_name && a.issue_number == null)) return false;
        if (missing === "achat" && a.purchase_date) return false;
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
  }, [albums, query, series, publisher, author, missing, sortKey]);

  const hasActiveFilters = Boolean(query || series || publisher || author || missing);
  const clearFilters = () =>
    updateParams({ q: "", series: "", publisher: "", author: "", missing: "" });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      {loading || albums.length > 0 ? (
        <div>
          <Link
            href="/albums/new"
            className="rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-300"
          >
            + Ajouter un album
          </Link>
        </div>
      ) : null}

      <SearchBar value={query} onChange={(v) => updateParams({ q: v })} />
      <FilterSortBar
        seriesOptions={seriesOptions}
        publisherOptions={publisherOptions}
        authorOptions={authorOptions}
        series={series}
        publisher={publisher}
        author={author}
        onSeriesChange={(v) => updateParams({ series: v })}
        onPublisherChange={(v) => updateParams({ publisher: v })}
        onAuthorChange={(v) => updateParams({ author: v })}
        sortKey={sortKey}
        onSortChange={(v) => updateParams({ sort: v })}
        viewMode={viewMode}
        onViewModeChange={(v) => updateParams({ view: v })}
      />

      {!loading && !error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            {hasActiveFilters
              ? `${filtered.length} sur ${albums.length} album${albums.length > 1 ? "s" : ""}`
              : `${albums.length} album${albums.length > 1 ? "s" : ""}`}
            {missing && MISSING_LABEL[missing] ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {MISSING_LABEL[missing]}
              </span>
            ) : null}
          </span>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded px-2 py-1 font-medium text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
            >
              Effacer les filtres
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <CardGridSkeleton />
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-zinc-500">
          {albums.length === 0 ? (
            <>
              <p>Votre bédéthèque est vide.</p>
              <Link
                href="/albums/new"
                className="rounded-md bg-yellow-400 px-3 py-1.5 font-medium text-black hover:bg-yellow-300"
              >
                + Ajouter votre premier album
              </Link>
            </>
          ) : (
            <>
              <p>Aucun album ne correspond à ce filtre.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
              >
                Effacer les filtres
              </button>
            </>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <AlbumGrid albums={filtered} />
      ) : (
        <AlbumTable albums={filtered} />
      )}
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
