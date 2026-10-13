export type IdeaStatus = "created" | "processed" | "done";

export type Idea = {
  id: string;
  owner_id: string;
  content: string;
  status: IdeaStatus;
  // Réponse de l'administrateur (null tant qu'il n'a pas répondu).
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
};

export const IDEA_STATUS_ORDER: IdeaStatus[] = ["created", "processed", "done"];

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  created: "Créée",
  processed: "Traitée",
  done: "Terminée",
};
