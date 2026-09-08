import { NextResponse } from "next/server";
import { searchBnfCollections } from "@/lib/bnf-series";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Paramètre q manquant." }, { status: 400 });
  }

  const candidates = await searchBnfCollections(q);
  return NextResponse.json({ candidates });
}
