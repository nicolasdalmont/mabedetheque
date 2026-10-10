"use client";

import { useState } from "react";
import type { Album } from "@/types/album";

/** Small cover thumbnail for list rows (Achats, Ventes). */
export function AlbumThumb({ album }: { album: Album }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex aspect-[2/3] w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
      {album.cover_url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote, per-user covers
        <img
          src={album.cover_url}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : null}
    </div>
  );
}
