import Link from "next/link";
import type { Album } from "@/types/album";

export function AlbumCard({ album }: { album: Album }) {
  return (
    <Link
      href={`/albums/${album.id}/edit`}
      className="group flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950"
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote, per-user covers */}
        <img
          src={album.cover_url}
          alt={album.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <span className="truncate text-sm font-medium">{album.title}</span>
        {album.series_name ? (
          <span className="truncate text-xs text-zinc-500">
            {album.series_name}
            {album.issue_number ? ` #${album.issue_number}` : ""}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
