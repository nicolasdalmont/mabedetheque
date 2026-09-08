"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { AlbumGrid } from "@/components/AlbumGrid";
import { findSeriesGaps } from "@/lib/series-gaps";
import type { Album } from "@/types/album";
import type { FetchSeriesTomesResult } from "@/lib/bnf-series";

type MissingTome = {
  issueNumber: number;
  title?: string;
  isbn?: string;
  publisher?: string;
};

export function SeriesDetailModal({
  seriesName,
  albums,
  ownerId,
  onClose,
}: {
  seriesName: string;
  albums: Album[];
  ownerId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [result, setResult] = useState<FetchSeriesTomesResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<number>>(new Set());

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
  }

  const ownedNumbers = new Set(
    albums.map((a) => a.issue_number).filter((n): n is number => n != null),
  );
  const localGap = findSeriesGaps(albums)[0] ?? null;
  // Any writer already recorded for this series narrows the BnF search to
  // one author-authority record, which is far more complete than a bare
  // text search (verified: an unscoped search for "Lapinot" alone missed
  // most of its tomes; author-scoped found all of them).
  const authorHint = albums.find((a) => a.writer)?.writer ?? null;

  async function handleSearch() {
    setSearching(true);
    setSearchError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ series: seriesName });
      if (authorHint) params.set("author", authorHint);
      const res = await fetch(`/api/series-search?${params}`);
      // A platform-level timeout can return an HTML error page instead of
      // JSON even when the route itself handles its own errors — res.json()
      // on that gives a confusing generic parse error (e.g. Safari's "The
      // string did not match the expected pattern."), so parse defensively
      // and report the real symptom instead.
      const data = await res.json().catch(() => null);
      if (!data) throw new Error("Réponse invalide du serveur — réessayez.");
      if (!res.ok) throw new Error(data.error ?? "Recherche impossible.");
      setResult(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddToWishlist(tome: MissingTome) {
    const { error } = await getDataClient()
      .from("wishlist_items")
      .insert({
        owner_id: ownerId,
        series_name: seriesName,
        issue_number: tome.issueNumber,
        title: tome.title ?? null,
        publisher: tome.publisher ?? null,
        isbn: tome.isbn ?? null,
      });
    if (!error) setAddedKeys((prev) => new Set(prev).add(tome.issueNumber));
  }

  const bnfMissing: MissingTome[] = (result?.tomes ?? [])
    .filter((t) => !ownedNumbers.has(t.issueNumber))
    .map((t) => ({ issueNumber: t.issueNumber, title: t.title, isbn: t.isbn, publisher: t.publisher }));

  const addButtonClass =
    "flex items-center gap-1 rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      className="w-full max-w-2xl rounded-lg border border-black/10 bg-white p-0 text-zinc-900 backdrop:bg-black/60 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-medium">
          {seriesName} <span className="text-zinc-500">({albums.length})</span>
        </h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[75vh] overflow-y-auto p-4">
        <AlbumGrid albums={albums} />

        <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
          <h3 className="mb-1 text-sm font-medium">Tomes manquants</h3>

          {localGap ? (
            <p className="mb-3 text-xs text-zinc-500">
              Trous entre les tomes possédés ({localGap.range}) : {localGap.missing}
            </p>
          ) : (
            <p className="mb-3 text-xs text-zinc-500">Aucun trou entre les tomes possédés.</p>
          )}

          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-2 rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Rechercher sur la BnF pour aller plus loin
          </button>
          {!searching && !result && !searchError ? (
            <p className="mt-1 text-[11px] text-zinc-400">
              {authorHint
                ? `Recherche ciblée sur "${authorHint}".`
                : "Aucun scénariste connu pour cette série — recherche moins précise."}
            </p>
          ) : null}
          {searchError ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{searchError}</p>
          ) : null}

          {result ? (
            result.tomes.length === 0 ? (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Aucun tome trouvé sur la BnF pour cette série
                {result.usedAuthor ? "" : " (essayez d'ajouter un scénariste sur un album possédé pour affiner la recherche)"}
                .
              </p>
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-xs text-zinc-500">
                  {result.tomes.length} tome(s) trouvé(s) sur la BnF
                  {result.truncated ? " (liste peut-être incomplète, trop de résultats)" : ""} —{" "}
                  {bnfMissing.length
                    ? `${bnfMissing.length} manquant(s) :`
                    : "tous déjà possédés."}
                </p>
                {bnfMissing.length ? (
                  <ul className="space-y-1.5">
                    {bnfMissing.map((t) => {
                      const added = addedKeys.has(t.issueNumber);
                      return (
                        <li
                          key={t.issueNumber}
                          className="flex items-center justify-between gap-2 rounded-md border border-black/10 px-2 py-1.5 dark:border-white/10"
                        >
                          <span className="text-xs">
                            <span className="font-medium tabular-nums">#{t.issueNumber}</span>{" "}
                            {t.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddToWishlist(t)}
                            disabled={added}
                            className={addButtonClass}
                          >
                            {added ? <Check size={12} /> : <Plus size={12} />}
                            {added ? "Ajouté" : "Ajouter aux achats"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            )
          ) : null}

          {localGap ? (
            <div className="mt-3">
              <p className="mb-2 text-xs text-zinc-500">
                Ajouter directement un trou local aux achats (sans infos BnF) :
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {localGap.missingNumbers.map((n) => {
                  const added = addedKeys.has(n);
                  return (
                    <li key={n}>
                      <button
                        type="button"
                        onClick={() => handleAddToWishlist({ issueNumber: n })}
                        disabled={added}
                        className={addButtonClass}
                      >
                        {added ? <Check size={12} /> : <Plus size={12} />}#{n}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
