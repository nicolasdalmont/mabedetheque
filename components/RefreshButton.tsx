"use client";

import { RefreshCw } from "lucide-react";

// Explicit refresh — the counterpart to pull-to-refresh for desktop / any
// context without a browser reload affordance (installed PWA).
export function RefreshButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      title="Actualiser"
      aria-label="Actualiser"
      className="shrink-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    >
      <RefreshCw size={18} aria-hidden="true" />
    </button>
  );
}
