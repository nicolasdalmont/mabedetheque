import type { Album } from "@/types/album";
import { AlbumCard } from "./AlbumCard";

export function AlbumGrid({ albums }: { albums: Album[] }) {
  if (albums.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        Aucun album ne correspond.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </div>
  );
}
