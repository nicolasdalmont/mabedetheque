import { NextResponse } from "next/server";
import { fetchSeriesTomes } from "@/lib/bnf-series";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const series = params.get("series")?.trim();
  const author = params.get("author")?.trim() || null;
  if (!series) {
    return NextResponse.json({ error: "Paramètre series manquant." }, { status: 400 });
  }

  try {
    const result = await fetchSeriesTomes(series, author);
    return NextResponse.json(result);
  } catch {
    // A network hiccup or timeout talking to the BnF here must still come
    // back as JSON — otherwise Next's generic HTML error page reaches the
    // client's res.json() and breaks with a confusing platform-specific
    // parse error (Safari reports it as "The string did not match the
    // expected pattern.", unrelated on its face to what actually failed).
    return NextResponse.json(
      { error: "Recherche BnF indisponible (délai dépassé ou erreur réseau) — réessayez." },
      { status: 502 },
    );
  }
}
