"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { useSession } from "@/hooks/useSession";
import { AlbumForm, type AlbumFormValues } from "@/components/AlbumForm";
import { AppHeader } from "@/components/AppHeader";
import { IsbnScanner } from "@/components/IsbnScanner";
import { BnfTextSearch } from "@/components/BnfTextSearch";
import { useToast } from "@/components/Toast";
import type { TextSearchCandidate } from "@/lib/bnf-text-search";

export default function NewAlbumPage() {
  const router = useRouter();
  const { user } = useSession();
  const { success } = useToast();

  const [isbnInput, setIsbnInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [prefill, setPrefill] = useState<Partial<AlbumFormValues>>({});
  const [remoteCoverUrl, setRemoteCoverUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

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
      // Has an ISBN: chain through the normal ISBN lookup to also get the
      // cover and any field the lightweight text-search result skipped.
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

      success(`« ${values.title} » ajouté à votre bédéthèque.`);
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <AppHeader />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-2 inline-flex min-h-9 items-center rounded px-2 text-sm text-zinc-500 hover:underline"
        >
          ← Retour
        </button>
        <h1 className="text-lg font-semibold">Ajouter un album</h1>
      </div>

      <div className="flex gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <input
          value={isbnInput}
          onChange={(e) => setIsbnInput(e.target.value)}
          placeholder="Saisir ou scanner l'ISBN"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
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
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {searchError} Vous pouvez continuer en saisie 100% manuelle ci-dessous.
        </p>
      ) : null}
      {showScanner ? (
        <IsbnScanner onDetected={handleScanned} onClose={() => setShowScanner(false)} />
      ) : null}

      {Object.keys(prefill).length > 0 ? (
        <details className="[&_summary]:marker:text-zinc-500">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Pas le bon album ? Rechercher par titre / série
          </summary>
          <div className="mt-2">
            <BnfTextSearch onSelect={handleTextSearchSelect} />
          </div>
        </details>
      ) : (
        <BnfTextSearch onSelect={handleTextSearchSelect} />
      )}

      <AlbumForm
        initial={{ isbn: isbnInput, ...prefill }}
        coverPreview={coverPreview}
        onCoverFileSelected={handleCoverFileSelected}
        onSearchCover={handleSearchCover}
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
