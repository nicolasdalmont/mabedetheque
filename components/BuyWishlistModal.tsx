"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { AlbumForm, type AlbumFormValues } from "@/components/AlbumForm";
import type { WishlistItem } from "@/types/wishlist";

/**
 * "Acheté" action for a wishlist item: opens the normal album-creation form
 * pre-filled with whatever the wishlist entry already knows (série, tome,
 * titre, éditeur, ISBN), and on success both creates the album *and*
 * removes the item from the achats list — it isn't wanted anymore, it's
 * owned.
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

  function handleCoverFileSelected(file: File) {
    setCoverFile(file);
    setRemoteCoverUrl(null);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSearchCover(isbn: string) {
    const res = await fetch(`/api/isbn/${encodeURIComponent(isbn)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Recherche impossible.");
    if (!data.cover_url) throw new Error("Aucune couverture trouvée pour cet ISBN.");
    setCoverFile(null);
    setRemoteCoverUrl(data.cover_url);
    setCoverPreview(data.cover_url);
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

  const initial: Partial<AlbumFormValues> = {
    series_name: item.series_name,
    issue_number: item.issue_number,
    title: item.title ?? "",
    publisher: item.publisher,
    isbn: item.isbn ?? "",
  };

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
        <h2 className="text-sm font-medium">Marquer comme acheté</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[80vh] overflow-y-auto p-4">
        <p className="mb-3 text-xs text-zinc-500">
          Complétez et enregistrez pour l&apos;ajouter à votre bédéthèque — le tome sera
          automatiquement retiré de la liste d&apos;achats.
        </p>
        <AlbumForm
          initial={initial}
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
