"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getNeonClient } from "@/lib/neon-client";
import { fetchMustChangePassword } from "@/lib/password-flag";

// Renvoie vers « Mon compte » tant que l'utilisateur connecté n'a pas
// remplacé le mot de passe temporaire posé par un administrateur
// (account_flags, migration 0011). Garde de confort côté client : les
// données restent de toute façon limitées à son propre compte par la RLS.
//
// Monté une fois dans le layout (il survit aux navigations), d'où la
// vérification à chaque changement de route tant que le résultat n'est pas
// « tout est en ordre » ; /login remet le résultat à zéro pour qu'une
// nouvelle connexion soit revérifiée.
export function PasswordChangeGate() {
  const pathname = usePathname();
  const router = useRouter();
  const settled = useRef(false);

  useEffect(() => {
    if (pathname === "/login") {
      settled.current = false;
      return;
    }
    if (settled.current) return;

    let ignore = false;
    (async () => {
      try {
        const { data } = await getNeonClient().auth.getSession();
        if (ignore || !data?.user) return;
        const mustChange = await fetchMustChangePassword();
        if (ignore) return;
        if (mustChange) {
          if (pathname !== "/compte") router.replace("/compte");
        } else {
          settled.current = true;
        }
      } catch {
        // hors-ligne ou session absente : on réessaiera à la navigation suivante
      }
    })();
    return () => {
      ignore = true;
    };
  }, [pathname, router]);

  return null;
}
