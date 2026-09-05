import type { SortKey, ViewMode } from "@/types/album";

const sortLabels: Record<SortKey, string> = {
  title: "Alphabétique",
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
    "rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      <div className="ml-auto flex overflow-hidden rounded-md border border-black/15 dark:border-white/20">
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}
        >
          Galerie
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}
        >
          Liste
        </button>
      </div>
    </div>
  );
}
