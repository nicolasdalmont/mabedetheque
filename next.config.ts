import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Serwist's webpack plugin doesn't support Turbopack yet; only run it for
  // the production build (which we run with --webpack, see package.json).
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Silences Next 16's Turbopack/webpack-config guard: Serwist's plugin adds
  // a webpack config, but it's a no-op in dev (see `disable` above) and prod
  // builds run explicitly with `--webpack` (see package.json).
  turbopack: {},
};

export default withSerwist(nextConfig);
