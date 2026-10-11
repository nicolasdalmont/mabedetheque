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
