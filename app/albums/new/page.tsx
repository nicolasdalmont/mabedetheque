"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDataClient } from "@/lib/neon-client";
import { useSession } from "@/hooks/useSession";
import { AlbumForm, type AlbumFormValues } from "@/components/AlbumForm";

export default function NewAlbumPage() {
  const router = useRouter();
  const { user } = useSession();

  const [isbnInput, setIsbnInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [prefill, setPrefill] = useState<Partial<AlbumFormValues>>({});
  const [remoteCoverUrl, setRemoteCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  async function handleLookup() {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/isbn/${encodeURIComponent(isbnInput)}`);
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

  function handleCoverFileSelected(file: File) {
    setCoverFile(file);
    setRemoteCoverUrl(null);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(values: AlbumFormValues) {
    if (!user) return;
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

      const { error } = await getDataClient().from("albums").insert({
        ...values,
        cover_url: coverUrl,
        owner_id: user.id,
      });
      if (error) throw new Error(error.message);

      router.push("/");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Retour
        </Link>
        <h1 className="text-lg font-semibold">Ajouter un album</h1>
      </div>

      <div className="flex gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <input
          value={isbnInput}
          onChange={(e) => setIsbnInput(e.target.value)}
          placeholder="Saisir ou scanner l'ISBN"
          autoComplete="off"
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 sm:text-sm dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={searching || !isbnInput}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {searching ? "Recherche..." : "Rechercher"}
        </button>
      </div>
      {searchError ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {searchError} Vous pouvez continuer en saisie 100% manuelle ci-dessous.
        </p>
      ) : null}

      <AlbumForm
        initial={{ isbn: isbnInput, ...prefill }}
        coverPreview={coverPreview}
        onCoverFileSelected={handleCoverFileSelected}
        onSubmit={handleSubmit}
        submitLabel="Enregistrer l'album"
        pending={saving}
      />
      {saveError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
      ) : null}
    </div>
  );
}
