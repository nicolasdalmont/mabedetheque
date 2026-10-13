import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Shared empty state for tabs with nothing in them yet: says what the tab is
// for (a bare "Aucun…" leaves a new user guessing) and offers the next step.
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <Icon size={36} className="text-yellow-500" aria-hidden="true" />
      <p className="text-base font-medium">{title}</p>
      <p className="text-sm text-zinc-500">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-1 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-300"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
