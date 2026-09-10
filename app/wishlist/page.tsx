"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDataClient } from "@/lib/neon-client";
import { useSession } from "@/hooks/useSession";
import { useAlbums } from "@/hooks/useAlbums";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WishlistAddForm } from "@/components/WishlistAddForm";
import { BuyWishlistModal } from "@/components/BuyWishlistModal";
import { useToast } from "@/components/Toast";
import { findSeriesGaps } from "@/lib/series-gaps";
import type { WishlistItem, WishlistStatus } from "@/types/wishlist";
import { WISHLIST_STATUS_LABEL } from "@/types/wishlist";

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${
    active
      ? "border-yellow-400 bg-yellow-400 text-black"
      : "border-black/15 text-zinc-600 hover:bg-black/5 dark:border-white/20 dark:text-zinc-400 dark:hover:bg-white/5"
  }`;

export default function WishlistPage() {
  const { user } = useSession();
  const { albums } = useAlbums();
  const { success, error: toastError } = useToast();
  const seriesGaps = useMemo(() => findSeriesGaps(albums), [albums]);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WishlistStatus | "all">("a_acheter");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addedGapTomes, setAddedGapTomes] = useState<Set<string>>(new Set());
  const [buyingItem, setBuyingItem] = useState<WishlistItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WishlistItem | null>(null);

  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("wishlist_items")
      .select("*")
      .order("series_name", { ascending: true })
      .order("issue_number", { ascending: true })
      .then(({ data, error }) => {
        if (ignore) return;
        setError(error ? error.message : null);
        setItems(data ?? []);
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const filtered = statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);

  async function handleToggleStatus(item: WishlistItem) {
    const status: WishlistStatus = item.status === "a_acheter" ? "achete" : "a_acheter";
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
    const { error } = await getDataClient()
      .from("wishlist_items")
      .update({ status })
      .eq("id", item.id);
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
      toastError(error.message);
    }
  }

  async function confirmDeleteItem() {
    const item = pendingDelete;
    if (!item) return;
    setPendingDelete(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await getDataClient().from("wishlist_items").delete().eq("id", item.id);
    if (error) {
      setItems((prev) => [...prev, item]);
      toastError(error.message);
    } else {
      success("Tome retiré de la liste d'achats.");
    }
  }

  async function handleAddGapTome(series: string, issueNumber: number) {
    if (!user) return;
    const key = `${series}#${issueNumber}`;
    const { data, error } = await getDataClient()
      .from("wishlist_items")
      .insert({ owner_id: user.id, series_name: series, issue_number: issueNumber })
      .select()
      .single();
    if (error) {
      toastError(error.message);
      return;
    }
    setItems((prev) => [...prev, data]);
    setAddedGapTomes((prev) => new Set(prev).add(key));
    success(`${series} #${issueNumber} ajouté aux achats.`);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      {!showAddForm ? (
        <div>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-300"
          >
            + Ajouter
          </button>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        Les tomes manquants peuvent aussi s&apos;ajouter directement depuis l&apos;onglet{" "}
        <Link href="/series" className="underline">
          Séries
        </Link>
        .
      </p>

      {showAddForm && user ? (
        <WishlistAddForm
          ownerId={user.id}
          ownedAlbums={albums}
          onAdded={(item) => {
            setItems((prev) => [...prev, item]);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("a_acheter")}
          className={chipClass(statusFilter === "a_acheter")}
        >
          À acheter
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("achete")}
          className={chipClass(statusFilter === "achete")}
        >
          Acheté
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
          {items.length === 0
            ? "Aucun tome dans la liste d'achats pour le moment."
            : "Aucun tome ne correspond à ce filtre."}
        </p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {filtered.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.series_name}
                  {item.issue_number != null ? ` #${item.issue_number}` : ""}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {[item.title, item.publisher].filter(Boolean).join(" · ") || " "}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.status === "a_acheter" ? (
                  <button
                    type="button"
                    onClick={() => setBuyingItem(item)}
                    className="rounded-full border border-yellow-400 bg-yellow-400 px-3 py-1 text-xs font-medium text-black hover:bg-yellow-300"
                  >
                    Acheté
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(item)}
                    className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                  >
                    {WISHLIST_STATUS_LABEL[item.status]}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPendingDelete(item)}
                  className="-my-1 rounded px-2 py-2 text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
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
                    const added = addedGapTomes.has(`${gap.series}#${n}`);
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

      {buyingItem && user ? (
        <BuyWishlistModal
          item={buyingItem}
          ownerId={user.id}
          onDone={() => {
            const bought = buyingItem;
            setItems((prev) => prev.filter((i) => i.id !== bought.id));
            setBuyingItem(null);
            success(
              `${bought.series_name}${bought.issue_number != null ? ` #${bought.issue_number}` : ""} ajouté à votre bédéthèque.`,
            );
          }}
          onClose={() => setBuyingItem(null)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Retirer de la liste d'achats"
        message={
          pendingDelete
            ? `Retirer « ${pendingDelete.series_name}${pendingDelete.issue_number != null ? ` #${pendingDelete.issue_number}` : ""} » de la liste d'achats ?`
            : ""
        }
        confirmLabel="Retirer"
        onConfirm={confirmDeleteItem}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
