"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDataClient } from "@/lib/neon-client";
import { useSession } from "@/hooks/useSession";
import { AppTabs } from "@/components/AppTabs";
import { WishlistAddForm } from "@/components/WishlistAddForm";
import type { WishlistItem, WishlistStatus } from "@/types/wishlist";
import { WISHLIST_STATUS_LABEL } from "@/types/wishlist";

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${
    active
      ? "border-yellow-400 bg-yellow-400 text-black"
      : "border-black/15 text-zinc-600 hover:bg-black/5 dark:border-white/20 dark:text-zinc-400 dark:hover:bg-white/5"
  }`;

export default function WishlistPage() {
  const { user, signOut } = useSession();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WishlistStatus | "all">("a_acheter");
  const [showAddForm, setShowAddForm] = useState(false);

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
    if (error) setError(error.message);
  }

  async function handleDelete(item: WishlistItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await getDataClient().from("wishlist_items").delete().eq("id", item.id);
    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no next/image benefit here */}
            <img
              src="/icons/icon-192.png"
              alt="Ma Bédéthèque"
              className="h-12 w-12 rounded-md"
            />
          </Link>
          <AppTabs />
        </div>
        {user ? (
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-zinc-500 hover:underline"
          >
            Déconnexion
          </button>
        ) : null}
      </header>

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
                <button
                  type="button"
                  onClick={() => handleToggleStatus(item)}
                  className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
                >
                  {WISHLIST_STATUS_LABEL[item.status]}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
