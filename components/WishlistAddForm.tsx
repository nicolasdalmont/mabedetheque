"use client";

import { useState } from "react";
import { getDataClient } from "@/lib/neon-client";
import { BnfTextSearch } from "@/components/BnfTextSearch";
import { seriesTitlesMatch } from "@/lib/bnf-series";
import type { Album } from "@/types/album";
import type { WishlistItem } from "@/types/wishlist";
import type { TextSearchCandidate } from "@/lib/bnf-text-search";

function onlyDigits(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, "");
}

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400";
const labelClass = "text-xs font-medium";

const emptyFields = {
  isbn: "",
  series_name: "",
  issue_number: "",
  title: "",
  publisher: "",
};

export function WishlistAddForm({
  ownerId,
  ownedAlbums,
  onAdded,
  onCancel,
}: {
  ownerId: string;
  /** Already-owned albums — search results matching one of these (by ISBN,
   * or by series + tome number) are hidden: no point buying a tome again. */
  ownedAlbums: Album[];
  onAdded: (item: WishlistItem) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState(emptyFields);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function setField<K extends keyof typeof emptyFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // Only prefills the form — searching by ISBN is a shortcut for manual
  // entry, not a requirement; every field stays editable either way.
  async function handleLookup() {
    if (!fields.isbn) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/isbn/${encodeURIComponent(fields.isbn)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Recherche impossible.");
      setFields((prev) => ({
        ...prev,
        isbn: data.isbn ?? prev.isbn,
        series_name: data.series_name || prev.series_name,
        issue_number: data.issue_number != null ? String(data.issue_number) : prev.issue_number,
        title: data.title || prev.title,
        publisher: data.publisher || prev.publisher,
      }));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSearching(false);
    }
  }

  function isAlreadyOwned(candidate: TextSearchCandidate): boolean {
    return ownedAlbums.some((a) => {
      if (candidate.isbn && a.isbn && onlyDigits(candidate.isbn) === onlyDigits(a.isbn)) {
        return true;
      }
      if (
        candidate.series_name &&
        candidate.issue_number != null &&
        a.series_name &&
        a.issue_number === candidate.issue_number
      ) {
        return seriesTitlesMatch(candidate.series_name, a.series_name);
      }
      return false;
    });
  }

  function handleTextSearchSelect(candidate: TextSearchCandidate) {
    setFields((prev) => ({
      ...prev,
      isbn: candidate.isbn ?? prev.isbn,
      series_name: candidate.series_name || prev.series_name,
      issue_number: candidate.issue_number != null ? String(candidate.issue_number) : prev.issue_number,
      title: candidate.title || prev.title,
      publisher: candidate.publisher || prev.publisher,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.series_name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, error } = await getDataClient()
        .from("wishlist_items")
        .insert({
          owner_id: ownerId,
          series_name: fields.series_name.trim(),
          issue_number: fields.issue_number ? Number(fields.issue_number) : null,
          title: fields.title.trim() || null,
          publisher: fields.publisher.trim() || null,
          isbn: fields.isbn.trim() || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      onAdded(data);
      setFields(emptyFields);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <div className="space-y-1">
        <label className={labelClass}>ISBN (optionnel, pour préremplir)</label>
        <div className="flex gap-2">
          <input
            value={fields.isbn}
            onChange={(e) => setField("isbn", e.target.value)}
            placeholder="Saisir un ISBN"
            autoComplete="off"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={searching || !fields.isbn}
            className="shrink-0 rounded-md border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
          >
            {searching ? "Recherche..." : "Rechercher"}
          </button>
        </div>
        {searchError ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {searchError} Vous pouvez continuer en saisie manuelle ci-dessous.
          </p>
        ) : null}
      </div>

      <BnfTextSearch onSelect={handleTextSearchSelect} excludeCandidate={isAlreadyOwned} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>Série *</label>
          <input
            required
            value={fields.series_name}
            onChange={(e) => setField("series_name", e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Numéro de tome</label>
          <input
            type="number"
            value={fields.issue_number}
            onChange={(e) => setField("issue_number", e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Éditeur</label>
          <input
            value={fields.publisher}
            onChange={(e) => setField("publisher", e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className={labelClass}>Titre</label>
          <input
            value={fields.title}
            onChange={(e) => setField("title", e.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !fields.series_name.trim()}
          className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-medium text-black hover:bg-yellow-300 disabled:opacity-50"
        >
          {saving ? "Ajout..." : "Ajouter à la liste"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-500 hover:underline"
        >
          Annuler
        </button>
      </div>
      {saveError ? <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p> : null}
    </form>
  );
}
