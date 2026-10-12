"use client";

import { useEffect, useRef } from "react";

/**
 * « Est-ce la bonne couverture ? » : propose la couverture trouvée sur le
 * même ISBN dans la bédéthèque d'un autre compte. Même mécanique que
 * ConfirmDialog (<dialog> contrôlé), avec l'aperçu de l'image. Si l'image
 * ne charge pas (lien mort), on passe directement à « non ».
 */
export function SharedCoverDialog({
  coverUrl,
  onAccept,
  onReject,
}: {
  coverUrl: string | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = coverUrl !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onReject}
      className="m-auto w-full max-w-[min(24rem,calc(100%-2rem))] rounded-lg border border-black/10 bg-white p-6 text-zinc-900 backdrop:bg-black/40 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <h2 className="mb-1 text-sm font-semibold">Couverture déjà connue</h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
        Cet album existe déjà dans une autre bédéthèque. Est-ce la bonne couverture ?
      </p>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Object Storage image
        <img
          src={coverUrl}
          alt="Couverture proposée"
          onError={onReject}
          className="mx-auto mb-4 max-h-72 rounded border border-black/10 dark:border-white/10"
        />
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onReject}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Non, chercher
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-300"
        >
          Oui, utiliser
        </button>
      </div>
    </dialog>
  );
}
