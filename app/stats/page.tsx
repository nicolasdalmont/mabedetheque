"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { AppTabs } from "@/components/AppTabs";
import { BarChart, type BarChartDatum } from "@/components/BarChart";

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

// "9, 10, 11, 13" -> "9–11, 13" — a full Astérix-sized gap list reads much
// better as ranges than as dozens of individual numbers.
function compressRanges(numbers: number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = cur;
    prev = cur;
  }
  return ranges.join(", ");
}

type SeriesGap = { series: string; range: string; missing: string; missingCount: number };

// Only flags gaps *between the lowest and highest tome already owned* for a
// series — a tome beyond the highest one owned can't be detected without a
// reliable external "how many tomes does this series have" source, which we
// don't have (see the earlier "style" lookup — same class of problem).
function findSeriesGaps(albums: { series_name: string | null; issue_number: number | null }[]): SeriesGap[] {
  const bySeries = new Map<string, Set<number>>();
  for (const a of albums) {
    if (!a.series_name || a.issue_number == null) continue;
    if (!bySeries.has(a.series_name)) bySeries.set(a.series_name, new Set());
    bySeries.get(a.series_name)!.add(a.issue_number);
  }

  const gaps: SeriesGap[] = [];
  for (const [series, owned] of bySeries) {
    const sorted = Array.from(owned).sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const missing: number[] = [];
    for (let n = min; n <= max; n++) if (!owned.has(n)) missing.push(n);
    if (missing.length) {
      gaps.push({
        series,
        range: `${min}–${max}`,
        missing: compressRanges(missing),
        missingCount: missing.length,
      });
    }
  }
  return gaps.sort((a, b) => a.series.localeCompare(b.series));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 text-center dark:border-white/10">
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  );
}

export default function StatsPage() {
  const { albums, loading, error } = useAlbums();
  const { user, signOut } = useSession();

  const totalAlbums = albums.length;
  const totalSeries = useMemo(
    () => new Set(albums.map((a) => a.series_name).filter(Boolean)).size,
    [albums],
  );

  const purchasesByYear = useMemo(
    () => countByYear(albums.map((a) => a.purchase_date?.slice(0, 4) ?? null)),
    [albums],
  );
  const legalDepositByYear = useMemo(
    () =>
      countByYear(
        albums.map((a) => (a.legal_deposit ? extractYear(a.legal_deposit) : null)),
      ),
    [albums],
  );
  const seriesGaps = useMemo(() => findSeriesGaps(albums), [albums]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no next/image benefit here */}
          <img
            src="/icons/icon-192.png"
            alt="Ma Bédéthèque"
            className="h-12 w-12 rounded-md"
          />
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
      </header>

      <AppTabs />

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <StatCard label="Albums" value={totalAlbums} />
            <StatCard label="Séries" value={totalSeries} />
          </div>

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

          <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h2 className="mb-1 text-sm font-medium">Séries incomplètes</h2>
            <p className="mb-3 text-xs text-zinc-500">
              Tomes manquants entre le premier et le dernier numéro possédé — un tome
              publié au-delà de votre plus haut numéro possédé ne peut pas être détecté.
            </p>
            {seriesGaps.length ? (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {seriesGaps.map((gap) => (
                  <li key={gap.series} className="flex items-baseline justify-between gap-4 py-2">
                    <div>
                      <p className="text-sm font-medium">{gap.series}</p>
                      <p className="text-xs text-zinc-500">Possédés : {gap.range}</p>
                    </div>
                    <p className="text-right text-sm tabular-nums text-amber-600 dark:text-amber-400">
                      {gap.missing}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Aucun trou détecté.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
