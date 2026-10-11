// Dernier compte connecté sur cet appareil, gardé en localStorage pour que
// l'écran de connexion affiche son identité (et ne redemande que le mot de
// passe) plutôt que le formulaire complet.
const REMEMBERED_KEY = "mabedetheque:remembered-account";

export type RememberedAccount = { email: string; name: string | null };

export function loadRemembered(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY);
    return raw ? (JSON.parse(raw) as RememberedAccount) : null;
  } catch {
    return null;
  }
}

export function saveRemembered(account: RememberedAccount) {
  try {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(account));
  } catch {
    // ignore (private browsing, storage disabled...)
  }
}
