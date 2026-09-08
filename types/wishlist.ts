export type WishlistStatus = "a_acheter" | "achete";

export type WishlistItem = {
  id: string;
  owner_id: string;
  series_name: string;
  issue_number: number | null;
  title: string | null;
  publisher: string | null;
  isbn: string | null;
  cover_url: string | null;
  status: WishlistStatus;
  created_at: string;
  updated_at: string;
};

export const WISHLIST_STATUS_LABEL: Record<WishlistStatus, string> = {
  a_acheter: "À acheter",
  achete: "Acheté",
};
