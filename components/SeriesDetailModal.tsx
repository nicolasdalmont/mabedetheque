"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { AlbumCard } from "@/components/AlbumCard";
import { useToast } from "@/components/Toast";
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
  onChanged,
  onClose,
}: {
  seriesName: string;
  /** Owned albums and achat-tagged ones (`is_wishlist`) of this series. */
  albums: Album[];
  ownerId: string;
  /** Called after an achat is created so the parent can refetch. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const { error: toastError } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [result, setResult] = useState<FetchSeriesTomesResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<number>>(new Set());

  const ownedAlbums = albums.filter((a) => !a.is_wishlist);
  const wishlistAlbums = albums.filter((a) => a.is_wishlist);
  const wishlistNumbers = new Set(
    wishlistAlbums.map((a) => a.issue_number).filter((n): n is number => n != null),
  );
  // "Already offered" = on the achats list already, or added during this modal.
  const isQueued = (n: number) => wishlistNumbers.has(n) || addedKeys.has(n);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
  }

  const ownedNumbers = new Set(
    ownedAlbums.map((a) => a.issue_number).filter((n): n is number => n != null),
  );
  const localGap = findSeriesGaps(ownedAlbums)[0] ?? null;
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
      .from("albums")
      .insert({
        owner_id: ownerId,
        title: tome.title || `${seriesName} #${tome.issueNumber}`,
        series_name: seriesName,
        issue_number: tome.issueNumber,
        publisher: tome.publisher ?? null,
        isbn: tome.isbn ?? null,
        cover_url: "",
        is_wishlist: true,
      });
    if (error) {
      toastError(error.message);
      return;
    }
    setAddedKeys((prev) => new Set(prev).add(tome.issueNumber));
    onChanged();
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
            ({ownedAlbums.length}
            {wishlistAlbums.length ? ` · ${wishlistAlbums.length} souhaité${wishlistAlbums.length > 1 ? "s" : ""}` : ""})
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
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
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
