"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { AppTabs } from "@/components/AppTabs";
import { SeriesCard } from "@/components/SeriesCard";
import { SeriesDetailModal } from "@/components/SeriesDetailModal";
import type { Album } from "@/types/album";

type SeriesSummary = { name: string; albums: Album[]; coverUrl: string | null };

// A single dead cover_url (404 on Object Storage) got written to 423 of the
// 875 albums — about half the collection — apparently by whatever bulk
// process attempted a cover search for albums that had none, instead of
// leaving cover_url empty on failure. It's non-empty so a plain truthy
// check treats it as "has a cover"; excluded here by URL so the series
// grid falls through to a real cover elsewhere in the series when one
// exists. The underlying rows are unchanged — this only affects which
// cover the series card picks to display.
const KNOWN_DEAD_COVER_URL =
  "https://br-icy-forest-a5gmcjl7.storage.c-1.us-east-2.aws.neon.tech/mabedetheque-covers/covers/aee360a3-442c-4dc9-a70f-3ce7c26d5c28.webp";

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
  const { user, signOut } = useSession();
  const searchParams = useSearchParams();
  const [openSeries, setOpenSeries] = useState<string | null>(searchParams.get("open"));

  const seriesList = useMemo(() => buildSeriesList(albums), [albums]);
  const activeSeries = seriesList.find((s) => s.name === openSeries) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no next/image benefit here */}
          <img
            src="/icons/icon-192.png"
            alt="Ma Bédéthèque"
            className="h-12 w-12 rounded-md"
          />
        </h1>
        {user ? (
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-zinc-500 hover:underline"
          >
            Déconnexion
          </button>
        ) : null}
      </header>

      <AppTabs />

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : seriesList.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Aucun album n&apos;a de série renseignée.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {seriesList.map((s) => (
            <SeriesCard
              key={s.name}
              name={s.name}
              coverUrl={s.coverUrl}
              count={s.albums.length}
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
