"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { getDataClient } from "@/lib/neon-client";
import { AppTabs } from "@/components/AppTabs";
import { SignOutButton } from "@/components/SignOutButton";
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
  const searchParams = useSearchParams();
  const [openSeries, setOpenSeries] = useState<string | null>(searchParams.get("open"));

  const seriesList = useMemo(() => buildSeriesList(albums), [albums]);
  const activeSeries = seriesList.find((s) => s.name === openSeries) ?? null;

  const [authorFilter, setAuthorFilter] = useState("");
  const [seriesNameFilter, setSeriesNameFilter] = useState("");
  // Writer and illustrator merged into one list — picking a name matches
  // either role, same as the equivalent filter on Albums.
  const authorOptions = useMemo(
    () =>
      Array.from(
        new Set(albums.flatMap((a) => [a.writer, a.illustrator]).filter(Boolean)),
      ).sort() as string[],
    [albums],
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
      return true;
    });
  }, [seriesList, seriesNameFilter, authorFilter]);

  const [wishlistSeriesNames, setWishlistSeriesNames] = useState<string[]>([]);
  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("wishlist_items")
      .select("series_name")
      .then(({ data }) => {
        if (!ignore) setWishlistSeriesNames((data ?? []).map((i) => i.series_name));
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
      if (wishlistSeriesNames.some((wn) => seriesTitlesMatch(series.name, wn))) {
        matched.add(series.name);
      }
    }
    return matched;
  }, [seriesList, wishlistSeriesNames]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <h1 className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no next/image benefit here */}
            <img
              src="/icons/icon-192.png"
              alt="Ma Bédéthèque"
              className="h-12 w-12 rounded-md"
            />
          </h1>
          <AppTabs />
        </div>
        <SignOutButton />
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={seriesNameFilter}
          onChange={(e) => setSeriesNameFilter(e.target.value)}
          placeholder="Filtrer par série"
          autoComplete="off"
          className="w-full rounded-md border border-black/15 bg-transparent px-2 py-2 text-base outline-none focus:border-yellow-500 sm:w-56 sm:py-1.5 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
        />
        <select
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          className="w-full rounded-md border border-black/15 bg-transparent px-2 py-2 text-base outline-none focus:border-yellow-500 sm:w-auto sm:py-1.5 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
        >
          <option value="">Tous les auteurs</option>
          {authorOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : seriesList.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Aucun album n&apos;a de série renseignée.
        </p>
      ) : visibleSeriesList.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Aucune série ne correspond à ce filtre.
        </p>
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
