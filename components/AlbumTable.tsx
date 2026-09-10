import Link from "next/link";
import type { Album } from "@/types/album";
import { LAST_ALBUM_KEY } from "@/lib/constants";
import { formatDate } from "@/lib/format";

function rememberAlbum(id: string) {
  sessionStorage.setItem(LAST_ALBUM_KEY, id);
}

export function AlbumTable({ albums }: { albums: Album[] }) {
  if (albums.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        Aucun album ne correspond.
      </p>
    );
  }

  return (
    <>
      {/* Mobile: stacked rows — a 640px-wide table scrolling sideways on a
          phone was unusable. */}
      <ul className="divide-y divide-black/5 rounded-lg border border-black/10 sm:hidden dark:divide-white/10 dark:border-white/10">
        {albums.map((album) => (
          <li key={album.id}>
            <Link
              href={`/albums/${album.id}`}
              onClick={() => rememberAlbum(album.id)}
              className="block px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <p className="text-sm font-medium">{album.title}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {[
                  album.series_name
                    ? `${album.series_name}${album.issue_number != null ? ` #${album.issue_number}` : ""}`
                    : null,
                  album.publisher,
                  album.purchase_date ? `acheté le ${formatDate(album.purchase_date)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: full table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-black/10 sm:block dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 bg-zinc-100 text-left dark:border-white/10 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">Titre</th>
              <th className="px-3 py-2 font-medium">Série</th>
              <th className="px-3 py-2 font-medium">Tome</th>
              <th className="px-3 py-2 font-medium">Éditeur</th>
              <th className="px-3 py-2 font-medium">Achat</th>
            </tr>
          </thead>
          <tbody>
            {albums.map((album) => (
              <tr
                key={album.id}
                id={`album-${album.id}`}
                className="border-b border-black/5 last:border-0 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-zinc-900"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/albums/${album.id}`}
                    onClick={() => rememberAlbum(album.id)}
                    className="font-medium hover:underline"
                  >
                    {album.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-500">{album.series_name ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-500">{album.issue_number ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-500">{album.publisher ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-500">{formatDate(album.purchase_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
