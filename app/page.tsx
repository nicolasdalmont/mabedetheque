"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAlbums } from "@/hooks/useAlbums";
import { getDataClient } from "@/lib/neon-client";
import { AppHeader } from "@/components/AppHeader";
import { AlbumGrid } from "@/components/AlbumGrid";

const RECENT_PURCHASES_COUNT = 6;

function HomeStatCard({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-black/10 p-4 text-center transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
    >
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </Link>
  );
}

export default function Home() {
  const { albums, loading, error } = useAlbums();
  const [wishlistToBuy, setWishlistToBuy] = useState(0);

  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("wishlist_items")
      .select("id")
      .eq("status", "a_acheter")
      .then(({ data }) => {
        if (!ignore) setWishlistToBuy(data?.length ?? 0);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const totalSeries = useMemo(
    () => new Set(albums.map((a) => a.series_name).filter(Boolean)).size,
    [albums],
  );
  const albumsForSale = useMemo(
    () => albums.filter((a) => a.sale_status === "a_vendre").length,
    [albums],
  );
  // Most recently *bought* albums, not most recently added — sorted on
  // purchase_date (ISO strings, so a plain string compare sorts correctly),
  // then on updated_at to break ties between albums bought the same day
  // (purchase_date has no time component, updated_at does).
  const recentPurchases = useMemo(
    () =>
      albums
        .filter((a) => a.purchase_date)
        .sort(
          (a, b) =>
            b.purchase_date!.localeCompare(a.purchase_date!) ||
            b.updated_at.localeCompare(a.updated_at),
        )
        .slice(0, RECENT_PURCHASES_COUNT),
    [albums],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
            <HomeStatCard href="/albums" label="Albums" value={albums.length} />
            <HomeStatCard href="/series" label="Séries" value={totalSeries} />
            <HomeStatCard href="/wishlist" label="Achats" value={wishlistToBuy} />
            <HomeStatCard href="/vente" label="Ventes" value={albumsForSale} />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Derniers achats</h2>
            {recentPurchases.length ? (
              <AlbumGrid albums={recentPurchases} />
            ) : (
              <p className="text-sm text-zinc-500">Aucun achat enregistré.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
