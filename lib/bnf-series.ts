import { subfields, findDatafields, parseSruRecords, sruNumberOfRecords } from "./unimarc";
import { extractImprint } from "./isbn-providers";

// On-demand BnF series lookup — separate from the per-ISBN lookup in
// isbn-providers.ts. Finds every individual tome of a series directly,
// rather than going through a "collection éditoriale" authority record: an
// earlier version searched bib.serialtitle for the collection notice and
// used bib.col2bib to list its members, but that back-link turned out to be
// populated on only a small minority of collection records — verified
// empirically as returning zero linked records for every French-language
// candidate tried on two different series (Astérix: 3/4 tested returned
// nothing; Lapinot: 4/4 returned nothing). Searching individual monograph
// records directly and matching their own field 225 (collection/series
// title) against the target name is both simpler and far more reliable.

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

const STOPWORDS = new Set(["le", "la", "les", "l", "un", "une", "des", "de", "du", "d", "et", "au", "aux"]);

function significantWords(title: string): Set<string> {
  // Drop the parentheses themselves but keep their content as ordinary
  // words — a "(...)" suffix in our own series_name is either a reorderable
  // article ("Lapinot (Les formidables aventures de)") or an author
  // disambiguation suffix ("Azimut (Lupano/Andréae)"); either way its words
  // matter for matching, and the final comparison is an unordered set so
  // there's no need to actually reposition them.
  const words = title
    .replace(/[()]/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w));
  return new Set(words);
}

// Our own series_name follows a "Core (Le/La/Les/Author...)" cataloguing
// convention for alphabetical sorting that BnF's own field 225 never uses —
// verified: comparing "Lapinot (Les formidables aventures de)" against
// BnF's actual "Les formidables aventures de Lapinot" as plain strings
// (even reordering-normalized) never matches, silently rejecting every
// tome. Compare on significant words instead, ignoring stopwords/parens,
// accepting a subset match either way — combined with the author-name
// search restriction below, this stays precise in practice without having
// to fully reverse-engineer every cataloguing convention variant (some
// parens are a reorderable article, some an author-disambiguation suffix,
// some both at once).
function seriesTitlesMatch(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (!wa.size || !wb.size) return false;
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  for (const w of small) if (!big.has(w)) return false;
  return true;
}

export type BnfTome = {
  title: string;
  issueNumber: number;
  isbn?: string;
  publisher?: string;
};

export type FetchSeriesTomesResult = {
  tomes: BnfTome[];
  totalRecords: number;
  truncated: boolean;
  usedAuthor: boolean;
};

// `authorName` narrows the search to one BnF author-authority record (far
// more precise/complete — see the Lapinot case above, an "anywhere" search
// for the bare series name alone found only 4 of the ~9 real tomes, against
// an author-scoped search finding all of them). Pass the writer of any
// already-owned album in the series; falls back to an unrestricted text
// search when none is known, which is less complete but still usable.
export async function fetchSeriesTomes(
  seriesName: string,
  authorName: string | null,
): Promise<FetchSeriesTomesResult> {
  const maximumRecords = 300;

  const escapedSeries = seriesName.replace(/"/g, '\\"');
  const clauses = ['(bib.recordtype any "mon")'];
  const usedAuthor = Boolean(authorName?.trim());
  if (usedAuthor) {
    clauses.push(`(bib.author all "${authorName!.trim().replace(/"/g, '\\"')}")`);
  } else {
    clauses.push(`(bib.anywhere all "${escapedSeries}")`);
  }

  const url = sruQuery(clauses.join(" and "), maximumRecords);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { tomes: [], totalRecords: 0, truncated: false, usedAuthor };
  const xml = await res.text();
  const records = parseSruRecords(xml);
  const totalRecords = sruNumberOfRecords(xml);

  const tomes: BnfTome[] = [];
  for (const marc of records) {
    const f225 = subfields(findDatafields(marc, "225")[0]);
    const seriesTitle = f225.a?.[0];
    if (!seriesTitle || !seriesTitlesMatch(seriesName, seriesTitle)) continue;
    const issueRaw = f225.v?.[0];
    if (!issueRaw) continue;
    const issueNumber = parseInt(issueRaw.replace(/[^0-9]/g, ""), 10);
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

  return { tomes: deduped, totalRecords, truncated: totalRecords > maximumRecords, usedAuthor };
}
