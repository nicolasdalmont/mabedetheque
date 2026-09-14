import type { Album, SortKey } from "@/types/album";
import type { WishlistItem } from "@/types/wishlist";

export function compareAlbums(a: Album, b: Album, sortKey: SortKey): number {
  if (sortKey === "series") {
    if (!a.series_name && !b.series_name) return a.title.localeCompare(b.title);
    if (!a.series_name) return -1;
    if (!b.series_name) return 1;
    const seriesCmp = a.series_name.localeCompare(b.series_name);
    if (seriesCmp !== 0) return seriesCmp;
    const aIssue = a.issue_number ?? Infinity;
    const bIssue = b.issue_number ?? Infinity;
    if (aIssue !== bIssue) return aIssue - bIssue;
    return a.title.localeCompare(b.title);
  }
  const av = a[sortKey] ?? "";
  const bv = b[sortKey] ?? "";
  return String(av).localeCompare(String(bv));
}

// WishlistItem has no dedicated `title` for manual entries — falls back to
// `series_name` (always present) so the "title" sort still has something to
// compare on.
export function compareWishlistItems(a: WishlistItem, b: WishlistItem, sortKey: "title" | "series"): number {
  if (sortKey === "series") {
    const seriesCmp = a.series_name.localeCompare(b.series_name);
    if (seriesCmp !== 0) return seriesCmp;
    const aIssue = a.issue_number ?? Infinity;
    const bIssue = b.issue_number ?? Infinity;
    if (aIssue !== bIssue) return aIssue - bIssue;
    return (a.title ?? "").localeCompare(b.title ?? "");
  }
  return (a.title ?? a.series_name).localeCompare(b.title ?? b.series_name);
}
