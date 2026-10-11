"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountsManager } from "@/components/AccountsManager";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/components/Toast";
import { useSession } from "@/hooks/useSession";
import { getNeonClient, safeAuthCall } from "@/lib/neon-client";
import { clearPasswordChangeFlag, fetchMustChangePassword } from "@/lib/password-flag";
import { loadRemembered, saveRemembered } from "@/lib/remembered-account";

const cardClass =
  "w-full space-y-4 rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950";
const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400";
const buttonClass =
  "rounded-md bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-300 disabled:opacity-50";

function IdentityForm({ initialName, email }: { initialName: string; email: string }) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Indiquez votre prénom et votre nom.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await safeAuthCall(
      getNeonClient().auth.updateUser({ name: trimmed }),
    );
    setPending(false);
    if (error) {
      setError(error.message ?? "Enregistrement impossible.");
      return;
    }
    // Garde l'écran de connexion à jour (identité affichée).
    const remembered = loadRemembered();
    if (remembered && remembered.email === email) {
      saveRemembered({ ...remembered, name: trimmed });
    }
    setName(trimmed);
    toast.success("Identité mise à jour");
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <h2 className="text-base font-semibold">Identité</h2>
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Prénom Nom
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" value={email} readOnly disabled className={`${inputClass} opacity-60`} />
        <p className="text-xs text-zinc-500">
          L&apos;adresse sert à la connexion et à la récupération du mot de passe ; elle ne se
          modifie pas ici.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}

function PasswordForm({ forced, userId }: { forced: boolean; userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    const { error } = await safeAuthCall(
      getNeonClient().auth.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      }),
    );
    if (error) {
      setPending(false);
      setError(error.message ?? "Changement impossible.");
      return;
    }
    if (forced) {
      const clearError = await clearPasswordChangeFlag(userId);
      setPending(false);
      if (clearError) {
        setError(`Mot de passe modifié, mais la validation a échoué (${clearError}). Réessayez.`);
        return;
      }
      toast.success("Mot de passe modifié");
      router.replace("/");
      return;
    }
    setPending(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Mot de passe modifié");
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <div>
        <h2 className="text-base font-semibold">Mot de passe</h2>
        {forced ? (
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
            Votre compte utilise un mot de passe temporaire : choisissez le vôtre pour continuer
            (l&apos;actuel est le mot de passe temporaire reçu).
          </p>
        ) : null}
        <p className="mt-1 text-xs text-zinc-500">
          Mot de passe perdu ? Depuis l&apos;écran de connexion, « Mot de passe oublié ? » envoie
          un code par email.
        </p>
      </div>
      <div className="space-y-1">
        <label htmlFor="current-password" className="text-sm font-medium">
          Mot de passe actuel
        </label>
        <input
          id="current-password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="new-password" className="text-sm font-medium">
          Nouveau mot de passe
        </label>
        <input
          id="new-password"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Enregistrement..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}

export default function AccountPage() {
  const { user, loading } = useSession();
  const [forced, setForced] = useState(false);

  // Drapeau posé par un administrateur (mot de passe temporaire) : le
  // PasswordChangeGate redirige ici et le formulaire passe en mode « forcé ».
  useEffect(() => {
    if (!user) return;
    let ignore = false;
    fetchMustChangePassword().then((value) => {
      if (!ignore) setForced(value);
    });
    return () => {
      ignore = true;
    };
  }, [user]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />
      <h1 className="text-lg font-semibold">Mon compte</h1>

      {loading || !user ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className={forced ? "max-w-md" : "grid items-start gap-4 md:grid-cols-2 lg:max-w-4xl"}>
            {forced ? null : <IdentityForm initialName={user.name ?? ""} email={user.email} />}
            <PasswordForm forced={forced} userId={user.id} />
          </div>
          {user.role === "admin" && !forced ? (
            <div className="lg:max-w-4xl">
              <AccountsManager />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
