"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Tag } from "lucide-react";
import type { Album } from "@/types/album";
import { LAST_ALBUM_KEY } from "@/lib/constants";
import { tomeLabel } from "@/lib/format";

export function AlbumCard({ album }: { album: Album }) {
  const [broken, setBroken] = useState(false);

  return (
    <Link
      id={`album-${album.id}`}
      href={`/albums/${album.id}`}
      onClick={() => sessionStorage.setItem(LAST_ALBUM_KEY, album.id)}
      className="group flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {album.sale_status === "a_vendre" ? (
          <span
            title="En vente"
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-black shadow"
          >
            <Tag size={13} aria-hidden="true" />
          </span>
        ) : null}
        {album.is_integrale ? (
          <span
            title="Intégrale"
            className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-black shadow"
          >
            <Layers size={13} aria-hidden="true" />
          </span>
        ) : null}
        {album.cover_url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote, per-user covers
          <img
            src={album.cover_url}
            alt={album.title}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Pas de couverture
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-1.5 sm:p-2">
        <span className="truncate text-xs font-medium sm:text-sm">{album.title}</span>
        {album.series_name ? (
          <span className="truncate text-[11px] text-zinc-500 sm:text-xs">
            {album.series_name}
            {tomeLabel(album.issue_number, album.is_integrale) ? ` ${tomeLabel(album.issue_number, album.is_integrale)}` : ""}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
