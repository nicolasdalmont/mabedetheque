import { NextResponse } from "next/server";
import { lookupIsbn } from "@/lib/isbn-providers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ isbn: string }> },
) {
  const { isbn } = await params;
  const digits = isbn.replace(/[^0-9Xx]/g, "");
  if (digits.length !== 10 && digits.length !== 13) {
    return NextResponse.json(
      { error: "ISBN invalide (10 ou 13 chiffres attendus)." },
      { status: 400 },
    );
  }

  const result = await lookupIsbn(digits);
  if (!result) {
    return NextResponse.json(
      { error: "Aucune information trouvée pour cet ISBN." },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
