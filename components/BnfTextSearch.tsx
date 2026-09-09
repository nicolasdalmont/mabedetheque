"use client";

import { useState } from "react";
import type { TextSearchCandidate } from "@/lib/bnf-text-search";

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400";

/**
 * Free-text fallback for when the ISBN isn't at hand: search by title
 * and/or series, pick the right result from the (possibly noisy) list.
 * Selecting a candidate is the caller's job (they own the target form).
 */
export function BnfTextSearch({
  onSelect,
  excludeCandidate,
}: {
  onSelect: (candidate: TextSearchCandidate) => void;
  /** When it returns true for a result, that result is hidden — e.g. a tome
   * already in the collection, not worth offering again. */
  excludeCandidate?: (candidate: TextSearchCandidate) => boolean;
}) {
  const [title, setTitle] = useState("");
  const [series, setSeries] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TextSearchCandidate[] | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  async function handleSearch() {
    if (!title.trim() && !series.trim()) return;
    setSearching(true);
    setError(null);
    setCandidates(null);
    setHiddenCount(0);
    try {
      const params = new URLSearchParams();
      if (title.trim()) params.set("title", title.trim());
      if (series.trim()) params.set("series", series.trim());
      const res = await fetch(`/api/text-search?${params}`);
      const data = await res.json().catch(() => null);
      if (!data) throw new Error("Réponse invalide du serveur — réessayez.");
      if (!res.ok) throw new Error(data.error ?? "Recherche impossible.");
      const all: TextSearchCandidate[] = data.candidates ?? [];
      const visible = excludeCandidate ? all.filter((c) => !excludeCandidate(c)) : all;
      setCandidates(visible);
      setHiddenCount(all.length - visible.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
      <p className="text-xs font-medium">Pas d&apos;ISBN sous la main ? Cherchez par titre/série</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          autoComplete="off"
          className={inputClass}
        />
        <input
          value={series}
          onChange={(e) => setSeries(e.target.value)}
          placeholder="Série"
          autoComplete="off"
          className={inputClass}
        />
      </div>
      <button
        type="button"
        onClick={handleSearch}
        disabled={searching || (!title.trim() && !series.trim())}
        className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
      >
        {searching ? "Recherche..." : "Rechercher sur la BnF"}
      </button>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      {candidates ? (
        candidates.length ? (
          <ul className="max-h-56 divide-y divide-black/5 overflow-y-auto rounded-md border border-black/10 dark:divide-white/10 dark:border-white/10">
            {candidates.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="block w-full px-2 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="font-medium">{c.title}</span>
                  {c.series_name ? (
                    <span className="text-zinc-500">
                      {" "}
                      — {c.series_name}
                      {c.issue_number != null ? ` #${c.issue_number}` : ""}
                    </span>
                  ) : null}
                  <br />
                  <span className="text-zinc-500">
                    {[c.writer, c.publisher].filter(Boolean).join(" · ") || " "}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">
            {hiddenCount
              ? `Aucun résultat (${hiddenCount} déjà dans la collection, masqué${hiddenCount > 1 ? "s" : ""}).`
              : "Aucun résultat."}
          </p>
        )
      ) : null}
      {candidates && candidates.length && hiddenCount ? (
        <p className="text-[11px] text-zinc-400">
          {hiddenCount} résultat{hiddenCount > 1 ? "s" : ""} déjà dans la collection masqué
          {hiddenCount > 1 ? "s" : ""}.
        </p>
      ) : null}
    </div>
  );
}
