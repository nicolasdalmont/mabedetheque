import { NextResponse } from "next/server";
import { fetchCollectionTomes } from "@/lib/bnf-series";

export async function GET(request: Request) {
  const collectionId = new URL(request.url).searchParams.get("collectionId")?.trim();
  if (!collectionId) {
    return NextResponse.json({ error: "Paramètre collectionId manquant." }, { status: 400 });
  }

  const result = await fetchCollectionTomes(collectionId);
  return NextResponse.json(result);
}
