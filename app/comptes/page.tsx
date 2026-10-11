"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/components/Toast";
import { useSession } from "@/hooks/useSession";
import { getNeonClient, safeAuthCall } from "@/lib/neon-client";
import { generateTempPassword } from "@/lib/temp-password";

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400";
const buttonClass =
  "rounded-md bg-yellow-400 px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-300 disabled:opacity-50";
const ghostButtonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5";

type Role = "user" | "admin";
type Member = { id: string; name: string; email: string; role: Role };
// Mot de passe temporaire à transmettre : reste affiché jusqu'à fermeture.
type TempResult = { kind: "created" | "reset"; name: string; email: string; password: string };

export default function AccountsPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: sessionLoading } = useSession();
  const isAdmin = user?.role === "admin";

  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [password, setPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TempResult | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await safeAuthCall(
      getNeonClient().auth.admin.listUsers({ query: { limit: 200, sortBy: "name" } }),
    );
    if (error) {
      setLoadError(error.message ?? "Chargement impossible.");
      return;
    }
    const users = (data as { users?: Record<string, unknown>[] } | null)?.users ?? [];
    setMembers(
      users.map((u) => ({
        id: String(u.id),
        name: String(u.name ?? ""),
        email: String(u.email ?? ""),
        role: u.role === "admin" ? "admin" : "user",
      })),
    );
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!isAdmin) {
      router.replace("/compte");
      return;
    }
    // Reporté d'un tick : évite le setState synchrone dans l'effet (lint).
    Promise.resolve().then(load);
  }, [sessionLoading, isAdmin, router, load]);

  function openCreate() {
    setName("");
    setEmail("");
    setRole("user");
    setPassword(generateTempPassword());
    setCreateError(null);
    setShowCreate(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setCreateError(null);
    const { error } = await safeAuthCall(
      getNeonClient().auth.admin.createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      }),
    );
    setPending(false);
    if (error) {
      setCreateError(error.message ?? "Création impossible.");
      return;
    }
    setShowCreate(false);
    setResult({ kind: "created", name: name.trim(), email: email.trim(), password });
    await load();
  }

  async function handleReset(member: Member) {
    if (!window.confirm(`Réinitialiser le mot de passe de ${member.name || member.email} ?`)) return;
    const tempPassword = generateTempPassword();
    const { error } = await safeAuthCall(
      getNeonClient().auth.admin.setUserPassword({ userId: member.id, newPassword: tempPassword }),
    );
    if (error) {
      toast.error(error.message ?? "Réinitialisation impossible.");
      return;
    }
    setResult({ kind: "reset", name: member.name, email: member.email, password: tempPassword });
  }

  async function handleRole(member: Member) {
    const next: Role = member.role === "admin" ? "user" : "admin";
    const { error } = await safeAuthCall(
      getNeonClient().auth.admin.setRole({ userId: member.id, role: next }),
    );
    if (error) {
      toast.error(error.message ?? "Changement de rôle impossible.");
      return;
    }
    toast.success(next === "admin" ? "Compte administrateur" : "Compte utilisateur");
    await load();
  }

  async function copyPassword(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copié");
    } catch {
      toast.error("Copie impossible");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Comptes</h1>
        {isAdmin && !showCreate ? (
          <button type="button" onClick={openCreate} className={`${buttonClass} inline-flex items-center gap-1.5`}>
            <Plus size={16} aria-hidden="true" />
            Ajouter un compte
          </button>
        ) : null}
      </div>

      {result ? (
        <div className="max-w-md space-y-2 rounded-xl border border-yellow-500/40 bg-yellow-50 p-4 text-sm dark:bg-yellow-950/30">
          <p>
            {result.kind === "created" ? "Compte créé pour" : "Mot de passe réinitialisé pour"}{" "}
            <strong>{result.name || result.email}</strong>. Transmettez-lui ce mot de passe
            temporaire (il ne sera plus affiché) ; il pourra le changer depuis « Mon compte ».
          </p>
          <div className="flex items-center gap-2">
            <code className="rounded bg-black/10 px-2 py-1 font-mono dark:bg-white/10">{result.password}</code>
            <button type="button" onClick={() => copyPassword(result.password)} className={ghostButtonClass}>
              <Copy size={14} aria-hidden="true" />
              Copier
            </button>
            <button type="button" onClick={() => setResult(null)} className="ml-auto text-zinc-500 hover:underline">
              Fermer
            </button>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="max-w-md space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
        >
          <div className="space-y-1">
            <label htmlFor="new-name" className="text-sm font-medium">Prénom Nom</label>
            <input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-email" className="text-sm font-medium">Email</label>
            <input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-role" className="text-sm font-medium">Rôle</label>
            <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="new-password" className="text-sm font-medium">Mot de passe temporaire</label>
            <input id="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={`${inputClass} font-mono`} />
          </div>
          {createError ? <p className="text-sm text-red-600 dark:text-red-400">{createError}</p> : null}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonClass}>
              {pending ? "Création..." : "Créer le compte"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className={ghostButtonClass}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : !members ? (
        <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
      ) : (
        <ul className="flex max-w-2xl flex-col divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {members.map((m) => {
            const isSelf = m.id === user?.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-sm font-medium text-black">
                  {(m.name || m.email).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name || m.email}
                    {isSelf ? <span className="ml-1 text-zinc-500">(vous)</span> : null}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {m.email} · {m.role === "admin" ? "Administrateur" : "Utilisateur"}
                  </p>
                </div>
                {!isSelf ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleRole(m)} className={ghostButtonClass}>
                      {m.role === "admin" ? "Rétrograder" : "Promouvoir"}
                    </button>
                    <button type="button" onClick={() => handleReset(m)} className={ghostButtonClass}>
                      <KeyRound size={14} aria-hidden="true" />
                      Réinitialiser
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
