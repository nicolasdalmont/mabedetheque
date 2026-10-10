export type ThemePreference = "auto" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
const THEME_EVENT = "themechange";

/**
 * Inline script run in <head> before first paint (see app/layout.tsx) so the
 * `dark` class is on <html> before React hydrates — otherwise a forced theme
 * flashes the OS one. Keep in sync with `applyTheme`.
 */
export const THEME_INIT_SCRIPT = `try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}`;

export function getThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "auto";
  } catch {
    return "auto";
  }
}

export function applyTheme(pref: ThemePreference) {
  const dark =
    pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";

  // The two <meta name="theme-color"> tags are media-scoped to the OS scheme
  // (Next `viewport.themeColor`); when the user overrides it, force the
  // matching one on and the other off.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const original = (meta.dataset.origMedia ??= meta.media);
    if (pref === "auto") {
      meta.media = original;
      return;
    }
    const isDarkMeta = original.includes("dark");
    meta.media = isDarkMeta === dark ? "all" : "not all";
  });
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable (private mode): the choice still applies for this page view.
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeThemePreference(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
