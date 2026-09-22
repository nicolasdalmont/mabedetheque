import { useEffect, useRef, useState } from "react";

// `onChange` writes to the URL (router.replace) which re-renders the whole
// album grid — expensive enough that firing it on every keystroke makes
// fast typing race the re-render and drop/scramble characters. Buffer
// keystrokes in local state and debounce before propagating.
export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Stay in sync when the value changes from outside (e.g. "Effacer les filtres").
  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (text === value) return;
    const timeout = setTimeout(() => onChangeRef.current(text), 250);
    return () => clearTimeout(timeout);
  }, [text, value]);

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      autoCapitalize="none"
      autoCorrect="off"
      aria-label="Rechercher dans la collection"
      placeholder="Rechercher un titre, une série, un auteur, un ISBN..."
      className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-yellow-500 sm:text-sm dark:border-white/20 dark:focus:border-yellow-400"
    />
  );
}
