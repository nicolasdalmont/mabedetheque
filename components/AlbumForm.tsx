"use client";

import { useState } from "react";
import type { AlbumInput } from "@/types/album";

export type AlbumFormValues = AlbumInput;

// Per-field mobile-keyboard capitalisation (see the note in `field()`).
// Titles read like a sentence; series / publisher / author names are proper
// nouns; ISBN and legal deposit ("DL 2024") take no capitals at all.
const AUTOCAPITALIZE: Partial<
  Record<keyof AlbumFormValues, "none" | "words" | "sentences">
> = {
  isbn: "none",
  legal_deposit: "none",
  title: "sentences",
  comment: "sentences",
  series_name: "words",
  publisher: "words",
  writer: "words",
  illustrator: "words",
};

const emptyValues: AlbumFormValues = {
  isbn: "",
  title: "",
  series_name: null,
  issue_number: null,
  publisher: null,
  writer: null,
  illustrator: null,
  legal_deposit: null,
  purchase_date: null,
  comment: null,
  cover_url: "",
};

export function AlbumForm({
  initial,
  coverPreview,
  onCoverFileSelected,
  onSearchCover,
  onSubmit,
  submitLabel,
  extraActions,
  pending,
}: {
  initial?: Partial<AlbumFormValues>;
  coverPreview?: string | null;
  onCoverFileSelected?: (file: File) => void;
  /** Looks up a cover for the given ISBN and applies it (parent owns
   * `coverPreview`, so it just needs to update its own state). */
  onSearchCover?: (isbn: string) => Promise<void>;
  onSubmit: (values: AlbumFormValues) => void;
  submitLabel: string;
  extraActions?: React.ReactNode;
  pending?: boolean;
}) {
  const [values, setValues] = useState<AlbumFormValues>({
    ...emptyValues,
    ...initial,
  });
  const [searchingCover, setSearchingCover] = useState(false);
  const [coverSearchError, setCoverSearchError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Merge in `initial` when it changes (e.g. an ISBN lookup resolves after
  // this form already mounted) without an effect: adjust state during
  // render, React's documented pattern for this. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setValues((prev) => ({ ...prev, ...initial }));
  }

  async function handleSearchCover() {
    if (!values.isbn || !onSearchCover) return;
    setSearchingCover(true);
    setCoverSearchError(null);
    try {
      await onSearchCover(values.isbn);
    } catch (err) {
      setCoverSearchError(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setSearchingCover(false);
    }
  }

  // A paste landing on the invisible editable layer over the cover — from a
  // Ctrl/Cmd+V, or from the OS "Coller" menu a long-press brings up on
  // mobile. That native menu path needs no clipboard permission (the user
  // explicitly chose "Coller"), unlike navigator.clipboard.read() below,
  // which mobile browsers gate behind a permission the user often can't
  // even grant from an installed PWA.
  function handlePaste(e: React.ClipboardEvent<HTMLElement>) {
    e.preventDefault(); // never keep anything in the editable layer
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      setPasteError(null);
      onCoverFileSelected?.(file);
    } else {
      setPasteError("Le presse-papiers ne contient pas d'image — copiez d'abord une image.");
    }
    const el = e.currentTarget;
    el.textContent = "";
    el.blur(); // drop focus so the mobile keyboard doesn't linger
  }

  // Desktop convenience: one click reads the clipboard straight away via the
  // async Clipboard API (reliable with a mouse). Called synchronously from
  // the click so it keeps the transient user activation the API needs.
  async function pasteFromClipboard() {
    const clip = navigator.clipboard;
    if (!clip?.read) {
      setPasteError("Presse-papiers non accessible — utilisez Ctrl/Cmd+V ou les boutons ci-dessous.");
      return;
    }
    setPasteError(null);
    let items: ClipboardItems;
    try {
      items = await clip.read();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.warn("clipboard read failed", err);
      setPasteError(
        "Lecture du presse-papiers refusée — utilisez Ctrl/Cmd+V, ou « Galerie photo » / « Fichiers » ci-dessous.",
      );
      return;
    }
    setPasting(true);
    try {
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        onCoverFileSelected?.(new File([blob], "presse-papiers", { type: imageType }));
        return;
      }
      setPasteError("Le presse-papiers ne contient pas d'image — copiez d'abord une image.");
    } finally {
      setPasting(false);
    }
  }

  function isCoarsePointer(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  }

  function handleCoverClick() {
    // Mobile: rely on the long-press → OS "Coller" menu (no permission). A
    // plain tap does nothing. Desktop: read the clipboard on the click.
    if (isCoarsePointer()) return;
    pasteFromClipboard();
  }

  function field<K extends keyof AlbumFormValues>(key: K) {
    const cap = AUTOCAPITALIZE[key];
    return {
      value: values[key] ?? "",
      // Set autocapitalize explicitly: left unset, iOS Safari re-runs its
      // default "sentences" heuristic every time React re-assigns the
      // controlled value, capitalising the *first two* letters of a word
      // instead of one. On proper-noun fields also kill autocorrect (it
      // mangles author/series names) — which helps the same glitch.
      autoCapitalize: cap,
      autoCorrect: cap === "words" || cap === "none" ? "off" : undefined,
      spellCheck: cap === "words" || cap === "none" ? false : undefined,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => {
        const raw = e.target.value;
        setValues((prev) => ({
          ...prev,
          [key]: raw === "" ? null : raw,
        }));
      },
    };
  }

  const inputClass =
    "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400";
  const labelClass = "text-sm font-medium";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="grid gap-6 sm:grid-cols-[200px_1fr]"
    >
      <div className="space-y-2">
        <span className={labelClass}>Couverture</span>
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md border border-black/10 bg-zinc-100 focus-within:border-yellow-500 dark:border-white/10 dark:bg-zinc-900">
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {pasting ? "Collage…" : "Pas de couverture"}
            </div>
          )}
          {/* Invisible editable layer, mobile only: a long-press brings up
              the OS "Coller" menu (no clipboard permission needed). Never
              keeps any content (see handlePaste). aria-hidden + tabIndex -1
              — the visible "Coller" button below is the accessible path. */}
          <div
            contentEditable
            suppressContentEditableWarning
            aria-hidden="true"
            tabIndex={-1}
            inputMode="none"
            onPaste={handlePaste}
            onClick={handleCoverClick}
            onInput={(e) => {
              e.currentTarget.textContent = "";
            }}
            onKeyDown={(e) => {
              const paste = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v";
              if (!paste && e.key !== "Tab") e.preventDefault();
            }}
            title="Appui long → « Coller » (mobile)"
            className="absolute inset-0 cursor-pointer caret-transparent outline-none"
          />
        </div>
        {pasteError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{pasteError}</p>
        ) : null}

        <div className="grid grid-cols-3 gap-1.5">
          <label className="block cursor-pointer rounded-md border border-black/15 px-1 py-2 text-center text-xs hover:bg-black/5 focus-within:border-yellow-500 focus-within:ring-1 focus-within:ring-yellow-500 dark:border-white/20 dark:hover:bg-white/5">
            Galerie
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCoverFileSelected?.(file);
              }}
            />
          </label>
          <label className="block cursor-pointer rounded-md border border-black/15 px-1 py-2 text-center text-xs hover:bg-black/5 focus-within:border-yellow-500 focus-within:ring-1 focus-within:ring-yellow-500 dark:border-white/20 dark:hover:bg-white/5">
            Fichiers
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCoverFileSelected?.(file);
              }}
            />
          </label>
          <button
            type="button"
            onClick={pasteFromClipboard}
            disabled={pasting}
            className="rounded-md border border-black/15 px-1 py-2 text-center text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
          >
            {pasting ? "…" : "Coller"}
          </button>
        </div>

        {onSearchCover ? (
          <button
            type="button"
            onClick={handleSearchCover}
            disabled={!values.isbn || searchingCover}
            className="w-full rounded-md border border-black/15 px-2 py-1.5 text-center text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
          >
            {searchingCover ? "Recherche..." : "Rechercher une couverture"}
          </button>
        ) : null}
        {coverSearchError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{coverSearchError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>ISBN</label>
          <input
            autoComplete="off"
            {...field("isbn")}
            className={inputClass}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>Titre *</label>
          <input
            required
            autoComplete="off"
            {...field("title")}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Série</label>
          <input autoComplete="off" {...field("series_name")} className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Numéro de tome</label>
          <input
            type="number"
            autoComplete="off"
            value={values.issue_number ?? ""}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                issue_number: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Éditeur</label>
          <input autoComplete="off" {...field("publisher")} className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Dépôt légal</label>
          <input autoComplete="off" {...field("legal_deposit")} className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Scénariste</label>
          <input autoComplete="off" {...field("writer")} className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Dessinateur</label>
          <input autoComplete="off" {...field("illustrator")} className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Date d&apos;achat</label>
          <input
            type="date"
            autoComplete="off"
            {...field("purchase_date")}
            className={inputClass}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>Commentaire</label>
          <textarea
            rows={3}
            autoComplete="off"
            {...field("comment")}
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-medium text-black hover:bg-yellow-300 disabled:opacity-50"
          >
            {pending ? "Enregistrement..." : submitLabel}
          </button>
          {extraActions}
        </div>
      </div>
    </form>
  );
}
