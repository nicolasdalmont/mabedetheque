"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, Plus, Check, Loader2, ShoppingCart } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { AlbumCard } from "@/components/AlbumCard";
import { findSeriesGaps } from "@/lib/series-gaps";
import type { Album } from "@/types/album";
import type { FetchSeriesTomesResult } from "@/lib/bnf-series";

type WishlistTome = { issue_number: number | null; title: string | null };

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
  wishlistTomes,
  onClose,
}: {
  seriesName: string;
  albums: Album[];
  ownerId: string;
  /** Tomes of this series already on the achats list. */
  wishlistTomes?: WishlistTome[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [result, setResult] = useState<FetchSeriesTomesResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<number>>(new Set());

  const wishlistNumbers = new Set(
    (wishlistTomes ?? [])
      .map((w) => w.issue_number)
      .filter((n): n is number => n != null),
  );
  // "Already offered" = on the wishlist already, or added during this modal.
  const isQueued = (n: number) => wishlistNumbers.has(n) || addedKeys.has(n);

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

  // Owned albums + ghost vignettes for tomes on the achats list (from the
  // wishlist, plus anything added during this modal session), interleaved in
  // tome order so wishlist entries sit in their natural place in the series
  // sequence. Wishlist tomes already owned aren't ghosted.
  const wantedNumbers = new Set<number>();
  const wantedTomes: { n: number | null; title: string | null }[] = [];
  for (const w of wishlistTomes ?? []) {
    if (w.issue_number != null && ownedNumbers.has(w.issue_number)) continue;
    if (w.issue_number != null) wantedNumbers.add(w.issue_number);
    wantedTomes.push({ n: w.issue_number, title: w.title });
  }
  for (const n of addedKeys) {
    if (ownedNumbers.has(n) || wantedNumbers.has(n)) continue;
    wantedNumbers.add(n);
    wantedTomes.push({ n, title: null });
  }
  const gridItems: (
    | { type: "owned"; album: Album; sort: number }
    | { type: "wanted"; n: number | null; title: string | null; sort: number }
  )[] = [
    ...albums.map((a) => ({
      type: "owned" as const,
      album: a,
      sort: a.issue_number ?? Number.MAX_SAFE_INTEGER,
    })),
    ...wantedTomes.map((w) => ({
      type: "wanted" as const,
      n: w.n,
      title: w.title,
      sort: w.n ?? Number.MAX_SAFE_INTEGER,
    })),
  ].sort((a, b) => a.sort - b.sort);
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
      className="m-0 flex h-dvh max-h-none w-full max-w-none flex-col bg-white p-0 text-zinc-900 backdrop:bg-black/60 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-lg sm:border sm:border-black/10 dark:bg-zinc-950 dark:text-zinc-50 sm:dark:border-white/10"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-medium">
          {seriesName}{" "}
          <span className="text-zinc-500">
            ({albums.length}
            {wantedTomes.length ? ` · ${wantedTomes.length} souhaité${wantedTomes.length > 1 ? "s" : ""}` : ""})
          </span>
        </h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          className="-m-2 inline-flex min-h-9 min-w-9 items-center justify-center rounded text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
          {gridItems.map((item, i) =>
            item.type === "owned" ? (
              <AlbumCard key={item.album.id} album={item.album} />
            ) : (
              <div
                key={`wanted-${item.n ?? `x${i}`}`}
                className="flex flex-col overflow-hidden rounded-lg border border-dashed border-yellow-400/70 bg-yellow-400/5"
                title="Tome sur la liste d'achats"
              >
                <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                  <ShoppingCart size={20} className="text-yellow-500" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5 p-1.5 sm:p-2">
                  <span className="truncate text-xs font-medium text-zinc-500 sm:text-sm">
                    {item.title || "Tome à acheter"}
                  </span>
                  <span className="text-[11px] text-yellow-600 sm:text-xs dark:text-yellow-400">
                    {item.n != null ? `#${item.n} · ` : ""}Dans les achats
                  </span>
                </div>
              </div>
            ),
          )}
        </div>

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
            <p className="mt-1 text-[11px] text-zinc-500">
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
                      const queued = isQueued(t.issueNumber);
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
                            disabled={queued}
                            className={addButtonClass}
                          >
                            {queued ? <Check size={12} /> : <Plus size={12} />}
                            {queued ? "Dans les achats" : "Ajouter aux achats"}
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
                  const queued = isQueued(n);
                  return (
                    <li key={n}>
                      <button
                        type="button"
                        onClick={() => handleAddToWishlist({ issueNumber: n })}
                        disabled={queued}
                        className={addButtonClass}
                      >
                        {queued ? <Check size={12} /> : <Plus size={12} />}#{n}
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
