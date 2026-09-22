// Shared display formatting. Dates in the DB are ISO strings ("2024-03-15",
// or a full timestamptz); render them the French way, consistently, rather
// than each screen picking its own (or showing the raw ISO).

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
}

// "Intégrale" remplace le numéro de tome quand l'album compile plusieurs
// tomes en un seul volume, "Hors série" quand il sort de la numérotation
// normale (voir AlbumForm) — les trois notions sont mutuellement exclusives.
export function tomeLabel(
  issueNumber: number | null | undefined,
  isIntegrale: boolean,
  isHorsSerie: boolean,
): string | null {
  if (isIntegrale) return "Intégrale";
  if (isHorsSerie) return "Hors série";
  return issueNumber != null ? `#${issueNumber}` : null;
}
