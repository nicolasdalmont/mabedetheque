"use client";

import { useEffect } from "react";

// Best-effort dark-mode home-screen icon on Android/Chrome: the Web App
// Manifest spec has no per-color-scheme icon variants, so this swaps the
// <link rel="manifest"> href before Chrome evaluates "Add to Home Screen".
// Whether that's still in time depends on when Chrome reads the manifest —
// this is not guaranteed, and an icon already added to the home screen
// won't change if the system theme changes afterwards.
export function ManifestThemeSwitcher() {
  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (!isDark) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) link.href = "/manifest-dark.json";
  }, []);

  return null;
}
