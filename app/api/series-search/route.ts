import { NextResponse } from "next/server";
import { fetchSeriesTomes } from "@/lib/bnf-series";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const series = params.get("series")?.trim();
  const author = params.get("author")?.trim() || null;
  if (!series) {
    return NextResponse.json({ error: "Paramètre series manquant." }, { status: 400 });
  }

  const result = await fetchSeriesTomes(series, author);
  return NextResponse.json(result);
}
