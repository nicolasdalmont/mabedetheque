"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  getThemePreference,
  setThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "auto", label: "Automatique", Icon: Monitor },
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
];

// Header theme control: cycles Automatique (device) → Clair → Sombre.
export function ThemeButton() {
  const pref = useSyncExternalStore(subscribeThemePreference, getThemePreference, () => "auto" as const);
  const index = OPTIONS.findIndex((o) => o.value === pref);
  const current = OPTIONS[index];
  const next = OPTIONS[(index + 1) % OPTIONS.length];

  return (
    <button
      type="button"
      onClick={() => setThemePreference(next.value)}
      title={`Thème : ${current.label} (cliquer pour ${next.label.toLowerCase()})`}
      aria-label={`Thème : ${current.label}. Passer en ${next.label.toLowerCase()}`}
      className="shrink-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    >
      <current.Icon size={18} aria-hidden="true" />
    </button>
  );
}
