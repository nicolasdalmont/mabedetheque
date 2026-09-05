import { NextResponse } from "next/server";

// Temporary diagnostic route — reports presence/shape of env vars without
// leaking secret values, to debug why NEON_AUTH_BASE_URL reads as undefined
// at runtime on this Preview deployment despite being set in Vercel.
export async function GET() {
  const neonKeys = Object.keys(process.env).filter((k) => k.includes("NEON"));
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV,
    hasNeonAuthBaseUrl: Boolean(process.env.NEON_AUTH_BASE_URL),
    neonAuthBaseUrlLength: process.env.NEON_AUTH_BASE_URL?.length ?? null,
    neonAuthBaseUrlFirstChars: process.env.NEON_AUTH_BASE_URL?.slice(0, 12) ?? null,
    neonEnvKeys: neonKeys,
  });
}
