// Case- and accent-insensitive matching for free-text search/filter fields
// (search bars, autocomplete) — "ecole" and "école" should match each other
// either way the user types it.
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
