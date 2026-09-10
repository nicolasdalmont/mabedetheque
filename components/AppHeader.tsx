import Link from "next/link";
import { AppTabs } from "./AppTabs";
import { SignOutButton } from "./SignOutButton";

/**
 * The shared page header — same on every screen, so the logo, tab bar and
 * sign-out never drift apart between pages. On mobile the tab bar collapses
 * (see AppTabs) and navigation moves to <BottomNav>.
 */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Link href="/" className="shrink-0" aria-label="Accueil">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no next/image benefit here */}
          <img
            src="/icons/icon-192.png"
            alt="Ma Bédéthèque"
            className="h-12 w-12 rounded-md"
          />
        </Link>
        <AppTabs />
      </div>
      <SignOutButton />
    </header>
  );
}
