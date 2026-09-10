"use client";

import { useEffect, useRef } from "react";

/**
 * One confirmation pattern for the whole app — replaces the ad-hoc mix of
 * a styled <dialog> here, window.confirm there, and no confirmation at all
 * for some destructive actions. Controlled: render it with `open` and it
 * shows/closes itself.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "danger",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-yellow-400 text-black hover:bg-yellow-300";

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-6 text-zinc-900 backdrop:bg-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
    >
      {title ? <h2 className="mb-1 text-sm font-semibold">{title}</h2> : null}
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${confirmClass}`}
        >
          {pending ? "…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
