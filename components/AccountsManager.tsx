"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Pencil, Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useSession } from "@/hooks/useSession";
import { getNeonClient, safeAuthCall } from "@/lib/neon-client";
import { fetchAccountStats, flagPasswordChange, type AccountStats } from "@/lib/password-flag";
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

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function formatStats(stat: AccountStats | undefined): string | null {
  if (!stat) return null;
  const albums = `${stat.albumCount} album${stat.albumCount > 1 ? "s" : ""}`;
  const seen = stat.lastSeenAt
    ? `dernière connexion ${dateFormat.format(new Date(stat.lastSeenAt))}`
    : "jamais connecté";
  return `${albums} · ${seen}`;
}

// Gestion des comptes (admin) : affichée directement sur la page « Mon compte ».
export function AccountsManager() {
  const toast = useToast();
  const { user } = useSession();

  const [members, setMembers] = useState<Member[] | null>(null);
  const [stats, setStats] = useState<Map<string, AccountStats>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [password, setPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TempResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await safeAuthCall(
      getNeonClient().auth.admin.listUsers({ query: { limit: 200, sortBy: "name" } }),
    );
    if (error) {
      setLoadError(error.message ?? "Chargement impossible.");
      return;
    }
    const users = (data as { users?: Record<string, unknown>[] } | null)?.users ?? [];
    fetchAccountStats().then(setStats);
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
    // Reporté d'un tick : évite le setState synchrone dans l'effet (lint).
    Promise.resolve().then(load);
  }, [load]);

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
    const { data, error } = await safeAuthCall(
      getNeonClient().auth.admin.createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      }),
    );
    if (error) {
      setPending(false);
      setCreateError(error.message ?? "Création impossible.");
      return;
    }
    // Le compte existe déjà : un échec ici n'annule pas la création, on prévient.
    const newId = (data as { user?: { id?: string } } | null)?.user?.id;
    const flagError = newId ? await flagPasswordChange(newId) : "identifiant du compte introuvable";
    setPending(false);
    if (flagError) {
      toast.error(`Compte créé, mais le changement de mot de passe forcé n'a pas pu être activé (${flagError}).`);
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
    const flagError = await flagPasswordChange(member.id);
    if (flagError) {
      toast.error(`Mot de passe réinitialisé, mais le changement forcé n'a pas pu être activé (${flagError}).`);
    }
    setResult({ kind: "reset", name: member.name, email: member.email, password: tempPassword });
  }

  function openEdit(member: Member) {
    setEditName(member.name);
    setEditEmail(member.email);
    setEditError(null);
    setEditingId(member.id);
  }

  async function handleEdit(e: React.FormEvent, member: Member) {
    e.preventDefault();
    const nextName = editName.trim();
    const nextEmail = editEmail.trim();
    const data: { name?: string; email?: string } = {};
    if (nextName !== member.name) data.name = nextName;
    if (nextEmail !== member.email) data.email = nextEmail;
    if (Object.keys(data).length === 0) {
      setEditingId(null);
      return;
    }
    setEditPending(true);
    setEditError(null);
    const { error } = await safeAuthCall(
      getNeonClient().auth.admin.updateUser({ userId: member.id, data }),
    );
    setEditPending(false);
    if (error) {
      setEditError(error.message ?? "Enregistrement impossible.");
      return;
    }
    setEditingId(null);
    toast.success("Compte mis à jour");
    await load();
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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Comptes</h2>
        {!showCreate ? (
          <button type="button" onClick={openCreate} className={`${buttonClass} inline-flex items-center gap-1.5`}>
            <Plus size={16} aria-hidden="true" />
            Ajouter un compte
          </button>
        ) : null}
      </div>

      {result ? (
        <div className="space-y-2 rounded-xl border border-yellow-500/40 bg-yellow-50 p-4 text-sm dark:bg-yellow-950/30">
          <p>
            {result.kind === "created" ? "Compte créé pour" : "Mot de passe réinitialisé pour"}{" "}
            <strong>{result.name || result.email}</strong>. Transmettez-lui ce mot de passe
            temporaire (il ne sera plus affiché) ; elle devra en choisir un nouveau dès sa première connexion.
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
          className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10"
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
        <ul className="flex flex-col divide-y divide-black/10 rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
          {members.map((m) => {
            const isSelf = m.id === user?.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {editingId === m.id ? (
                  <form onSubmit={(e) => handleEdit(e, m)} className="w-full space-y-3">
                    <div className="space-y-1">
                      <label htmlFor={`edit-name-${m.id}`} className="text-sm font-medium">Prénom Nom</label>
                      <input id={`edit-name-${m.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={80} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`edit-email-${m.id}`} className="text-sm font-medium">Email</label>
                      <input id={`edit-email-${m.id}`} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required className={inputClass} />
                      <p className="text-xs text-zinc-500">
                        L&apos;email sert à la connexion et à la récupération du mot de passe : prévenez la personne.
                      </p>
                    </div>
                    {editError ? <p className="text-sm text-red-600 dark:text-red-400">{editError}</p> : null}
                    <div className="flex gap-2">
                      <button type="submit" disabled={editPending} className={buttonClass}>
                        {editPending ? "Enregistrement..." : "Enregistrer"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={ghostButtonClass}>
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                <>
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
                  {formatStats(stats.get(m.id)) ? (
                    <p className="truncate text-xs text-zinc-500">{formatStats(stats.get(m.id))}</p>
                  ) : null}
                </div>
                {!isSelf ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(m)} className={ghostButtonClass}>
                      <Pencil size={14} aria-hidden="true" />
                      Modifier
                    </button>
                    <button type="button" onClick={() => handleRole(m)} className={ghostButtonClass}>
                      {m.role === "admin" ? "Rétrograder" : "Promouvoir"}
                    </button>
                    <button type="button" onClick={() => handleReset(m)} className={ghostButtonClass}>
                      <KeyRound size={14} aria-hidden="true" />
                      Réinitialiser
                    </button>
                  </div>
                ) : null}
                </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
