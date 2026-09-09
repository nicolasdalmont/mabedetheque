"use client";

import { LogOut } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export function SignOutButton() {
  const { user, signOut } = useSession();
  if (!user) return null;

  return (
    <button
      type="button"
      onClick={() => signOut()}
      title="Déconnexion"
      aria-label="Déconnexion"
      className="shrink-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    >
      <LogOut size={20} aria-hidden="true" />
    </button>
  );
}
