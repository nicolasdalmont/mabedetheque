"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { AlbumGrid } from "@/components/AlbumGrid";
import { findSeriesGaps } from "@/lib/series-gaps";
import type { Album } from "@/types/album";
import type { BnfCollectionCandidate, BnfTome } from "@/lib/bnf-series";

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

  const [candidates, setCandidates] = useState<BnfCollectionCandidate[] | null>(null);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [bnfTomes, setBnfTomes] = useState<BnfTome[] | null>(null);
  const [loadingTomes, setLoadingTomes] = useState(false);
  const [tomesError, setTomesError] = useState<string | null>(null);

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

  async function handleSearchCandidates() {
    setSearchingCandidates(true);
    setCandidatesError(null);
    setCandidates(null);
    setSelectedIds(new Set());
    setBnfTomes(null);
    try {
      const res = await fetch(`/api/series-search?q=${encodeURIComponent(seriesName)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Recherche impossible.");
      setCandidates(data.candidates ?? []);
    } catch (err) {
      setCandidatesError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSearchingCandidates(false);
    }
  }

  function toggleCandidate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFetchTomes() {
    if (!selectedIds.size) return;
    setLoadingTomes(true);
    setTomesError(null);
    setBnfTomes(null);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/series-search/tomes?collectionId=${encodeURIComponent(id)}`).then((r) =>
            r.json(),
          ),
        ),
      );
      const merged = new Map<number, BnfTome>();
      for (const r of results) {
        for (const t of r.tomes ?? []) {
          if (!merged.has(t.issueNumber)) merged.set(t.issueNumber, t);
        }
      }
      if (merged.size === 0) {
        setTomesError(
          "Aucun tome numéroté trouvé pour cette sélection — essayez d'autres collections ci-dessus.",
        );
      }
      setBnfTomes(Array.from(merged.values()).sort((a, b) => a.issueNumber - b.issueNumber));
    } catch {
      setTomesError("Recherche des tomes impossible.");
    } finally {
      setLoadingTomes(false);
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

  const bnfMissing: MissingTome[] = (bnfTomes ?? [])
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
            <p className="mb-3 text-xs text-zinc-500">
              Aucun trou entre les tomes possédés.
            </p>
          )}

          <button
            type="button"
            onClick={handleSearchCandidates}
            disabled={searchingCandidates}
            className="flex items-center gap-2 rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
          >
            {searchingCandidates ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Rechercher sur la BnF pour aller plus loin
          </button>
          {candidatesError ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{candidatesError}</p>
          ) : null}

          {candidates ? (
            candidates.length ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-zinc-500">
                  Une série peut correspondre à plusieurs collections BnF (éditeurs/rééditions
                  différents) — cochez celles qui semblent correspondre à vos éditions, la BnF ne
                  garantit pas de résultat pour chacune.
                </p>
                <ul className="max-h-48 divide-y divide-black/5 overflow-y-auto rounded-md border border-black/10 dark:divide-white/10 dark:border-white/10">
                  {candidates.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleCandidate(c.id)}
                        className="mt-1"
                      />
                      <label className="text-xs">
                        <span className="font-medium">{c.title}</span>
                        <br />
                        <span className="text-zinc-500">
                          {[c.publisher, c.place, c.dateRange, c.language].filter(Boolean).join(" · ")}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleFetchTomes}
                  disabled={!selectedIds.size || loadingTomes}
                  className="flex items-center gap-2 rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-medium text-black hover:bg-yellow-300 disabled:opacity-50"
                >
                  {loadingTomes ? <Loader2 size={14} className="animate-spin" /> : null}
                  Voir les tomes de la sélection ({selectedIds.size})
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Aucune collection trouvée sur la BnF.</p>
            )
          ) : null}

          {tomesError ? (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{tomesError}</p>
          ) : null}

          {bnfTomes && bnfTomes.length ? (
            <div className="mt-3">
              <p className="mb-2 text-xs text-zinc-500">
                {bnfMissing.length
                  ? `${bnfMissing.length} tome(s) manquant(s) trouvé(s) (au-delà des trous locaux) :`
                  : "Tous les tomes trouvés sur la BnF sont déjà possédés."}
              </p>
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
            </div>
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
