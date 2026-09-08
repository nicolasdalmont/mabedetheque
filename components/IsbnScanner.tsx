"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";
import { X } from "lucide-react";

/**
 * Full-screen-ish modal that opens the camera and scans for an EAN-13
 * barcode (the format used by ISBN-13 on the back of virtually every
 * book/comic). Calls `onDetected` once with the raw decoded text, then
 * the parent is responsible for closing the scanner.
 */
export function IsbnScanner({
  onDetected,
  onClose,
}: {
  onDetected: (isbn: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    dialogRef.current?.showModal();

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
    const reader = new BrowserMultiFormatReader(hints);

    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current ?? undefined,
        (result, err) => {
          if (result) {
            controls?.stop();
            onDetectedRef.current(result.getText());
          } else if (err && !(err instanceof NotFoundException)) {
            setError("Erreur de lecture de la caméra.");
          }
        },
      )
      .then((c) => {
        if (cancelled) {
          c.stop();
        } else {
          controls = c;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Impossible d'accéder à la caméra. Vérifiez les autorisations puis réessayez.",
          );
        }
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  function handleClose() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      className="w-full max-w-md rounded-lg border border-black/10 bg-white p-0 text-zinc-900 backdrop:bg-black/60 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-medium">Scanner l&apos;ISBN</h2>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-1/4 w-4/5 rounded-md border-2 border-yellow-400" />
        </div>
      </div>

      <div className="p-4 text-center text-xs text-zinc-500">
        {error ? (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        ) : (
          "Visez le code-barres au dos de l'album."
        )}
      </div>
    </dialog>
  );
}
