export type Album = {
  id: string;
  owner_id: string;
  isbn: string | null;
  title: string;
  series_name: string | null;
  issue_number: number | null;
  publisher: string | null;
  writer: string | null;
  illustrator: string | null;
  legal_deposit: string | null;
  purchase_date: string | null;
  comment: string | null;
  cover_url: string;
  created_at: string;
  updated_at: string;
};

export type AlbumInput = Omit<
  Album,
  "id" | "owner_id" | "created_at" | "updated_at"
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type SortKey = "title" | "series" | "purchase_date" | "legal_deposit";
export type ViewMode = "grid" | "list";
