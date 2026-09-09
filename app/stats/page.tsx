"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAlbums } from "@/hooks/useAlbums";
import { getDataClient } from "@/lib/neon-client";
import { AppTabs } from "@/components/AppTabs";
import { SignOutButton } from "@/components/SignOutButton";
import { BarChart, type BarChartDatum } from "@/components/BarChart";
import { KNOWN_DEAD_COVER_URL } from "@/lib/constants";

const UNKNOWN_YEAR = "Inconnue";

// legal_deposit is free text ("DL 2024", "02/1993", "2000-"...) depending on
// whether the album came from the BnF lookup or the original CSV import —
// no shared structured format, so just pull out the first plausible year.
function extractYear(value: string): string | null {
  const match = value.match(/(19|20)\d{2}/);
  return match ? match[0] : null;
}

function countByYear(years: (string | null)[]): BarChartDatum[] {
  const counts = new Map<string, number>();
  for (const year of years) {
    const key = year ?? UNKNOWN_YEAR;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = Array.from(counts.keys())
    .filter((y) => y !== UNKNOWN_YEAR)
    .sort();
  const data: BarChartDatum[] = known.map((year) => ({
    label: year,
    value: counts.get(year)!,
  }));
  if (counts.has(UNKNOWN_YEAR)) {
    data.push({ label: UNKNOWN_YEAR, value: counts.get(UNKNOWN_YEAR)! });
  }
  return data;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 text-center dark:border-white/10">
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
      {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

type RankingItem = { name: string; count: number };

// Shared "top 10" ranking display (auteurs, éditeurs...): a horizontal bar
// scaled against the top entry's count, rather than BarChart (which is
// built for a value-per-fixed-width-bar series like years, not a ranked
// list of variable-length names).
function RankingList({ items }: { items: RankingItem[] }) {
  const max = items[0]?.count ?? 0;
  if (!items.length) {
    return <p className="text-sm text-zinc-500">Aucune donnée.</p>;
  }
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={item.name} className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-400">
            {i + 1}
          </span>
          <span className="w-32 shrink-0 truncate text-sm sm:w-48">{item.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div
              className="h-full rounded-full bg-yellow-400"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-zinc-500">
            {item.count}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Top 10 by a single string value (e.g. publisher — one per album, unlike
// authors which need the writer/illustrator dedup handled separately below).
function topByValue(values: (string | null)[]): RankingItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);
}

export default function StatsPage() {
  const { albums, loading, error } = useAlbums();
  const [wishlistToBuy, setWishlistToBuy] = useState(0);

  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("wishlist_items")
      .select("id")
      .eq("status", "a_acheter")
      .then(({ data }) => {
        if (!ignore) setWishlistToBuy(data?.length ?? 0);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const totalAlbums = albums.length;
  const totalSeries = useMemo(
    () => new Set(albums.map((a) => a.series_name).filter(Boolean)).size,
    [albums],
  );
  const albumsWithoutCover = useMemo(
    () => albums.filter((a) => !a.cover_url || a.cover_url === KNOWN_DEAD_COVER_URL).length,
    [albums],
  );
  const albumsForSale = useMemo(
    () => albums.filter((a) => a.sale_status === "a_vendre").length,
    [albums],
  );

  // Writer and illustrator merged into one ranking — same "auteur" notion as
  // the filter on Albums/Séries. An album counts once per author even when
  // that author is both writer and illustrator of it (dedup via album id,
  // not a plain increment), so a solo-authored album never counts twice.
  const topAuthors = useMemo(() => {
    const byAuthor = new Map<string, Set<string>>();
    for (const a of albums) {
      for (const name of [a.writer, a.illustrator]) {
        if (!name) continue;
        if (!byAuthor.has(name)) byAuthor.set(name, new Set());
        byAuthor.get(name)!.add(a.id);
      }
    }
    return Array.from(byAuthor.entries())
      .map(([name, ids]) => ({ name, count: ids.size }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [albums]);
  const topPublishers = useMemo(
    () => topByValue(albums.map((a) => a.publisher)),
    [albums],
  );

  const purchasesByYear = useMemo(
    () =>
      countByYear(
        albums.filter((a) => a.purchase_date).map((a) => a.purchase_date!.slice(0, 4)),
      ),
    [albums],
  );
  const legalDepositByYear = useMemo(
    () =>
      countByYear(
        albums.map((a) => (a.legal_deposit ? extractYear(a.legal_deposit) : null)),
      ),
    [albums],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no next/image benefit here */}
            <img
              src="/icons/icon-192.png"
              alt="Ma Bédéthèque"
              className="h-12 w-12 rounded-md"
            />
          </Link>
          <AppTabs />
        </div>
        <SignOutButton />
      </header>

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
            <StatCard
              label="Albums"
              value={totalAlbums}
              hint={`${albumsWithoutCover} sans couverture`}
            />
            <StatCard label="Séries" value={totalSeries} />
            <StatCard label="À acheter" value={wishlistToBuy} />
            <StatCard label="En vente" value={albumsForSale} />
          </div>

          <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h2 className="mb-3 text-sm font-medium">Top 10 des auteurs</h2>
            <RankingList items={topAuthors} />
          </section>

          <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h2 className="mb-3 text-sm font-medium">Top 10 des éditeurs</h2>
            <RankingList items={topPublishers} />
          </section>

          <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h2 className="mb-3 text-sm font-medium">Achats par année</h2>
            {purchasesByYear.length ? (
              <BarChart data={purchasesByYear} />
            ) : (
              <p className="text-sm text-zinc-500">Aucune donnée.</p>
            )}
          </section>

          <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h2 className="mb-3 text-sm font-medium">Dépôt légal par année</h2>
            {legalDepositByYear.length ? (
              <BarChart data={legalDepositByYear} />
            ) : (
              <p className="text-sm text-zinc-500">Aucune donnée.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
