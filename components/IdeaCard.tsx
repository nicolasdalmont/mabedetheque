import type { Idea, IdeaStatus } from "@/types/idea";
import { IDEA_STATUS_LABEL, IDEA_STATUS_ORDER } from "@/types/idea";

const STATUS_COLOR: Record<IdeaStatus, string> = {
  created: "text-zinc-500 border-zinc-500/40",
  processed: "text-yellow-600 border-yellow-500/50 dark:text-yellow-400",
  done: "text-green-600 border-green-600/40 dark:text-green-400",
};

export function IdeaCard({
  idea,
  onChangeStatus,
  onDelete,
}: {
  idea: Idea;
  onChangeStatus: (status: IdeaStatus) => void;
  onDelete: () => void;
}) {
  const when = new Date(idea.created_at).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <p className="mb-3 whitespace-pre-wrap text-sm">{idea.content}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">{when}</span>
        <div className="flex items-center gap-2">
          <select
            value={idea.status}
            onChange={(e) => onChangeStatus(e.target.value as IdeaStatus)}
            className={`rounded-md border bg-transparent px-2 py-1 text-xs outline-none ${STATUS_COLOR[idea.status]}`}
          >
            {IDEA_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {IDEA_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
