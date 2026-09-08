"use client";

import { useState } from "react";
import type { AlbumInput } from "@/types/album";

export type AlbumFormValues = AlbumInput;

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

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      onCoverFileSelected?.(file);
    }
  }

  function field<K extends keyof AlbumFormValues>(key: K) {
    return {
      value: values[key] ?? "",
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
        <div
          tabIndex={0}
          onPaste={handlePaste}
          title="Cliquez ici puis collez une image (Ctrl/Cmd+V)"
          className="aspect-[2/3] w-full overflow-hidden rounded-md border border-black/10 bg-zinc-100 outline-none focus:border-yellow-500 dark:border-white/10 dark:bg-zinc-900"
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-400">
              Pas de couverture — ou collez une image (Ctrl/Cmd+V)
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <label className="block cursor-pointer rounded-md border border-black/15 px-2 py-1.5 text-center text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5">
            Galerie photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCoverFileSelected?.(file);
              }}
            />
          </label>
          <label className="block cursor-pointer rounded-md border border-black/15 px-2 py-1.5 text-center text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5">
            Fichiers
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onCoverFileSelected?.(file);
              }}
            />
          </label>
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
