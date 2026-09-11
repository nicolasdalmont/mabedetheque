"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { getDataClient } from "@/lib/neon-client";
import { AppHeader } from "@/components/AppHeader";
import { CardGridSkeleton } from "@/components/CardGridSkeleton";
import { SeriesCard } from "@/components/SeriesCard";
import { SeriesDetailModal } from "@/components/SeriesDetailModal";
import { KNOWN_DEAD_COVER_URL } from "@/lib/constants";
import { seriesTitlesMatch } from "@/lib/bnf-series";
import type { Album } from "@/types/album";

type SeriesSummary = { name: string; albums: Album[]; coverUrl: string | null };

// The series' cover is the first tome (lowest issue number, title as
// tiebreak/fallback for unnumbered entries) that actually has one — covers
// are missing for a meaningful chunk of the collection (see Stats).
function buildSeriesList(albums: Album[]): SeriesSummary[] {
  const bySeries = new Map<string, Album[]>();
  for (const a of albums) {
    if (!a.series_name) continue;
    if (!bySeries.has(a.series_name)) bySeries.set(a.series_name, []);
    bySeries.get(a.series_name)!.push(a);
  }

  const list: SeriesSummary[] = [];
  for (const [name, seriesAlbums] of bySeries) {
    const sorted = [...seriesAlbums].sort((a, b) => {
      const an = a.issue_number ?? Infinity;
      const bn = b.issue_number ?? Infinity;
      if (an !== bn) return an - bn;
      return a.title.localeCompare(b.title);
    });
    const withCover = sorted.find((a) => a.cover_url && a.cover_url !== KNOWN_DEAD_COVER_URL);
    list.push({ name, albums: sorted, coverUrl: withCover?.cover_url ?? null });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function SeriesContent() {
  const { albums, loading, error } = useAlbums();
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openSeries, setOpenSeries] = useState<string | null>(searchParams.get("open"));

  const seriesList = useMemo(() => buildSeriesList(albums), [albums]);
  const activeSeries = seriesList.find((s) => s.name === openSeries) ?? null;

  // Filters in the URL (like the Albums tab) — shareable and restored when
  // coming back from an album's page.
  const seriesNameFilter = searchParams.get("q") ?? "";
  const authorFilter = searchParams.get("author") ?? "";
  const integraleFilter = searchParams.get("integrale") === "1";
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

  // Writer and illustrator merged into one list — picking a name matches
  // either role, same as the equivalent filter on Albums.
  const authorOptions = useMemo(
    () =>
      Array.from(
        new Set(albums.flatMap((a) => [a.writer, a.illustrator]).filter(Boolean)),
      ).sort() as string[],
    [albums],
  );
  const seriesFiltersActive = Boolean(
    seriesNameFilter.trim() || authorFilter || integraleFilter,
  );
  const visibleSeriesList = useMemo(() => {
    const q = seriesNameFilter.trim().toLowerCase();
    return seriesList.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (
        authorFilter &&
        !s.albums.some((a) => a.writer === authorFilter || a.illustrator === authorFilter)
      ) {
        return false;
      }
      if (integraleFilter && !s.albums.some((a) => a.is_integrale)) return false;
      return true;
    });
  }, [seriesList, seriesNameFilter, authorFilter, integraleFilter]);

  const [wishlist, setWishlist] = useState<
    { series_name: string; issue_number: number | null; title: string | null }[]
  >([]);
  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("wishlist_items")
      .select("series_name, issue_number, title")
      .then(({ data }) => {
        if (!ignore) setWishlist(data ?? []);
      });
    return () => {
      ignore = true;
    };
  }, []);
  // wishlist_items.series_name can come from a BnF search result (BnF's own
  // wording) or from a local series name (our sort-friendly convention) —
  // compare on significant words, same as the BnF series matching, rather
  // than exact string equality which would miss half of them.
  const seriesWithWishlistItem = useMemo(() => {
    const matched = new Set<string>();
    for (const series of seriesList) {
      if (wishlist.some((w) => seriesTitlesMatch(series.name, w.series_name))) {
        matched.add(series.name);
      }
    }
    return matched;
  }, [seriesList, wishlist]);
  // Tomes on the achats list for the currently-open series — the detail
  // modal ghosts them into the album grid and won't offer them again.
  const openSeriesWishlistTomes = useMemo(() => {
    if (!openSeries) return [];
    return wishlist
      .filter((w) => seriesTitlesMatch(openSeries, w.series_name))
      .map((w) => ({ issue_number: w.issue_number, title: w.title }));
  }, [openSeries, wishlist]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={seriesNameFilter}
          onChange={(e) => updateParams({ q: e.target.value })}
          placeholder="Filtrer par série"
          aria-label="Filtrer par nom de série"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-md border border-black/15 bg-transparent px-2 py-2 text-base outline-none focus:border-yellow-500 sm:w-56 sm:py-1.5 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
        />
        <select
          value={authorFilter}
          onChange={(e) => updateParams({ author: e.target.value })}
          aria-label="Filtrer par auteur"
          className="w-full rounded-md border border-black/15 bg-transparent px-2 py-2 text-base outline-none focus:border-yellow-500 sm:w-auto sm:py-1.5 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
        >
          <option value="">Tous les auteurs</option>
          {authorOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded-md border border-black/15 px-2 py-2 text-base sm:py-1.5 sm:text-sm dark:border-white/20">
          <input
            type="checkbox"
            checked={integraleFilter}
            onChange={(e) => updateParams({ integrale: e.target.checked ? "1" : "" })}
            className="h-3.5 w-3.5 rounded border-black/30 text-yellow-500 focus:ring-yellow-500 dark:border-white/30"
          />
          Avec une intégrale
        </label>
      </div>

      {!loading && !error && seriesList.length > 0 ? (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {seriesFiltersActive
              ? `${visibleSeriesList.length} sur ${seriesList.length} séries`
              : `${seriesList.length} série${seriesList.length > 1 ? "s" : ""}`}
          </span>
          {seriesFiltersActive ? (
            <button
              type="button"
              onClick={() => updateParams({ q: "", author: "", integrale: "" })}
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
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : seriesList.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Aucun album n&apos;a de série renseignée.
        </p>
      ) : visibleSeriesList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-zinc-500">
          <p>Aucune série ne correspond à ce filtre.</p>
          <button
            type="button"
            onClick={() => updateParams({ q: "", author: "" })}
            className="rounded-md border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            Effacer les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {visibleSeriesList.map((s) => (
            <SeriesCard
              key={s.name}
              name={s.name}
              coverUrl={s.coverUrl}
              count={s.albums.length}
              hasWishlistItem={seriesWithWishlistItem.has(s.name)}
              onClick={() => setOpenSeries(s.name)}
            />
          ))}
        </div>
      )}

      {activeSeries && user ? (
        <SeriesDetailModal
          seriesName={activeSeries.name}
          albums={activeSeries.albums}
          ownerId={user.id}
          wishlistTomes={openSeriesWishlistTomes}
          onClose={() => setOpenSeries(null)}
        />
      ) : null}
    </div>
  );
}

export default function SeriesPage() {
  return (
    <Suspense>
      <SeriesContent />
    </Suspense>
  );
}
