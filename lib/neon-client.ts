"use client";

import { createClient } from "@neondatabase/neon-js";
import { NeonPostgrestClient, fetchWithToken } from "@neondatabase/postgrest-js";
import type { Database } from "@/types/album";

// Auth-only client: sign-in/sign-out/password-reset, all going through our
// own `/api/auth` mount (see app/api/auth/[...path]) so the session cookie
// is set on this app's own domain rather than Neon's auth host.
//
// Created lazily (not at module scope) because it needs `window.location`:
// Next.js still evaluates client-component modules during the server
// prerender pass, where `window` doesn't exist yet.
function createAuthClient() {
  return createClient<Database>({
    auth: { url: `${window.location.origin}/api/auth` },
    dataApi: { url: process.env.NEXT_PUBLIC_NEON_DATA_API_URL! },
  });
}

let authClient: ReturnType<typeof createAuthClient> | null = null;

export function getNeonClient() {
  if (!authClient) {
    authClient = createAuthClient();
  }
  return authClient;
}

// Data API client, separate from the auth client above.
//
// The unified client's automatic token caching relies on the auth server
// returning a `set-auth-jwt` response header on sign-in/get-session, which
// this Neon Auth setup doesn't send — its session token is a plain Better
// Auth session id, not a JWT, and the Data API rejects it ("not a valid JWT
// encoding"). The dedicated `/token` endpoint *does* mint a real JWT from
// the session cookie, so we fetch it ourselves on every Data API request.
async function getAccessToken(): Promise<string | null> {
  const res = await fetch("/api/auth/token", { credentials: "same-origin" });
  if (!res.ok) return null;
  const data = (await res.json()) as { token?: string };
  return data.token ?? null;
}

let dataClient: NeonPostgrestClient<Database> | null = null;

export function getDataClient() {
  if (!dataClient) {
    dataClient = new NeonPostgrestClient<Database>({
      dataApiUrl: process.env.NEXT_PUBLIC_NEON_DATA_API_URL!,
      options: { global: { fetch: fetchWithToken(getAccessToken) } },
    });
  }
  return dataClient;
}

// The browser auth client throws on failure (e.g. wrong password) instead of
// resolving to `{ data, error }` like the server-side client and the Data
// API calls do. Normalize both shapes so callers only ever need to check
// `.error`.
export async function safeAuthCall<T>(
  promise: Promise<{ data: T | null; error: { message?: string } | null }>,
): Promise<{ data: T | null; error: { message?: string } | null }> {
  try {
    return await promise;
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message)
        : "Une erreur est survenue.";
    return { data: null, error: { message } };
  }
}
