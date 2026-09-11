"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "./navTabs";

// Desktop tab bar (in the header). Below `lg` there isn't reliably enough
// width for the header (logo + 6 tabs + actions) to fit — it used to switch
// in at `sm` (640px) and silently clip the last one or two tabs (Idées,
// Stats) off the right edge with no visible affordance to reach them.
// Navigation happens through <BottomNav> instead until `lg`.
export function AppTabs() {
  const pathname = usePathname();

  return (
    <nav className="hidden min-w-0 gap-1 overflow-x-auto lg:flex">
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
