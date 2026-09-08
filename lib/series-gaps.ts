// "9, 10, 11, 13" -> "9–11, 13" — a long gap list (an Astérix-sized series)
// reads much better as ranges than as dozens of individual numbers.
export function compressRanges(numbers: number[]): string {
  if (!numbers.length) return "";
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

export type SeriesGap = { series: string; range: string; missing: string; missingNumbers: number[] };

// Only flags gaps *between the lowest and highest tome already owned* for a
// series — a tome beyond the highest one owned can't be detected without an
// external source of "how many tomes does this series have" (see the BnF
// collection search in lib/bnf-series.ts for the on-demand, human-verified
// way to go further than this).
export function findSeriesGaps(
  albums: { series_name: string | null; issue_number: number | null }[],
): SeriesGap[] {
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
        missingNumbers: missing,
      });
    }
  }
  return gaps.sort((a, b) => a.series.localeCompare(b.series));
}
