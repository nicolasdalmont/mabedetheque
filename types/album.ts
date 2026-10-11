import type { Idea } from "./idea";

export type SaleStatus = "none" | "a_vendre" | "vendu";

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  none: "Non concerné",
  a_vendre: "À vendre",
  vendu: "Vendu",
};

export type Album = {
  id: string;
  owner_id: string;
  isbn: string | null;
  title: string;
  series_name: string | null;
  issue_number: number | null;
  publisher: string | null;
  collection: string | null;
  writer: string | null;
  illustrator: string | null;
  legal_deposit: string | null;
  purchase_date: string | null;
  comment: string | null;
  cover_url: string;
  is_integrale: boolean;
  is_hors_serie: boolean;
  /** Tag « achat » : album souhaité, pas encore dans la collection. */
  is_wishlist: boolean;
  sale_status: SaleStatus;
  created_at: string;
  updated_at: string;
};

// sale_status and is_wishlist are deliberately excluded — managed by their own
// dedicated actions (edit page / Vente tab, Achats tab / "add a purchase"
// entry point), not the general add/edit form.
export type AlbumInput = Omit<
  Album,
  "id" | "owner_id" | "created_at" | "updated_at" | "sale_status" | "is_wishlist"
>;

// Minimal Database shape for the Neon Data API client (PostgREST-generated
// types would normally cover this; hand-written here since we don't run
// codegen against the live project yet).
export type Database = {
  public: {
    Tables: {
      albums: {
        Row: Album;
        Insert: Partial<Album> &
          Pick<Album, "title" | "cover_url" | "owner_id">;
        Update: Partial<Album>;
      };
      ideas: {
        Row: Idea;
        Insert: Partial<Idea> & Pick<Idea, "content" | "owner_id">;
        Update: Partial<Idea>;
      };
      account_flags: {
        Row: {
          user_id: string;
          must_change_password: boolean;
          last_seen_at: string | null;
          updated_at: string;
        };
        Insert: { user_id: string; must_change_password?: boolean };
        Update: { must_change_password?: boolean };
      };
    };
    Views: Record<string, never>;
    Functions: {
      flag_password_change: {
        Args: { target_user_id: string };
        Returns: void;
      };
      touch_last_seen: { Args: Record<string, never>; Returns: void };
      admin_account_stats: {
        Args: Record<string, never>;
        Returns: { user_id: string; album_count: number; last_seen_at: string | null }[];
      };
    };
  };
};

export type SortKey = "title" | "series" | "purchase_date" | "legal_deposit";
export type ViewMode = "grid" | "list";
