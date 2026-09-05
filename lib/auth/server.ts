import { createNeonAuth } from "@neondatabase/auth/next/server";

// Singleton server-side auth instance: Server Components / Server Actions
// use `auth.getSession()`, the API route uses `auth.handler()`, and
// middleware.ts uses `auth.middleware()`.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
