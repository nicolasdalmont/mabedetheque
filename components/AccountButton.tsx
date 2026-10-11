"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export function AccountButton() {
  const { user } = useSession();
  if (!user) return null;

  return (
    <Link
      href="/compte"
      title="Mon compte"
      aria-label="Mon compte"
      className="shrink-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    >
      <UserRound size={20} aria-hidden="true" />
    </Link>
  );
}
