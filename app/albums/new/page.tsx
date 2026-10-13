"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { useSession } from "@/hooks/useSession";
import { AlbumForm, clearAlbumDraft, type AlbumFormValues } from "@/components/AlbumForm";
import { AppHeader } from "@/components/AppHeader";
import { SharedCoverDialog } from "@/components/SharedCoverDialog";
import { IsbnScanner } from "@/components/IsbnScanner";
import { BnfTextSearch } from "@/components/BnfTextSearch";
import { useToast } from "@/components/Toast";
import type { TextSearchCandidate } from "@/lib/bnf-text-search";

// Couverture du même ISBN chez un autre compte (migration 0013). Best effort :
// une erreur (hors-ligne, migration absente) revient à « pas de proposition ».
async function findSharedCover(isbn: string): Promise<string | null> {
  try {
    const { data } = await getDataClient().rpc("find_shared_cover", { p_isbn: isbn });
    return typeof data === "string" && data ? data : null;
  } catch {
    return null;
  }
}

// One slot per flavour: an "add album" and an "add achat" draft can't clash,
// but each only allows one in progress at a time.
function NewAlbumContent() {
  const router = useRouter();
  // `?achat=1`: same lookup + form, but the album is saved with the "achat"
  // tag (is_wishlist) instead of joining the collection.
  const isAchat = useSearchParams().get("achat") === "1";
  const DRAFT_KEY = isAchat ? "new-achat" : "new";
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
  // Couverture d'un autre compte (même ISBN) : proposée en priorité. Copiée
  // vers un nouvel objet à l'enregistrement seulement (voir copyCover).
  const [sharedCoverProposal, setSharedCoverProposal] = useState<string | null>(null);
  const [sharedCoverUrl, setSharedCoverUrl] = useState<string | null>(null);
  // Résultat de la recherche externe, mis de côté le temps de la question.
  const [pendingLookupCover, setPendingLookupCover] = useState<string | null>(null);

  // Stable reference unless isbnInput/prefill actually change — AlbumForm
  // re-syncs its own state whenever this object's identity changes (to
  // pick up a fresh ISBN lookup), so a new literal on every render here
  // would wipe out in-progress edits on unrelated state changes (e.g.
  // pasting a cover).
  const initialValues = useMemo(
    () => ({ isbn: isbnInput, ...prefill }),
    [isbnInput, prefill],
  );

  async function handleLookup(isbnOverride?: string) {
    const isbn = isbnOverride ?? isbnInput;
    if (!isbn) return;
    setSearching(true);
    setSearchError(null);
    try {
      const sharedPromise = findSharedCover(isbn);
      const res = await fetch(`/api/isbn/${encodeURIComponent(isbn)}`);
      const data = await res.json();
      const shared = await sharedPromise;
      if (!res.ok) {
        setSearchError(data.error ?? "Recherche impossible.");
        if (shared) setSharedCoverProposal(shared);
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
      if (shared) {
        setPendingLookupCover(data.cover_url ?? null);
        setSharedCoverProposal(shared);
      } else if (data.cover_url) {
        applyLookupCover(data.cover_url);
      }
    } finally {
      setSearching(false);
    }
  }

  function applyLookupCover(url: string) {
    setRemoteCoverUrl(url);
    setSharedCoverUrl(null);
    setCoverPreview(url);
    setCoverFile(null);
  }

  function acceptSharedCover() {
    if (!sharedCoverProposal) return;
    setSharedCoverUrl(sharedCoverProposal);
    setRemoteCoverUrl(null);
    setCoverFile(null);
    setCoverPreview(sharedCoverProposal);
    setSharedCoverProposal(null);
    setPendingLookupCover(null);
  }

  // « Non » : la recherche de couverture habituelle suit son cours.
  function rejectSharedCover() {
    setSharedCoverProposal(null);
    if (pendingLookupCover) applyLookupCover(pendingLookupCover);
    setPendingLookupCover(null);
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
    applyLookupCover(data.cover_url);
  }

  function handleCoverFileSelected(file: File) {
    setCoverFile(file);
    setRemoteCoverUrl(null);
    setSharedCoverUrl(null);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(values: AlbumFormValues) {
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    try {
      let coverUrl = "";

      if (coverFile) {
        const form = new FormData();
        form.append("file", coverFile);
        const res = await fetch("/api/covers", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Échec de l'upload.");
        coverUrl = data.url;
      } else if (sharedCoverUrl) {
        const res = await fetch("/api/covers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ copyFromUrl: sharedCoverUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Échec de la copie de la couverture.");
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

      const { error } = await getDataClient().from("albums").insert({
        ...values,
        purchase_date: isAchat
          ? values.purchase_date
          : (values.purchase_date ?? new Date().toISOString().slice(0, 10)),
        is_wishlist: isAchat,
        cover_url: coverUrl,
        owner_id: user.id,
      });
      if (error) throw new Error(error.message);

      clearAlbumDraft(DRAFT_KEY);
      success(
        isAchat
          ? `« ${values.title} » ajouté aux achats.`
          : `« ${values.title} » ajouté à votre bédéthèque.`,
      );
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              clearAlbumDraft(DRAFT_KEY);
              router.back();
            }}
            className="-ml-2 inline-flex min-h-9 items-center rounded px-2 text-sm text-zinc-500 hover:underline"
          >
            ← Retour
          </button>
          <h1 className="text-lg font-semibold">{isAchat ? "Ajouter un achat" : "Ajouter un album"}</h1>
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
        <p className="-mt-3 text-xs text-zinc-500">
          Scannez le code-barres au dos de l&apos;album ou tapez son ISBN. Si l&apos;ISBN est
          introuvable, cherchez par titre ou série ci-dessous, ou remplissez la fiche à la main.
        </p>
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
          initial={initialValues}
          coverPreview={coverPreview}
          onCoverFileSelected={handleCoverFileSelected}
          onSearchCover={handleSearchCover}
          onSubmit={handleSubmit}
          submitLabel={isAchat ? "Enregistrer l'achat" : "Enregistrer l'album"}
          pending={saving}
          draftKey={DRAFT_KEY}
        />
        {saveError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
        ) : null}
        <SharedCoverDialog
          coverUrl={sharedCoverProposal}
          onAccept={acceptSharedCover}
          onReject={rejectSharedCover}
        />
      </div>
    </div>
  );
}

export default function NewAlbumPage() {
  return (
    <Suspense>
      <NewAlbumContent />
    </Suspense>
  );
}
