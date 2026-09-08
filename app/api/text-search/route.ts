import { NextResponse } from "next/server";
import { searchBnfByText } from "@/lib/bnf-text-search";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() || undefined;
  const series = params.get("series")?.trim() || undefined;
  if (!title && !series) {
    return NextResponse.json({ error: "Titre ou série requis." }, { status: 400 });
  }

  try {
    const candidates = await searchBnfByText({ title, series });
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json(
      { error: "Recherche BnF indisponible (délai dépassé ou erreur réseau) — réessayez." },
      { status: 502 },
    );
  }
}
