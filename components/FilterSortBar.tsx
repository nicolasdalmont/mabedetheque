import type { SortKey, ViewMode } from "@/types/album";

const sortLabels: Record<SortKey, string> = {
  title: "Alphabétique",
  series: "Série puis tome",
  purchase_date: "Date d'achat",
  legal_deposit: "Dépôt légal",
};

export function FilterSortBar({
  seriesOptions,
  publisherOptions,
  series,
  publisher,
  onSeriesChange,
  onPublisherChange,
  sortKey,
  onSortChange,
  viewMode,
  onViewModeChange,
}: {
  seriesOptions: string[];
  publisherOptions: string[];
  series: string;
  publisher: string;
  onSeriesChange: (value: string) => void;
  onPublisherChange: (value: string) => void;
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
}) {
  const selectClass =
    "w-full rounded-md border border-black/15 bg-transparent px-2 py-2 text-base outline-none focus:border-black/40 sm:w-auto sm:py-1.5 sm:text-sm dark:border-white/20 dark:focus:border-white/50";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <select
        className={selectClass}
        value={series}
        onChange={(e) => onSeriesChange(e.target.value)}
      >
        <option value="">Toutes les séries</option>
        {seriesOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={publisher}
        onChange={(e) => onPublisherChange(e.target.value)}
      >
        <option value="">Tous les éditeurs</option>
        {publisherOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={sortKey}
        onChange={(e) => onSortChange(e.target.value as SortKey)}
      >
        {Object.entries(sortLabels).map(([key, label]) => (
          <option key={key} value={key}>
            Tri : {label}
          </option>
        ))}
      </select>

      <div className="flex overflow-hidden rounded-md border border-black/15 sm:ml-auto dark:border-white/20">
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={`flex-1 px-3 py-2 text-base sm:flex-none sm:py-1.5 sm:text-sm ${viewMode === "grid" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}
        >
          Galerie
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          className={`flex-1 px-3 py-2 text-base sm:flex-none sm:py-1.5 sm:text-sm ${viewMode === "list" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}
        >
          Liste
        </button>
      </div>
    </div>
  );
}
