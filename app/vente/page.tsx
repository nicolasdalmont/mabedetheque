"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDataClient } from "@/lib/neon-client";
import { useAlbums } from "@/hooks/useAlbums";
import { useSession } from "@/hooks/useSession";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LocalAlbumSearch } from "@/components/LocalAlbumSearch";
import { useToast } from "@/components/Toast";
import type { Album, SaleStatus } from "@/types/album";
import { LAST_ALBUM_KEY } from "@/lib/constants";

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${
    active
      ? "border-yellow-400 bg-yellow-400 text-black"
      : "border-black/15 text-zinc-600 hover:bg-black/5 dark:border-white/20 dark:text-zinc-400 dark:hover:bg-white/5"
  }`;

export default function VentePage() {
  const { user } = useSession();
  // Search pool for "add to sale": the active collection already excludes
  // sold albums (see useAlbums), and here we also drop anything already
  // marked for sale so the same album can't be added twice.
  const { albums: activeAlbums, refetch: refetchActive } = useAlbums();

  const { success, error: toastError } = useToast();
  const [saleAlbums, setSaleAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SaleStatus | "all">("a_vendre");
  const [pendingSold, setPendingSold] = useState<Album | null>(null);

  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("albums")
      .select("*")
      .neq("sale_status", "none")
      .order("title", { ascending: true })
      .then(({ data, error }) => {
        if (ignore) return;
        setError(error ? error.message : null);
        setSaleAlbums(data ?? []);
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const filtered =
    statusFilter === "all" ? saleAlbums : saleAlbums.filter((a) => a.sale_status === statusFilter);
  const searchPool = activeAlbums.filter((a) => a.sale_status === "none");

  async function handleAddToSale(album: Album) {
    setSaleAlbums((prev) => [...prev, { ...album, sale_status: "a_vendre" }]);
    const { error } = await getDataClient()
      .from("albums")
      .update({ sale_status: "a_vendre" })
      .eq("id", album.id);
    if (error) {
      setSaleAlbums((prev) => prev.filter((a) => a.id !== album.id));
      toastError(error.message);
    } else {
      refetchActive();
      success(`« ${album.title} » ajouté aux ventes.`);
    }
  }

  async function handleSetStatus(album: Album, status: SaleStatus) {
    const previous = album.sale_status;
    setSaleAlbums((prev) =>
      status === "none"
        ? prev.filter((a) => a.id !== album.id)
        : prev.map((a) => (a.id === album.id ? { ...a, sale_status: status } : a)),
    );
    const { error } = await getDataClient().from("albums").update({ sale_status: status }).eq("id", album.id);
    if (error) {
      setSaleAlbums((prev) =>
        prev.some((a) => a.id === album.id)
          ? prev.map((a) => (a.id === album.id ? { ...a, sale_status: previous } : a))
          : [...prev, { ...album, sale_status: previous }],
      );
      toastError(error.message);
      return;
    }
    refetchActive();
    if (status === "vendu")
      success(`« ${album.title} » marqué vendu.`, {
        label: "Annuler",
        onClick: () => handleSetStatus({ ...album, sale_status: "vendu" }, "a_vendre"),
      });
    else if (status === "none") success(`« ${album.title} » retiré des ventes.`);
    else if (status === "a_vendre" && previous === "vendu") success(`Vente de « ${album.title} » annulée.`);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <p className="mb-2 text-xs font-medium">Mettre un album en vente</p>
        <LocalAlbumSearch albums={searchPool} onSelect={handleAddToSale} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("a_vendre")}
          className={chipClass(statusFilter === "a_vendre")}
        >
          À vendre
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("vendu")}
          className={chipClass(statusFilter === "vendu")}
        >
          Vendu
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={chipClass(statusFilter === "all")}
        >
          Toutes
        </button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          {saleAlbums.length === 0
            ? "Aucun album en vente pour le moment."
            : "Aucun album ne correspond à ce filtre."}
        </p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {filtered.map((album) => (
            <li key={album.id} className="flex items-center justify-between gap-3 py-3">
              <Link
                href={`/albums/${album.id}`}
                onClick={() => user && sessionStorage.setItem(LAST_ALBUM_KEY, album.id)}
                className="min-w-0"
              >
                <p className="truncate text-sm font-medium">{album.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {album.series_name
                    ? `${album.series_name}${album.issue_number != null ? ` #${album.issue_number}` : ""}`
                    : " "}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {album.sale_status === "a_vendre" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPendingSold(album)}
                      className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                    >
                      Marquer vendu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetStatus(album, "none")}
                      className="-my-1 rounded px-2 py-2 text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Retirer
                    </button>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                      Vendu
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSetStatus(album, "a_vendre")}
                      className="-my-1 inline-flex min-h-9 items-center rounded px-2 text-xs text-zinc-500 hover:underline"
                    >
                      Annuler
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingSold !== null}
        tone="default"
        title="Marquer comme vendu"
        message={
          pendingSold
            ? `« ${pendingSold.title} » disparaîtra de la galerie, des séries et des stats. Il restera ici sous le filtre « Vendu ».`
            : ""
        }
        confirmLabel="Marquer vendu"
        onConfirm={() => {
          const album = pendingSold;
          setPendingSold(null);
          if (album) handleSetStatus(album, "vendu");
        }}
        onCancel={() => setPendingSold(null)}
      />
    </div>
  );
}
