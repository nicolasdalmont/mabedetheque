import Link from "next/link";
import type { Album } from "@/types/album";
import { LAST_ALBUM_KEY } from "@/lib/constants";

export function AlbumTable({ albums }: { albums: Album[] }) {
  if (albums.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        Aucun album ne correspond.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[640px] text-sm">
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
                  href={`/albums/${album.id}/edit`}
                  onClick={() => sessionStorage.setItem(LAST_ALBUM_KEY, album.id)}
                  className="font-medium hover:underline"
                >
                  {album.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {album.series_name ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {album.issue_number ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {album.publisher ?? "—"}
              </td>
              <td className="px-3 py-2 text-zinc-500">
                {album.purchase_date ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
