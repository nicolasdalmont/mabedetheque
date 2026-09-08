import { subfields, findDatafields, parseSruRecords } from "./unimarc";
import { extractImprint, contributorsByFunction, WRITER_FUNCTION } from "./isbn-providers";

// Free-text BnF search by title and/or series — for finding a specific
// album to add when its ISBN isn't at hand (no barcode, or a used copy
// with a mismatched/missing one). Unlike lib/bnf-series.ts (which enumerates
// every tome of an already-known series), this returns a short list of
// individual-record candidates for a human to pick from; text search is
// inherently noisy (bib.title matches "all words present", not a phrase),
// so precision comes from the picker, not the query.

const BNF_SRU_URL = "http://catalogue.bnf.fr/api/SRU";

export type TextSearchCandidate = {
  isbn?: string;
  title: string;
  series_name?: string;
  issue_number?: number;
  publisher?: string;
  writer?: string;
};

export async function searchBnfByText(params: {
  title?: string;
  series?: string;
}): Promise<TextSearchCandidate[]> {
  const title = params.title?.trim();
  const series = params.series?.trim();
  if (!title && !series) return [];

  const clauses = ['(bib.recordtype any "mon")'];
  if (title) clauses.push(`(bib.title all "${title.replace(/"/g, '\\"')}")`);
  if (series) clauses.push(`(bib.anywhere all "${series.replace(/"/g, '\\"')}")`);

  const url = new URL(BNF_SRU_URL);
  url.searchParams.set("version", "1.2");
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("query", clauses.join(" and "));
  url.searchParams.set("recordSchema", "unimarcxchange");
  url.searchParams.set("maximumRecords", "25");

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const xml = await res.text();
  const records = parseSruRecords(xml);

  const candidates: TextSearchCandidate[] = [];
  for (const marc of records) {
    const f200 = subfields(findDatafields(marc, "200")[0]);
    const recordTitle = f200.a?.[0];
    if (!recordTitle) continue;
    const f225 = subfields(findDatafields(marc, "225")[0]);
    const f010 = subfields(findDatafields(marc, "010")[0]);
    const fImprint = extractImprint(marc);
    const writers = contributorsByFunction(marc, WRITER_FUNCTION);
    const issueRaw = f225.v?.[0];

    candidates.push({
      isbn: f010.a?.[0],
      title: recordTitle,
      series_name: f225.a?.[0]?.replace(/[.,]\s*$/, ""),
      issue_number: issueRaw ? parseInt(issueRaw.replace(/[^0-9]/g, ""), 10) || undefined : undefined,
      publisher: fImprint.c?.[0],
      writer: writers.length ? writers.join(", ") : undefined,
    });
  }
  return candidates;
}
