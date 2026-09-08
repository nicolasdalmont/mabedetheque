import { subfields, findDatafields, parseSruRecords, sruNumberOfRecords } from "./unimarc";
import { extractImprint } from "./isbn-providers";

// On-demand BnF "collection éditoriale" (series) lookup — separate from the
// per-ISBN lookup in isbn-providers.ts. A series name is genuinely
// ambiguous at the BnF (the same title can span many collection records —
// different languages, publishers, or re-editions as rights moved over the
// decades), so this always returns *candidates* for a human to pick from
// rather than guessing one automatically. See the "tomes manquants"
// conversation this was built for.

const BNF_SRU_URL = "http://catalogue.bnf.fr/api/SRU";

function sruQuery(query: string, maximumRecords: number): URL {
  const url = new URL(BNF_SRU_URL);
  url.searchParams.set("version", "1.2");
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("query", query);
  url.searchParams.set("recordSchema", "unimarcxchange");
  url.searchParams.set("maximumRecords", String(maximumRecords));
  return url;
}

export type BnfCollectionCandidate = {
  id: string; // full ark URI, e.g. "ark:/12148/cb43710471x" — pass back to fetchCollectionTomes
  title: string;
  publisher?: string;
  place?: string;
  dateRange?: string;
  language?: string;
};

// bib.serialtitle searches UNIMARC field 225 (collection/series title) —
// specifically records of type "collection éditoriale", as opposed to
// bib.title which searches each individual album's own title.
export async function searchBnfCollections(seriesName: string): Promise<BnfCollectionCandidate[]> {
  const escaped = seriesName.replace(/"/g, '\\"');
  const url = sruQuery(`bib.serialtitle all "${escaped}"`, 30);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const xml = await res.text();
  const records = parseSruRecords(xml);

  const candidates: BnfCollectionCandidate[] = [];
  for (const marc of records) {
    const id = (marc as { ["@_id"]?: string })["@_id"];
    if (!id) continue;
    const f200 = subfields(findDatafields(marc, "200")[0]);
    const title = f200.a?.[0];
    if (!title) continue;
    const f101 = subfields(findDatafields(marc, "101")[0]);
    const fImprint = extractImprint(marc);
    candidates.push({
      id,
      title: [title, f200.e?.[0]].filter(Boolean).join(" — "),
      publisher: fImprint.c?.[0],
      place: fImprint.a?.[0],
      dateRange: fImprint.d?.[0],
      language: f101.a?.[0],
    });
  }
  return candidates;
}

export type BnfTome = {
  title: string;
  issueNumber: number;
  isbn?: string;
  publisher?: string;
};

// bib.col2bib returns every bibliographic record linked to a collection
// authority record — one per tome, but also spin-off products (stickers,
// activity books...) that share the same collection but have no volume
// number (field 225$v absent); those are filtered out here since they're
// not "tomes" for gap-detection purposes. A collection re-catalogued under
// more than one record (rare, but seen on old/imported entries) is
// deduplicated by issue number, keeping the first occurrence.
export async function fetchCollectionTomes(
  collectionId: string,
): Promise<{ tomes: BnfTome[]; totalRecords: number; truncated: boolean }> {
  const maximumRecords = 200;
  const url = sruQuery(`bib.col2bib any "${collectionId}"`, maximumRecords);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { tomes: [], totalRecords: 0, truncated: false };
  const xml = await res.text();
  const records = parseSruRecords(xml);
  const totalRecords = sruNumberOfRecords(xml);

  const tomes: BnfTome[] = [];
  for (const marc of records) {
    const f225 = subfields(findDatafields(marc, "225")[0]);
    const issueRaw = f225.v?.[0];
    if (!issueRaw) continue;
    const issueNumber = parseInt(issueRaw, 10);
    if (!Number.isFinite(issueNumber)) continue;
    const f200 = subfields(findDatafields(marc, "200")[0]);
    const title = f200.a?.[0];
    if (!title) continue;
    const f010 = subfields(findDatafields(marc, "010")[0]);
    const fImprint = extractImprint(marc);
    tomes.push({ title, issueNumber, isbn: f010.a?.[0], publisher: fImprint.c?.[0] });
  }

  const seen = new Set<number>();
  const deduped = tomes
    .sort((a, b) => a.issueNumber - b.issueNumber)
    .filter((t) => {
      if (seen.has(t.issueNumber)) return false;
      seen.add(t.issueNumber);
      return true;
    });

  return { tomes: deduped, totalRecords, truncated: totalRecords > maximumRecords };
}
