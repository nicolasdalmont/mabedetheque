import { useRef, useState } from "react";

// `onChange` writes to the URL (router.replace) which re-renders the whole
// album grid — expensive enough that firing it on every keystroke makes
// fast typing race the re-render and drop/scramble characters. Buffer
// keystrokes in local state and debounce before propagating, entirely from
// the event handler (no effect) so a fast re-render never clears a pending
// keystroke before it commits.
export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  // Mirrors `value` so an external change (e.g. "Effacer les filtres") can
  // be told apart from one we're about to debounce ourselves.
  const [lastExternalValue, setLastExternalValue] = useState(value);
  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    setText(value);
  }

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (next: string) => {
    setText(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(next), 250);
  };

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      autoCapitalize="none"
      autoCorrect="off"
      aria-label="Rechercher dans la collection"
      placeholder="Rechercher un titre, une série, un auteur, un ISBN..."
      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
    />
  );
}
