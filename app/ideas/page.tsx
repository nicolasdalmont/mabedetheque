"use client";

import { useEffect, useMemo, useState } from "react";
import { getDataClient, getNeonClient, safeAuthCall } from "@/lib/neon-client";
import { Lightbulb } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useSession } from "@/hooks/useSession";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IdeaCard } from "@/components/IdeaCard";
import { useToast } from "@/components/Toast";
import type { Idea, IdeaStatus } from "@/types/idea";
import { IDEA_STATUS_LABEL, IDEA_STATUS_ORDER } from "@/types/idea";

const chipClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${
    active
      ? "border-yellow-400 bg-yellow-400 text-black"
      : "border-black/15 text-zinc-600 hover:bg-black/5 dark:border-white/20 dark:text-zinc-400 dark:hover:bg-white/5"
  }`;

export default function IdeasPage() {
  const { user } = useSession();
  const { error: toastError } = useToast();

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | "all">("created");
  const [pendingDelete, setPendingDelete] = useState<Idea | null>(null);

  // Admin : voit les idées de tous les comptes (RLS) ; `authors` fait
  // correspondre owner_id → nom pour les étiqueter.
  const isAdmin = user?.role === "admin";
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"all" | "mine">("all");

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    getDataClient()
      .from("ideas")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (ignore) return;
        setError(error ? error.message : null);
        setIdeas(data ?? []);
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    safeAuthCall(
      getNeonClient().auth.admin.listUsers({ query: { limit: 200, sortBy: "name" } }),
    ).then(({ data }) => {
      if (ignore) return;
      const users = (data as { users?: Record<string, unknown>[] } | null)?.users ?? [];
      setAuthors(
        Object.fromEntries(
          users.map((u) => [String(u.id), String(u.name || u.email || "Compte inconnu")]),
        ),
      );
    });
    return () => {
      ignore = true;
    };
  }, [isAdmin]);

  const filtered = useMemo(
    () =>
      ideas.filter(
        (i) =>
          (statusFilter === "all" || i.status === statusFilter) &&
          (!isAdmin || scope === "all" || i.owner_id === user?.id),
      ),
    [ideas, statusFilter, isAdmin, scope, user?.id],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await getDataClient()
        .from("ideas")
        .insert({ content: content.trim(), owner_id: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setIdeas((prev) => [data, ...prev]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeStatus(idea: Idea, status: IdeaStatus) {
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, status } : i)));
    const { error } = await getDataClient().from("ideas").update({ status }).eq("id", idea.id);
    if (error) toastError(error.message);
  }

  async function handleReply(idea: Idea, text: string) {
    const patch = text
      ? { reply: text, replied_at: new Date().toISOString() }
      : { reply: null, replied_at: null };
    const { error } = await getDataClient().from("ideas").update(patch).eq("id", idea.id);
    if (error) {
      toastError(error.message);
      throw new Error(error.message);
    }
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, ...patch } : i)));
  }

  async function confirmDeleteIdea() {
    const idea = pendingDelete;
    if (!idea) return;
    setPendingDelete(null);
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    const { error } = await getDataClient().from("ideas").delete().eq("id", idea.id);
    if (error) {
      setIdeas((prev) => [idea, ...prev]);
      toastError(error.message);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <AppHeader />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-black/10 p-4 dark:border-white/10"
        >
          <label htmlFor="idea-content" className="text-sm font-medium">
            Nouvelle idée
          </label>
          <textarea
            id="idea-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            autoCapitalize="sentences"
            placeholder="Une idée d'amélioration pour l'app…"
            className="mt-1 w-full resize-y rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-medium text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {submitting ? "Ajout..." : "Ajouter l'idée"}
            </button>
          </div>
        </form>

        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setScope("all")} className={chipClass(scope === "all")}>
              Tous les comptes
            </button>
            <button type="button" onClick={() => setScope("mine")} className={chipClass(scope === "mine")}>
              Mes idées
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStatusFilter("all")} className={chipClass(statusFilter === "all")}>
            Toutes
          </button>
          {IDEA_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={chipClass(statusFilter === s)}
            >
              {IDEA_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-zinc-500">Chargement...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Aucune idée pour le moment"
            description="Une boîte à idées : notez ici une amélioration ou une envie pour l'app, puis suivez-la de « Créée » à « Terminée »."
          />
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            Aucune idée ne correspond à ce filtre.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                author={
                  isAdmin
                    ? idea.owner_id === user?.id
                      ? "Vous"
                      : (authors[idea.owner_id] ?? "Compte inconnu")
                    : null
                }
                isAdmin={isAdmin}
                canDelete={idea.owner_id === user?.id}
                onChangeStatus={(status) => handleChangeStatus(idea, status)}
                onReply={(text) => handleReply(idea, text)}
                onDelete={() => setPendingDelete(idea)}
              />
            ))}
          </div>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title="Supprimer l'idée"
          message="Supprimer définitivement cette idée ?"
          confirmLabel="Supprimer"
          onConfirm={confirmDeleteIdea}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    </div>
  );
}
