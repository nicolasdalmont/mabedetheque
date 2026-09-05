import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth/server";
import { uploadCover, deleteCover } from "@/lib/storage";

const MAX_WIDTH = 900;
const WEBP_QUALITY = 82;

async function requireSession() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

async function processAndUpload(bytes: Uint8Array): Promise<string> {
  const webp = await sharp(bytes)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return uploadCover(webp, "image/webp");
}

export async function POST(request: Request) {
  const user = await requireSession();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = await processAndUpload(bytes);
      return NextResponse.json({ url });
    }

    const { sourceUrl } = (await request.json()) as { sourceUrl?: string };
    if (!sourceUrl) {
      return NextResponse.json({ error: "sourceUrl manquant." }, { status: 400 });
    }
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Impossible de récupérer l'image source." },
        { status: 502 },
      );
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const url = await processAndUpload(bytes);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("cover upload failed", error);
    return NextResponse.json(
      { error: "Échec du traitement de l'image." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireSession();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { coverUrl } = (await request.json()) as { coverUrl?: string };
  if (!coverUrl) {
    return NextResponse.json({ error: "coverUrl manquant." }, { status: 400 });
  }

  await deleteCover(coverUrl);
  return NextResponse.json({ ok: true });
}
