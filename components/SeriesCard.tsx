"use client";

export function SeriesCard({
  name,
  coverUrl,
  count,
  onClick,
}: {
  name: string;
  coverUrl: string | null;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white text-left transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-950"
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote, per-user covers
          <img
            src={coverUrl}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
