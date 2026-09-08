import { XMLParser } from "fast-xml-parser";

// Shared UNIMARC/SRU parsing helpers for the BnF catalogue API — used by
// both the single-ISBN lookup (lib/isbn-providers.ts) and the series/
// collection search (lib/bnf-series.ts).

// `parseTagValue` defaults to true, which silently turns numeric-looking
// element text into a JS number — stripping the leading zero from a UNIMARC
// function code like "070" (Auteur du texte) so it can never match again as
// a string. Every value is read back through String(...) already, so keep
// everything as text and skip the auto-coercion entirely.
export const unimarcParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
});

// Normalizes a UNIMARC datafield's subfields into { code: value[] }.
export function subfields(field: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const arr = Array.isArray(field) ? field : [field];
  for (const f of arr) {
    const sub = (f as { ["mxc:subfield"]?: unknown })?.["mxc:subfield"];
    if (!sub) continue;
    const subs = Array.isArray(sub) ? sub : [sub];
    for (const s of subs) {
      const code = (s as { ["@_code"]?: string })?.["@_code"];
      const value = typeof s === "object" ? (s as { ["#text"]?: unknown })["#text"] : s;
      if (!code || value == null) continue;
      (out[code] ??= []).push(String(value));
    }
  }
  return out;
}

export function findDatafields(record: unknown, tag: string): unknown[] {
  const fields = (record as { ["mxc:datafield"]?: unknown })?.["mxc:datafield"];
  const arr = Array.isArray(fields) ? fields : fields ? [fields] : [];
  return arr.filter((f: unknown) => (f as { ["@_tag"]?: string })?.["@_tag"] === tag);
}

export function datafieldInd2(field: unknown): string | undefined {
  return (field as { ["@_ind2"]?: string })?.["@_ind2"];
}

// Extracts every <srw:record> from a searchRetrieve response into its
// UNIMARC <mxc:record> node, ready for findDatafields()/subfields().
export function parseSruRecords(xml: string): unknown[] {
  const parsed = unimarcParser.parse(xml);
  const record = parsed?.["srw:searchRetrieveResponse"]?.["srw:records"]?.["srw:record"];
  const list = Array.isArray(record) ? record : record ? [record] : [];
  return list
    .map((r) => (r as { ["srw:recordData"]?: { ["mxc:record"]?: unknown } })["srw:recordData"]?.["mxc:record"])
    .filter((r): r is object => Boolean(r));
}

export function sruNumberOfRecords(xml: string): number {
  const parsed = unimarcParser.parse(xml);
  const n = parsed?.["srw:searchRetrieveResponse"]?.["srw:numberOfRecords"];
  return n ? parseInt(String(n), 10) || 0 : 0;
}
