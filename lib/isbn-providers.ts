import { XMLParser } from "fast-xml-parser";
import type { AlbumInput } from "@/types/album";

export type IsbnLookupResult = Partial<AlbumInput> & { isbn: string };

function onlyDigits(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, "");
}

// ISBN-13 (978-prefixed) -> ISBN-10, needed because BnF's older UNIMARC
// records only carry the ISBN-10 form in field 010$a.
function isbn13to10(isbn13: string): string | null {
  const digits = onlyDigits(isbn13);
  if (digits.length !== 13 || !digits.startsWith("978")) return null;
  const core = digits.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const remainder = (11 - (sum % 11)) % 11;
  const check = remainder === 10 ? "X" : String(remainder);
  return core + check;
}

// `parseTagValue` defaults to true, which silently turns numeric-looking
// element text into a JS number — stripping the leading zero from a UNIMARC
// function code like "070" (Auteur du texte) so it can never match again as
// a string. Every value is read back through String(...) already, so keep
// everything as text and skip the auto-coercion entirely.
const unimarcParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});

// Normalizes a UNIMARC datafield's subfields into { code: value | value[] }.
function subfields(field: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const arr = Array.isArray(field) ? field : [field];
  for (const f of arr) {
    const sub = f?.["mxc:subfield"];
    if (!sub) continue;
    const subs = Array.isArray(sub) ? sub : [sub];
    for (const s of subs) {
      const code = s?.["@_code"];
      const value = typeof s === "object" ? s["#text"] : s;
      if (!code || value == null) continue;
      (out[code] ??= []).push(String(value));
    }
  }
  return out;
}

function findDatafields(record: unknown, tag: string): unknown[] {
  const fields = (record as { ["mxc:datafield"]?: unknown })?.["mxc:datafield"];
  const arr = Array.isArray(fields) ? fields : fields ? [fields] : [];
  return arr.filter((f: unknown) => (f as { ["@_tag"]?: string })?.["@_tag"] === tag);
}

// UNIMARC codes the BnF's own function ($4) subfield to say what a listed
// contributor actually did — 070 "Auteur du texte" (scenarist/writer), 440
// "Illustrateur" — regardless of which tag (700/701/702/703) their name
// happens to sit in. Trusting the tag number instead of $4 breaks e.g. on
// adaptations, where a 702 can carry the *original novel's* author (tagged
// with a different function) rather than the BD's illustrator.
const WRITER_FUNCTION = "070";
const ILLUSTRATOR_FUNCTION = "440";

function contributorsByFunction(marc: unknown, functionCode: string): string[] {
  const fields = ["700", "701", "702", "703"].flatMap((tag) => findDatafields(marc, tag));
  const names: string[] = [];
  for (const field of fields) {
    const sf = subfields(field);
    if (sf["4"]?.[0] !== functionCode) continue;
    const name = [sf.a?.[0], sf.b?.[0]].filter(Boolean).join(" ");
    if (name) names.push(name);
  }
  return names;
}

async function lookupBnf(isbn: string): Promise<IsbnLookupResult | null> {
  const candidates = [onlyDigits(isbn)];
  const isbn10 = isbn13to10(isbn);
  if (isbn10) candidates.push(isbn10);

  for (const candidate of candidates) {
    const url = new URL("http://catalogue.bnf.fr/api/SRU");
    url.searchParams.set("version", "1.2");
    url.searchParams.set("operation", "searchRetrieve");
    url.searchParams.set("query", `bib.isbn all "${candidate}"`);
    url.searchParams.set("recordSchema", "unimarcxchange");
    url.searchParams.set("maximumRecords", "1");

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) continue;
    const xml = await res.text();
    const parsed = unimarcParser.parse(xml);
    const record =
      parsed?.["srw:searchRetrieveResponse"]?.["srw:records"]?.["srw:record"];
    const single = Array.isArray(record) ? record[0] : record;
    const marc = single?.["srw:recordData"]?.["mxc:record"];
    if (!marc) continue;

    const f200 = subfields(findDatafields(marc, "200")[0]);
    const f225 = subfields(findDatafields(marc, "225")[0]);

    // Imprint (publisher + date): legacy field 210, or its UNIMARC successor
    // 214, which BnF has been using for records catalogued roughly since the
    // 2010s. Field 214 can repeat (publication / manufacture / copyright,
    // distinguished by ind2), so prefer the "Publication" occurrence
    // (ind2 "0") and only fall back to whichever comes first.
    const f210raw = findDatafields(marc, "210")[0];
    const f214candidates = findDatafields(marc, "214");
    const f214raw =
      f214candidates.find((f) => (f as { ["@_ind2"]?: string })?.["@_ind2"] === "0") ??
      f214candidates[0];
    const fImprint = subfields(f210raw ?? f214raw);

    const title = f200.a?.[0];
    if (!title) continue;

    const writerNames = contributorsByFunction(marc, WRITER_FUNCTION);
    const illustratorNames = contributorsByFunction(marc, ILLUSTRATOR_FUNCTION);
    const writer = writerNames.length ? writerNames.join(", ") : undefined;
    // BnF tags a separate "illustrateur" only when the artist differs from
    // the writer; a solo-authored album (writer *and* illustrator) is
    // recorded as a single "auteur du texte" entry with no 440 at all. Mirror
    // that single writer back onto illustrator rather than leaving it blank.
    const illustrator = illustratorNames.length
      ? illustratorNames.join(", ")
      : writerNames.length === 1
        ? writerNames[0]
        : undefined;

    return {
      isbn,
      title,
      series_name: f225.a?.[0]?.replace(/[.,]\s*$/, ""),
      issue_number: f225.v?.[0] ? parseInt(f225.v[0], 10) || undefined : undefined,
      publisher: fImprint.c?.[0],
      legal_deposit: fImprint.d?.[0],
      writer,
      illustrator,
    };
  }

  return null;
}

type GoogleBooksItem = {
  volumeInfo?: {
    title?: string;
    publisher?: string;
    authors?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

async function lookupGoogleBooksCover(isbn: string): Promise<string | null> {
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", `isbn:${onlyDigits(isbn)}`);
    if (key) url.searchParams.set("key", key);

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: GoogleBooksItem[] };
    const links = data.items?.[0]?.volumeInfo?.imageLinks;
    const cover = links?.thumbnail ?? links?.smallThumbnail;
    // Google serves http by default; force https to avoid mixed content.
    return cover ? cover.replace(/^http:/, "https:") : null;
  } catch {
    return null;
  }
}

async function lookupOpenLibraryCover(isbn: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${onlyDigits(isbn)}-L.jpg`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Open Library returns a tiny placeholder (~a few hundred bytes) when it
    // has no cover for the ISBN; treat anything under 1KB as "no cover".
    if (buf.byteLength < 1000) return null;
    return url;
  } catch {
    return null;
  }
}

export async function lookupIsbn(isbn: string): Promise<IsbnLookupResult | null> {
  const [bnf, googleCover, openLibraryCover] = await Promise.allSettled([
    lookupBnf(isbn),
    lookupGoogleBooksCover(isbn),
    lookupOpenLibraryCover(isbn),
  ]);

  const base = bnf.status === "fulfilled" ? bnf.value : null;
  const cover =
    (googleCover.status === "fulfilled" ? googleCover.value : null) ??
    (openLibraryCover.status === "fulfilled" ? openLibraryCover.value : null);

  if (!base && !cover) return null;

  return {
    isbn,
    title: base?.title ?? "",
    series_name: base?.series_name,
    issue_number: base?.issue_number,
    publisher: base?.publisher,
    writer: base?.writer,
    illustrator: base?.illustrator,
    legal_deposit: base?.legal_deposit,
    cover_url: cover ?? undefined,
  } as IsbnLookupResult;
}
