// Placeholder grid shown while albums / series load — same shape as the
// real card grid, so the layout doesn't jump when the data arrives.
export function CardGridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
        >
          <div className="aspect-[2/3] w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-1.5 p-1.5 sm:p-2">
            <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-2.5 w-3/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
