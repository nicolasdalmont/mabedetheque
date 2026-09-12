"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { NAV_TABS } from "./navTabs";
import { useSession } from "@/hooks/useSession";

const primaryTabs = NAV_TABS.filter((t) => !("secondary" in t && t.secondary));
const secondaryTabs = NAV_TABS.filter((t) => "secondary" in t && t.secondary);

const itemClass = (active: boolean) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
    active ? "text-black dark:text-white" : "text-zinc-500"
  }`;

// Bottom navigation for phones and narrow/tablet-width windows (below `lg`,
// where <AppTabs> doesn't fit — see its comment). Always visible — including
// on the add/edit album screens, which previously dropped the tab bar
// entirely and, in an installed PWA (no browser chrome), left no way out but
// the in-page "← Retour". Rendered once from the root layout.
//
// 6 flat items were too cramped in thumb reach on a phone-width screen —
// Idées and Stats (`secondary` in navTabs.ts) are grouped under a "Plus"
// menu, a small popover anchored above the button rather than a full-screen
// sheet (there are only two entries, not worth the heavier UI).
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // Close on navigation (including to a secondary tab picked from the menu)
  // — adjust state during render on a pathname change rather than an
  // effect, React's documented pattern for this (see AlbumForm's
  // prevInitial for the same idiom in this codebase).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  if (!user || pathname === "/login") return null;

  const secondaryActive = secondaryTabs.some((t) => t.href === pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex px-3 border-t border-black/10 bg-zinc-50/95 backdrop-blur lg:hidden dark:border-white/10 dark:bg-black/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primaryTabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
            <Icon size={20} className={active ? "text-yellow-500" : ""} aria-hidden="true" />
            {label}
          </Link>
        );
      })}

      <div className="relative flex flex-1">
        {menuOpen ? (
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
        ) : null}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Plus"
          className={itemClass(secondaryActive)}
        >
          <MoreHorizontal size={20} className={secondaryActive ? "text-yellow-500" : ""} aria-hidden="true" />
          Plus
        </button>
        {menuOpen ? (
          <div className="absolute bottom-full right-0 z-50 mb-2 w-40 overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900">
            {secondaryTabs.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm ${
                    active ? "bg-black/5 font-medium dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} className={active ? "text-yellow-500" : "text-zinc-500"} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
