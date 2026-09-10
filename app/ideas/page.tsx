"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDataClient } from "@/lib/neon-client";
import { useSession } from "@/hooks/useSession";
import { AppTabs } from "@/components/AppTabs";
import { SignOutButton } from "@/components/SignOutButton";
import { IdeaCard } from "@/components/IdeaCard";
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

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | "all">("all");

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

  const filtered = useMemo(
    () => (statusFilter === "all" ? ideas : ideas.filter((i) => i.status === statusFilter)),
    [ideas, statusFilter],
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
    if (error) setError(error.message);
  }

  async function handleDelete(idea: Idea) {
    if (!window.confirm("Supprimer définitivement cette idée ?")) return;
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    const { error } = await getDataClient().from("ideas").delete().eq("id", idea.id);
    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, no next/image benefit here */}
            <img
              src="/icons/icon-192.png"
              alt="Ma Bédéthèque"
              className="h-12 w-12 rounded-md"
            />
          </Link>
          <AppTabs />
        </div>
        <SignOutButton />
      </header>

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
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          {ideas.length === 0
            ? "Aucune idée pour le moment — ajoutez la première !"
            : "Aucune idée ne correspond à ce filtre."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onChangeStatus={(status) => handleChangeStatus(idea, status)}
              onDelete={() => handleDelete(idea)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
