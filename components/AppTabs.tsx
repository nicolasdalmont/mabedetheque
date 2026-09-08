"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Lightbulb, ChartColumn } from "lucide-react";

const TABS = [
  { href: "/", label: "Albums", icon: Library },
  { href: "/ideas", label: "Idées", icon: Lightbulb },
  { href: "/stats", label: "Stats", icon: ChartColumn },
];

export function AppTabs({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between gap-1 border-b border-black/10 dark:border-white/10">
      <div className="flex gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:w-28 ${
                active
                  ? "border-yellow-400 text-black dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>
      {action ? <div className="pb-2">{action}</div> : null}
    </nav>
  );
}
