"use client";

import { useEffect } from "react";
import { applyTheme, getThemePreference, subscribeThemePreference } from "@/lib/theme";

// Keeps <html class="dark"> and the theme-color metas in step with the
// preference: applies it on mount (meta tags aren't covered by the inline
// init script), follows the OS scheme while the preference is "auto", and
// reacts to a change made in another tab.
export function ThemeSync() {
  useEffect(() => {
    const sync = () => applyTheme(getThemePreference());
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    const unsubscribe = subscribeThemePreference(sync);
    return () => {
      mq.removeEventListener("change", sync);
      unsubscribe();
    };
  }, []);

  return null;
}
