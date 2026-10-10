"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getDataClient } from "@/lib/neon-client";
import { useSession } from "@/hooks/useSession";
import { useAlbums } from "@/hooks/useAlbums";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { seriesTitlesMatch } from "@/lib/bnf-series";
import { findSeriesGaps } from "@/lib/series-gaps";
import { compareAlbums } from "@/lib/sort";
import { tomeLabel } from "@/lib/format";
import type { Album } from "@/types/album";

function Thumb({ album }: { album: Album }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex aspect-[2/3] w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
      {album.cover_url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote, per-user covers
        <img
          src={album.cover_url}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : null}
    </div>
  );
}

export default function WishlistPage() {
  const { user } = useSession();
  const { albums, wishlist, loading, error, refetch } = useAlbums();
  const { success, error: toastError } = useToast();
  const seriesGaps = useMemo(() => findSeriesGaps(albums), [albums]);

  const [sortKey, setSortKey] = useState<"title" | "series">("title");
  const [pendingDelete, setPendingDelete] = useState<Album | null>(null);
  const [addedGapTomes, setAddedGapTomes] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => wishlist.slice().sort((a, b) => compareAlbums(a, b, sortKey)),
    [wishlist, sortKey],
  );

  // A gap tome is "already offered" once an achat album exists for it — the
  // names can differ in wording (BnF vs local), hence the loose match.
  const isInWishlist = (series: string, n: number) =>
    addedGapTomes.has(`${series}#${n}`) ||
    wishlist.some(
      (w) => w.issue_number === n && w.series_name && seriesTitlesMatch(series, w.series_name),
    );

  async function handleBought(album: Album) {
    const { error } = await getDataClient()
      .from("albums")
      .update({
        is_wishlist: false,
        purchase_date: album.purchase_date ?? new Date().toISOString().slice(0, 10),
      })
      .eq("id", album.id);
    if (error) {
      toastError(error.message);
      return;
    }
    refetch();
    success(`« ${album.title} » ajouté à votre bédéthèque.`);
  }

  async function confirmDeleteItem() {
    const album = pendingDelete;
    if (!album) return;
    setPendingDelete(null);
    const { error } = await getDataClient().from("albums").delete().eq("id", album.id);
    if (error) {
      toastError(error.message);
      return;
    }
    if (album.cover_url) {
      await fetch("/api/covers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverUrl: album.cover_url }),
      }).catch(() => {});
    }
    refetch();
    success("Retiré de la liste d'achats.");
  }

  async function handleAddGapTome(series: string, issueNumber: number) {
    if (!user) return;
    const { error } = await getDataClient()
      .from("albums")
      .insert({
        owner_id: user.id,
        title: `${series} #${issueNumber}`,
        series_name: series,
        issue_number: issueNumber,
        cover_url: "",
        is_wishlist: true,
      });
    if (error) {
      toastError(error.message);
      return;
    }
    setAddedGapTomes((prev) => new Set(prev).add(`${series}#${issueNumber}`));
    refetch();
    success(`${series} #${issueNumber} ajouté aux achats.`);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/albums/new?achat=1"
            className="rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-300"
          >
            + Ajouter un achat
          </Link>

          <select
            className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-yellow-500 dark:border-white/20 dark:focus:border-yellow-400"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as "title" | "series")}
            aria-label="Trier"
          >
            <option value="title">Tri : Alphabétique</option>
            <option value="series">Tri : Série puis tome</option>
          </select>
        </div>

        <p className="text-xs text-zinc-500">
          Les tomes manquants peuvent aussi s&apos;ajouter directement depuis l&apos;onglet{" "}
          <Link href="/series" className="underline">
            Séries
          </Link>
          .
        </p>

        {loading ? (
          <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            Aucun tome dans la liste d&apos;achats pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {sorted.map((album) => {
              const tome = tomeLabel(album.issue_number, album.is_integrale, album.is_hors_serie);
              return (
                <li key={album.id} className="flex items-center gap-3 py-3">
                  <Link
                    href={`/albums/${album.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
                  >
                    <Thumb album={album} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{album.title}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {[
                          album.series_name ? `${album.series_name}${tome ? ` ${tome}` : ""}` : null,
                          album.publisher,
                        ]
                          .filter(Boolean)
                          .join(" · ") || " "}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBought(album)}
                      className="rounded-full border border-yellow-400 bg-yellow-400 px-3 py-1 text-xs font-medium text-black hover:bg-yellow-300"
                    >
                      Acheté
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(album)}
                      className="-my-1 inline-flex min-h-9 items-center rounded-md px-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <h2 className="mb-1 text-sm font-medium">Séries incomplètes</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Tomes manquants entre le premier et le dernier numéro possédé — un tome publié
            au-delà de votre plus haut numéro possédé ne peut pas être détecté.
          </p>
          {seriesGaps.length ? (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {seriesGaps.map((gap) => (
                <li key={gap.series} className="flex flex-col gap-2 py-2">
                  <div>
                    <Link
                      href={`/series?open=${encodeURIComponent(gap.series)}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {gap.series}
                    </Link>
                    <p className="text-xs text-zinc-500">Possédés : {gap.range}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {gap.missingNumbers.map((n) => {
                      const added = isInWishlist(gap.series, n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleAddGapTome(gap.series, n)}
                          disabled={added}
                          className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
                        >
                          {added ? "✓" : "+"} #{n}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Aucun trou détecté.</p>
          )}
        </section>

        <ConfirmDialog
          open={pendingDelete !== null}
          title="Retirer de la liste d'achats"
          message={
            pendingDelete
              ? `Retirer « ${pendingDelete.title} » de la liste d'achats ? La fiche et sa couverture seront supprimées.`
              : ""
          }
          confirmLabel="Retirer"
          onConfirm={confirmDeleteItem}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    </div>
  );
}
