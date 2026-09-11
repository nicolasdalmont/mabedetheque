"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "./navTabs";
import { useSession } from "@/hooks/useSession";

// Bottom navigation for phones and narrow/tablet-width windows (below `lg`,
// where <AppTabs> doesn't fit — see its comment). Always visible — including
// on the add/edit album screens, which previously dropped the tab bar
// entirely and, in an installed PWA (no browser chrome), left no way out but
// the in-page "← Retour". Rendered once from the root layout.
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useSession();

  if (!user || pathname === "/login") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-black/10 bg-zinc-50/95 backdrop-blur lg:hidden dark:border-white/10 dark:bg-black/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              active ? "text-black dark:text-white" : "text-zinc-500"
            }`}
          >
            <Icon
              size={20}
              className={active ? "text-yellow-500" : ""}
              aria-hidden="true"
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
