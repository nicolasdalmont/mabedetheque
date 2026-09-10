"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "./navTabs";

// Desktop tab bar (in the header). On mobile it is hidden and navigation
// happens through <BottomNav> instead.
export function AppTabs() {
  const pathname = usePathname();

  return (
    <nav className="hidden min-w-0 gap-1 overflow-x-auto sm:flex">
      {NAV_TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex w-28 shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-yellow-400 text-black dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Icon size={18} className="shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
