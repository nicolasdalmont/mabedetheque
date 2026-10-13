"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Library } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { AppHeader } from "@/components/AppHeader";
import { CardGridSkeleton } from "@/components/CardGridSkeleton";
import { SeriesCard } from "@/components/SeriesCard";
import { SeriesDetailModal } from "@/components/SeriesDetailModal";
import { KNOWN_DEAD_COVER_URL } from "@/lib/constants";
import { seriesTitlesMatch } from "@/lib/bnf-series";
import { normalizeForSearch } from "@/lib/search";
import type { Album } from "@/types/album";

type SeriesSummary = {
  name: string;
  /** Owned albums *and* achat-tagged ones. */
  albums: Album[];
  ownedCount: number;
  hasWishlist: boolean;
  coverUrl: string | null;
};

// `onChange` writes to the URL (router.replace), same as the Albums search
// bar — buffer keystrokes locally and debounce before propagating, entirely
// from the event handler (no effect) so a fast re-render never clears a
// pending keystroke before it commits.
function SeriesFilterInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const [lastExternalValue, setLastExternalValue] = useState(value);
  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    setText(value);
  }

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (next: string) => {
    setText(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(next), 250);
  };

  return (
    <input
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Filtrer par série"
      aria-label="Filtrer par nom de série"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      className="w-full rounded-md border border-black/15 bg-transparent px-2 py-2 text-base outline-none focus:border-yellow-500 sm:w-56 sm:py-1.5 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
    />
  );
}

// The series' cover is the first tome (lowest issue number, title as
// tiebreak/fallback for unnumbered entries) that actually has one — covers
// are missing for a meaningful chunk of the collection (see Stats).
function buildSeriesList(albums: Album[]): SeriesSummary[] {
  const bySeries = new Map<string, Album[]>();
  const add = (name: string, a: Album) => {
    if (!bySeries.has(name)) bySeries.set(name, []);
    bySeries.get(name)!.push(a);
  };
  for (const a of albums) {
    if (a.series_name && !a.is_wishlist) add(a.series_name, a);
  }
  // An achat's series_name can come from a BnF search (BnF's own wording)
  // rather than our local convention — attach it to the owned series it
  // matches on significant words instead of spawning a near-duplicate series.
  for (const a of albums) {
    if (!a.series_name || !a.is_wishlist) continue;
    const target = bySeries.has(a.series_name)
      ? a.series_name
      : ([...bySeries.keys()].find((name) => seriesTitlesMatch(name, a.series_name!)) ??
        a.series_name);
    add(target, a);
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
    list.push({
      name,
      albums: sorted,
      ownedCount: sorted.filter((a) => !a.is_wishlist).length,
      hasWishlist: sorted.some((a) => a.is_wishlist),
      coverUrl: withCover?.cover_url ?? null,
    });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function SeriesContent() {
  const { allAlbums: albums, loading, error, refetch } = useAlbums();
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
  const horsSerieFilter = searchParams.get("hors_serie") === "1";
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
    seriesNameFilter.trim() || authorFilter || integraleFilter || horsSerieFilter,
  );
  const visibleSeriesList = useMemo(() => {
    const q = normalizeForSearch(seriesNameFilter.trim());
    return seriesList.filter((s) => {
      if (q && !normalizeForSearch(s.name).includes(q)) return false;
      if (
        authorFilter &&
        !s.albums.some((a) => a.writer === authorFilter || a.illustrator === authorFilter)
      ) {
        return false;
      }
      if (integraleFilter && !s.albums.some((a) => a.is_integrale)) return false;
      if (horsSerieFilter && !s.albums.some((a) => a.is_hors_serie)) return false;
      return true;
    });
  }, [seriesList, seriesNameFilter, authorFilter, integraleFilter, horsSerieFilter]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SeriesFilterInput value={seriesNameFilter} onChange={(v) => updateParams({ q: v })} />
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
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-md border border-black/15 px-2 py-2 text-base sm:py-1.5 sm:text-sm dark:border-white/20">
            <input
              type="checkbox"
              checked={integraleFilter}
              onChange={(e) => updateParams({ integrale: e.target.checked ? "1" : "" })}
              className="h-3.5 w-3.5 rounded border-black/30 text-yellow-500 focus:ring-yellow-500 dark:border-white/30"
            />
            Avec une intégrale
          </label>
          <label className="flex items-center gap-1.5 rounded-md border border-black/15 px-2 py-2 text-base sm:py-1.5 sm:text-sm dark:border-white/20">
            <input
              type="checkbox"
              checked={horsSerieFilter}
              onChange={(e) => updateParams({ hors_serie: e.target.checked ? "1" : "" })}
              className="h-3.5 w-3.5 rounded border-black/30 text-yellow-500 focus:ring-yellow-500 dark:border-white/30"
            />
            Avec un hors série
          </label>
        </div>
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
              onClick={() => updateParams({ q: "", author: "", integrale: "", hors_serie: "" })}
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
        <EmptyState
          icon={Library}
          title="Aucune série pour le moment"
          description="Les séries se construisent automatiquement à partir des albums de votre collection : vous y verrez aussi les tomes manquants."
          actionHref="/albums/new"
          actionLabel="+ Ajouter un album"
        />
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
              count={s.ownedCount}
              hasWishlistItem={s.hasWishlist}
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
          onChanged={refetch}
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
