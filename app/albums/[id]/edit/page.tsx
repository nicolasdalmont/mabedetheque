"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDataClient } from "@/lib/neon-client";
import { AlbumForm, type AlbumFormValues } from "@/components/AlbumForm";
import type { Album, SaleStatus } from "@/types/album";

export default function EditAlbumPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [remoteCoverUrl, setRemoteCoverUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await getDataClient()
        .from("albums")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
      } else {
        setAlbum(data);
        setCoverPreview(data.cover_url);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
    if (!album) return;
    setSaving(true);
    setSaveError(null);

    try {
      let coverUrl = album.cover_url;
      const previousCoverUrl = album.cover_url;

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
      }

      const { error } = await getDataClient()
        .from("albums")
        .update({ ...values, cover_url: coverUrl })
        .eq("id", album.id);
      if (error) throw new Error(error.message);

      if ((coverFile || remoteCoverUrl) && previousCoverUrl !== coverUrl) {
        await fetch("/api/covers", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverUrl: previousCoverUrl }),
        }).catch(() => {});
      }

      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetSaleStatus(status: SaleStatus) {
    if (!album) return;
    setSaleError(null);
    const previous = album.sale_status;
    setAlbum({ ...album, sale_status: status });
    const { error } = await getDataClient().from("albums").update({ sale_status: status }).eq("id", album.id);
    if (error) {
      setAlbum((a) => (a ? { ...a, sale_status: previous } : a));
      setSaleError(error.message);
    }
  }

  async function handleDelete() {
    if (!album) return;
    setDeleting(true);
    try {
      const { error } = await getDataClient()
        .from("albums")
        .delete()
        .eq("id", album.id);
      if (error) throw new Error(error.message);

      await fetch("/api/covers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: album.cover_url }),
      }).catch(() => {});

      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
      setDeleting(false);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>;
  }
  if (loadError || !album) {
    return (
      <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">
        {loadError ?? "Album introuvable."}
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Retour
        </button>
        <h1 className="text-lg font-semibold">Modifier l&apos;album</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
        <span className="text-xs font-medium text-zinc-500">Vente :</span>
        {album.sale_status === "none" ? (
          <button
            type="button"
            onClick={() => handleSetSaleStatus("a_vendre")}
            className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
          >
            Déclarer à vendre
          </button>
        ) : album.sale_status === "a_vendre" ? (
          <>
            <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-medium text-black">
              À vendre
            </span>
            <button
              type="button"
              onClick={() => handleSetSaleStatus("vendu")}
              className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
            >
              Marquer comme vendu
            </button>
            <button
              type="button"
              onClick={() => handleSetSaleStatus("none")}
              className="text-xs text-zinc-500 hover:underline"
            >
              Retirer de la vente
            </button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
              Vendu
            </span>
            <button
              type="button"
              onClick={() => handleSetSaleStatus("a_vendre")}
              className="text-xs text-zinc-500 hover:underline"
            >
              Annuler la vente
            </button>
          </>
        )}
      </div>
      {saleError ? <p className="text-xs text-red-600 dark:text-red-400">{saleError}</p> : null}

      <AlbumForm
        initial={album}
        coverPreview={coverPreview}
        onCoverFileSelected={handleCoverFileSelected}
        onSearchCover={handleSearchCover}
        onSubmit={handleSubmit}
        submitLabel="Enregistrer les modifications"
        pending={saving}
        extraActions={
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Supprimer
          </button>
        }
      />
      {saveError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
      ) : null}

      <dialog
        ref={dialogRef}
        className="rounded-lg border border-black/10 bg-white p-6 text-zinc-900 backdrop:bg-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
      >
        <p className="mb-4 text-sm">
          Supprimer définitivement « {album.title} » et sa couverture ?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
