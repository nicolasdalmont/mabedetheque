import { auth } from "@/lib/auth/server";

// Renamed from `middleware.ts` in Next.js 16 ("Proxy" replaces "Middleware").
// Proxy always runs on the Node.js runtime (needed here since Neon Auth's
// middleware uses `jose`, which needs CompressionStream/process.cwd) — the
// `runtime` config option no longer exists on this file and throws if set.
export default auth.middleware({ loginUrl: "/login" });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
