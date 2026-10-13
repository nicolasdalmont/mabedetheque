import { getDataClient } from "@/lib/neon-client";

// Drapeau « mot de passe temporaire » (table account_flags, migration 0011).
// Les erreurs réseau comptent comme « pas de changement exigé » côté lecture :
// on ne bloque jamais l'accès à l'app hors-ligne.
export async function fetchMustChangePassword(): Promise<boolean> {
  try {
    const { data } = await getDataClient()
      .from("account_flags")
      .select("must_change_password")
      .maybeSingle();
    return data?.must_change_password === true;
  } catch {
    return false;
  }
}

// Efface le drapeau de l'utilisateur connecté. Renvoie un message d'erreur ou null.
export async function clearPasswordChangeFlag(userId: string): Promise<string | null> {
  try {
    const { error } = await getDataClient()
      .from("account_flags")
      .update({ must_change_password: false })
      .eq("user_id", userId);
    return error ? (error.message ?? "erreur inconnue") : null;
  } catch {
    return "erreur réseau";
  }
}

// Admin uniquement (vérifié côté SQL) : impose le changement à `userId`.
export async function flagPasswordChange(userId: string): Promise<string | null> {
  try {
    const { error } = await getDataClient().rpc("flag_password_change", {
      target_user_id: userId,
    });
    return error ? (error.message ?? "erreur inconnue") : null;
  } catch {
    return "erreur réseau";
  }
}

// Horodate la présence de l'utilisateur connecté (account_flags.last_seen_at,
// migration 0012) pour la « dernière connexion » vue par les admins. Best effort :
// un échec (hors-ligne, migration pas encore appliquée) ne doit rien bloquer.
export async function touchLastSeen(): Promise<void> {
  try {
    await getDataClient().rpc("touch_last_seen");
  } catch {
    // ignoré
  }
}

export type AccountStats = { albumCount: number; lastSeenAt: string | null };

// Admin uniquement : stats par identifiant de compte. Map vide en cas d'échec.
export async function fetchAccountStats(): Promise<Map<string, AccountStats>> {
  const stats = new Map<string, AccountStats>();
  try {
    const { data } = await getDataClient().rpc("admin_account_stats");
    for (const row of data ?? []) {
      stats.set(row.user_id, { albumCount: row.album_count, lastSeenAt: row.last_seen_at });
    }
  } catch {
    // ignoré : la liste s'affiche sans stats
  }
  return stats;
}

// Admin uniquement (vérifié côté SQL, migration 0015) : supprime les données de
// l'app de `userId` et renvoie les URL de couvertures à purger du stockage, ou
// un message d'erreur. Le compte lui-même est supprimé séparément (removeUser).
export async function deleteAccountData(
  userId: string,
): Promise<{ covers: string[]; error: string | null }> {
  try {
    const { data, error } = await getDataClient().rpc("admin_delete_account_data", {
      target_user_id: userId,
    });
    if (error) return { covers: [], error: error.message ?? "erreur inconnue" };
    return { covers: (data as string[] | null) ?? [], error: null };
  } catch {
    return { covers: [], error: "erreur réseau" };
  }
}
