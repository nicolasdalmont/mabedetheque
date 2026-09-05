"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getNeonClient } from "@/lib/neon-client";

type SessionUser = { id: string; email: string; name?: string | null };

export function useSession() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getNeonClient()
      .auth.getSession()
      .then(({ data }) => {
        if (ignore) return;
        setUser(data?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setUser(null);
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await getNeonClient().auth.signOut();
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, loading, signOut };
}
