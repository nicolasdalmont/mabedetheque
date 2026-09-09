"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";

export function SeriesCard({
  name,
  coverUrl,
  count,
  hasWishlistItem,
  onClick,
}: {
  name: string;
  coverUrl: string | null;
  count: number;
  /** At least one tome of this series is on the achats (wishlist) list. */
  hasWishlistItem?: boolean;
  onClick: () => void;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white text-left transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {hasWishlistItem ? (
          <span
            title="Tome(s) dans les achats"
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-black shadow"
          >
            <ShoppingCart size={13} aria-hidden="true" />
          </span>
        ) : null}
        {coverUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote, per-user covers
          <img
            src={coverUrl}
            alt={name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-400">
            Pas de couverture
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-1.5 sm:p-2">
        <span className="truncate text-xs font-medium sm:text-sm">{name}</span>
        <span className="text-[11px] text-zinc-500 sm:text-xs">
          {count} album{count > 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}
