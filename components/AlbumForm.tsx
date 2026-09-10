"use client";

import { useRef, useState } from "react";
import type { AlbumInput } from "@/types/album";

export type AlbumFormValues = AlbumInput;

// Long enough to not fire on an ordinary tap/scroll-start, short enough to
// feel intentional — same order of magnitude as native long-press gestures
// (context menus, drag handles).
const LONG_PRESS_MS = 500;

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
  const coverPressRef = useRef<{ at: number; x: number; y: number } | null>(null);

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

  // Keyboard paste (Ctrl/Cmd+V) — works via the plain clipboard event, no
  // permission prompt needed since it's a direct user-initiated paste.
  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      onCoverFileSelected?.(file);
    }
  }

  // Click (desktop) / long-press (mobile) paste — reads the clipboard via the
  // async Clipboard API, since mobile has no Ctrl/Cmd+V. It MUST be called
  // straight from the gesture handler (click / touchend): the API needs
  // transient user activation, which a deferred callback (e.g. a setTimeout
  // that only fires once the press is long enough) no longer carries —
  // Safari and Chrome both reject it with NotAllowedError then. Also needs a
  // secure context, which the app always has (HTTPS-only, see AGENTS.md).
  async function pasteFromClipboard() {
    setPasteError(null);
    if (!navigator.clipboard?.read) {
      setPasteError(
        "Presse-papiers non accessible sur ce navigateur — utilisez Ctrl/Cmd+V ou les boutons ci-dessous.",
      );
      return;
    }
    setPasting(true);
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        onCoverFileSelected?.(new File([blob], "presse-papiers", { type: imageType }));
        return;
      }
      setPasteError("Le presse-papiers ne contient pas d'image — copiez d'abord une image.");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.warn("clipboard read failed", err);
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      setPasteError(
        denied
          ? "Accès au presse-papiers refusé — autorisez-le pour ce site (ou validez « Coller » si le navigateur le propose), sinon utilisez Ctrl/Cmd+V ou les boutons ci-dessous."
          : "Lecture du presse-papiers impossible — utilisez Ctrl/Cmd+V ou les boutons ci-dessous.",
      );
    } finally {
      setPasting(false);
    }
  }

  // "pointer: coarse" is the primary-pointer media feature (finger-driven —
  // true on phones/tablets, false on a mouse/trackpad-driven desktop, even
  // one with a touchscreen). Routes the gesture: a coarse pointer pastes on
  // a long-press only (a plain tap stays a no-op, so it doesn't nag for
  // clipboard access on every tap), a fine one on a plain click.
  function isCoarsePointer(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  }

  function handleCoverClick() {
    if (isCoarsePointer()) return; // touch: handled in handleTouchEnd
    pasteFromClipboard();
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    coverPressRef.current = { at: Date.now(), x: t.clientX, y: t.clientY };
  }

  // Fire on release, not on a timer: a stationary press held past the
  // threshold is a long-press, and touchend still carries the user
  // activation that navigator.clipboard.read() needs.
  function handleTouchEnd(e: React.TouchEvent) {
    const press = coverPressRef.current;
    coverPressRef.current = null;
    if (!press) return;
    const t = e.changedTouches[0];
    const held = Date.now() - press.at;
    const moved = Math.hypot(t.clientX - press.x, t.clientY - press.y);
    if (held >= LONG_PRESS_MS && moved < 12) {
      e.preventDefault(); // don't also fire the click this touch synthesizes
      pasteFromClipboard();
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
          onClick={handleCoverClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            coverPressRef.current = null;
          }}
          title="Cliquez pour coller une image (appui long sur mobile) — Ctrl/Cmd+V aussi possible"
          style={{ WebkitTouchCallout: "none" }}
          className="aspect-[2/3] w-full cursor-pointer touch-manipulation select-none overflow-hidden rounded-md border border-black/10 bg-zinc-100 outline-none focus:border-yellow-500 dark:border-white/10 dark:bg-zinc-900"
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-400">
              {pasting
                ? "Collage..."
                : "Pas de couverture — cliquez ou appuyez longuement pour coller une image"}
            </div>
          )}
        </div>
        {pasteError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{pasteError}</p>
        ) : null}

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
