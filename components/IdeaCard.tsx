"use client";

import { useState } from "react";
import type { Idea, IdeaStatus } from "@/types/idea";
import { IDEA_STATUS_LABEL, IDEA_STATUS_ORDER } from "@/types/idea";
import { formatDateTime } from "@/lib/format";

const STATUS_COLOR: Record<IdeaStatus, string> = {
  created: "text-zinc-500 border-zinc-500/40",
  processed: "text-yellow-600 border-yellow-500/50 dark:text-yellow-400",
  done: "text-green-600 border-green-600/40 dark:text-green-400",
};

export function IdeaCard({
  idea,
  author,
  isAdmin,
  canDelete,
  onChangeStatus,
  onReply,
  onDelete,
}: {
  idea: Idea;
  // Auteur affiché (vue admin uniquement) ; null = pas d'étiquette.
  author: string | null;
  isAdmin: boolean;
  canDelete: boolean;
  onChangeStatus: (status: IdeaStatus) => void;
  onReply: (reply: string) => Promise<void>;
  onDelete: () => void;
}) {
  const when = formatDateTime(idea.created_at);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Seul l'admin peut changer le statut d'une idée qui n'est pas la sienne
  // (la RLS l'autorise pour lui, pas pour les autres comptes).
  const canChangeStatus = isAdmin || canDelete;

  async function saveReply() {
    setSaving(true);
    try {
      await onReply(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      {author ? <p className="mb-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">{author}</p> : null}
      <p className="mb-3 whitespace-pre-wrap text-sm">{idea.content}</p>

      {idea.reply && !editing ? (
        <div className="mb-3 rounded-md border-l-2 border-yellow-400 bg-yellow-400/10 px-3 py-2">
          <p className="mb-0.5 text-xs font-medium text-zinc-500">
            Réponse de l&apos;administrateur
            {idea.replied_at ? ` · ${formatDateTime(idea.replied_at)}` : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm">{idea.reply}</p>
        </div>
      ) : null}

      {editing ? (
        <div className="mb-3 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            aria-label="Réponse à l'idée"
            placeholder="Votre réponse…"
            className="w-full resize-y rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveReply}
              disabled={saving}
              className="rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-medium text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {saving ? "Envoi..." : draft.trim() ? "Enregistrer la réponse" : "Retirer la réponse"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">{when}</span>
        <div className="flex items-center gap-2">
          {isAdmin && !editing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(idea.reply ?? "");
                setEditing(true);
              }}
              className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
            >
              {idea.reply ? "Modifier la réponse" : "Répondre"}
            </button>
          ) : null}
          {canChangeStatus ? (
            <select
              value={idea.status}
              onChange={(e) => onChangeStatus(e.target.value as IdeaStatus)}
              aria-label="Statut"
              className={`rounded-md border bg-transparent px-2 py-1 text-xs outline-none ${STATUS_COLOR[idea.status]}`}
            >
              {IDEA_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {IDEA_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          ) : (
            <span className={`rounded-md border px-2 py-1 text-xs ${STATUS_COLOR[idea.status]}`}>
              {IDEA_STATUS_LABEL[idea.status]}
            </span>
          )}
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Supprimer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
