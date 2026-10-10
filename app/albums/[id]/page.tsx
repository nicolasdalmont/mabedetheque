"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Layers, Pencil, ShoppingCart, Sparkles, Tag } from "lucide-react";
import { getDataClient } from "@/lib/neon-client";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import { SALE_STATUS_LABEL, type Album } from "@/types/album";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex gap-3 border-b border-black/5 py-2 last:border-0 dark:border-white/5">
      <dt className="w-32 shrink-0 text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  // Re-fetch on mount and whenever the app regains focus — so coming back
  // here after editing (or a change made elsewhere) shows fresh data.
  const fetchRef = useRef<() => void>(() => {});
  useEffect(() => {
    let ignore = false;
    const fetchAlbum = () => {
      getDataClient()
        .from("albums")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data, error }) => {
          if (ignore) return;
          setError(error ? error.message : null);
          if (data) {
            setAlbum(data);
            setBroken(false);
          }
          setLoading(false);
        });
    };
    fetchRef.current = fetchAlbum;
    fetchAlbum();
    const onFocus = () => fetchRef.current();
    window.addEventListener("focus", onFocus);
    return () => {
      ignore = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [id]);

  // "Acheté" on an achat-tagged album: it joins the collection, purchase
  // date defaulting to today (same default as adding an album directly).
  async function handleMarkBought() {
    if (!album) return;
    const purchase_date = album.purchase_date ?? new Date().toISOString().slice(0, 10);
    const { error } = await getDataClient()
      .from("albums")
      .update({ is_wishlist: false, purchase_date })
      .eq("id", album.id);
    if (error) {
      toastError(error.message);
      return;
    }
    setAlbum({ ...album, is_wishlist: false, purchase_date });
    success(`« ${album.title} » ajouté à votre bédéthèque.`);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="-ml-2 inline-flex min-h-9 items-center rounded px-2 text-sm text-zinc-500 hover:underline"
          >
            ← Retour
          </button>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
        ) : error || !album ? (
          <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">
            {error ?? "Album introuvable."}
          </p>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="relative left-1/2 w-[95vw] shrink-0 -translate-x-1/2 sm:left-0 sm:w-96 sm:translate-x-0">
              <div className="relative w-full">
                {album.sale_status !== "none" ? (
                  <span className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-medium text-black">
                    <Tag size={11} aria-hidden="true" />
                    {SALE_STATUS_LABEL[album.sale_status]}
                  </span>
                ) : null}
                {album.is_wishlist && album.sale_status === "none" ? (
                  <span className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-medium text-black">
                    <ShoppingCart size={11} aria-hidden="true" />
                    Achat
                  </span>
                ) : null}
                {album.is_integrale ? (
                  <span className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-medium text-black">
                    <Layers size={11} aria-hidden="true" />
                    Intégrale
                  </span>
                ) : album.is_hors_serie ? (
                  <span className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-medium text-black">
                    <Sparkles size={11} aria-hidden="true" />
                    Hors série
                  </span>
                ) : null}
                {album.cover_url && !broken ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote, per-user cover
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    onError={() => setBroken(true)}
                    className="h-auto w-full"
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center px-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Pas de couverture
                  </div>
                )}
              </div>
              {album.is_wishlist ? (
                <button
                  type="button"
                  onClick={handleMarkBought}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-yellow-400 px-3 py-2 text-sm font-medium hover:bg-yellow-400/10"
                >
                  <ShoppingCart size={15} aria-hidden="true" />
                  Marquer comme acheté
                </button>
              ) : null}
              <Link
                href={`/albums/${album.id}/edit`}
                className="mt-3 flex items-center justify-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-medium text-black hover:bg-yellow-300"
              >
                <Pencil size={15} aria-hidden="true" />
                Modifier
              </Link>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{album.title}</h1>
              {album.series_name ? (
                <p className="mt-0.5 text-sm text-zinc-500">
                  {album.series_name}
                  {album.is_integrale
                    ? " — intégrale"
                    : album.is_hors_serie
                      ? " — hors série"
                      : album.issue_number != null
                        ? ` — tome ${album.issue_number}`
                        : ""}
                </p>
              ) : null}

              <dl className="mt-4">
                <Field label="Éditeur" value={album.publisher} />
                <Field label="Collection" value={album.collection} />
                <Field label="Scénariste" value={album.writer} />
                <Field label="Dessinateur" value={album.illustrator} />
                <Field label="Dépôt légal" value={album.legal_deposit} />
                <Field
                  label="Date d'achat"
                  value={album.purchase_date ? formatDate(album.purchase_date) : null}
                />
                <Field label="ISBN" value={album.isbn} />
                <Field
                  label="Commentaire"
                  value={
                    album.comment ? (
                      <span className="whitespace-pre-wrap">{album.comment}</span>
                    ) : null
                  }
                />
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
