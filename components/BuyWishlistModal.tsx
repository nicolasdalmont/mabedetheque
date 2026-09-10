"use client";

import { useEffect, useRef, useState } from "react";
import { X, ScanBarcode } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { AlbumForm, type AlbumFormValues } from "@/components/AlbumForm";
import { IsbnScanner } from "@/components/IsbnScanner";
import { BnfTextSearch } from "@/components/BnfTextSearch";
import type { TextSearchCandidate } from "@/lib/bnf-text-search";
import type { WishlistItem } from "@/types/wishlist";

const inputClass =
  "flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400";

/**
 * "Acheté" action for a wishlist item: opens the exact same lookup +
 * add-album experience as the normal "Ajouter un album" page (ISBN
 * search/scan, title/série search, full field + cover prefill) — just
 * pre-seeded with whatever the wishlist entry already knows, and on
 * success both creates the album *and* removes the item from Achats.
 */
export function BuyWishlistModal({
  item,
  ownerId,
  onDone,
  onClose,
}: {
  item: WishlistItem;
  ownerId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [isbnInput, setIsbnInput] = useState(item.isbn ?? "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const [prefill, setPrefill] = useState<Partial<AlbumFormValues>>({
    series_name: item.series_name,
    issue_number: item.issue_number,
    title: item.title ?? "",
    publisher: item.publisher,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [remoteCoverUrl, setRemoteCoverUrl] = useState<string | null>(item.cover_url);
  const [coverPreview, setCoverPreview] = useState<string | null>(item.cover_url);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleClose() {
    dialogRef.current?.close();
  }

  async function handleLookup(isbnOverride?: string) {
    const isbn = isbnOverride ?? isbnInput;
    if (!isbn) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/isbn/${encodeURIComponent(isbn)}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error ?? "Recherche impossible.");
        return;
      }
      setPrefill({
        isbn: data.isbn,
        title: data.title || "",
        series_name: data.series_name ?? null,
        issue_number: data.issue_number ?? null,
        publisher: data.publisher ?? null,
        writer: data.writer ?? null,
        illustrator: data.illustrator ?? null,
        legal_deposit: data.legal_deposit ?? null,
      });
      if (data.cover_url) {
        setRemoteCoverUrl(data.cover_url);
        setCoverPreview(data.cover_url);
        setCoverFile(null);
      }
    } finally {
      setSearching(false);
    }
  }

  function handleScanned(isbn: string) {
    setShowScanner(false);
    setIsbnInput(isbn);
    handleLookup(isbn);
  }

  function handleTextSearchSelect(candidate: TextSearchCandidate) {
    if (candidate.isbn) {
      setIsbnInput(candidate.isbn);
      handleLookup(candidate.isbn);
      return;
    }
    setPrefill({
      isbn: "",
      title: candidate.title,
      series_name: candidate.series_name ?? null,
      issue_number: candidate.issue_number ?? null,
      publisher: candidate.publisher ?? null,
      writer: candidate.writer ?? null,
    });
  }

  async function handleSearchCover(isbn: string) {
    const res = await fetch(`/api/isbn/${encodeURIComponent(isbn)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Recherche impossible.");
    if (!data.cover_url) throw new Error("Aucune couverture trouvée pour cet ISBN.");
    setRemoteCoverUrl(data.cover_url);
    setCoverPreview(data.cover_url);
    setCoverFile(null);
  }

  function handleCoverFileSelected(file: File) {
    setCoverFile(file);
    setRemoteCoverUrl(null);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(values: AlbumFormValues) {
    setSaving(true);
    setSaveError(null);
    try {
      let coverUrl: string;
      if (coverFile) {
        const form = new FormData();
        form.append("file", coverFile);
        const res = await fetch("/api/covers", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Échec de l'upload.");
        coverUrl = data.url;
      } else if (remoteCoverUrl) {
        const res = await fetch("/api/covers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: remoteCoverUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Échec du rapatriement de l'image.");
        coverUrl = data.url;
      } else {
        throw new Error("Une couverture est requise (recherche ISBN ou photo).");
      }

      const { error: insertError } = await getDataClient()
        .from("albums")
        .insert({ ...values, cover_url: coverUrl, owner_id: ownerId });
      if (insertError) throw new Error(insertError.message);

      const { error: deleteError } = await getDataClient()
        .from("wishlist_items")
        .delete()
        .eq("id", item.id);
      if (deleteError) throw new Error(deleteError.message);

      onDone();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

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
        <h2 className="text-sm font-medium">Marquer comme acheté</h2>
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
        <p className="mb-3 text-xs text-zinc-500">
          Complétez et enregistrez pour l&apos;ajouter à votre bédéthèque — le tome sera
          automatiquement retiré de la liste d&apos;achats.
        </p>

        <div className="mb-3 flex gap-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
          <input
            value={isbnInput}
            onChange={(e) => setIsbnInput(e.target.value)}
            placeholder="Saisir ou scanner l'ISBN"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            title="Scanner le code-barres"
            aria-label="Scanner le code-barres"
            className="rounded-md border border-black/15 px-3 py-2 text-black hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5"
          >
            <ScanBarcode size={18} />
          </button>
          <button
            type="button"
            onClick={() => handleLookup()}
            disabled={searching || !isbnInput}
            className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-medium text-black hover:bg-yellow-300 disabled:opacity-50"
          >
            {searching ? "Recherche..." : "Rechercher"}
          </button>
        </div>
        {searchError ? (
          <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
            {searchError} Vous pouvez continuer en saisie manuelle ci-dessous.
          </p>
        ) : null}
        {showScanner ? (
          <IsbnScanner onDetected={handleScanned} onClose={() => setShowScanner(false)} />
        ) : null}

        <div className="mb-3">
          <BnfTextSearch onSelect={handleTextSearchSelect} />
        </div>

        <AlbumForm
          initial={{ isbn: isbnInput, ...prefill }}
          coverPreview={coverPreview}
          onCoverFileSelected={handleCoverFileSelected}
          onSearchCover={handleSearchCover}
          onSubmit={handleSubmit}
          submitLabel="Ajouter à ma bédéthèque"
          pending={saving}
        />
        {saveError ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>
        ) : null}
      </div>
    </dialog>
  );
}
