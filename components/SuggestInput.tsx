"use client";

import { useMemo, useState } from "react";

/**
 * Plain text input with a suggestions dropdown, filtered client-side
 * (substring, case-insensitive, excludes an exact match of the current
 * value) as the user types. `onMouseDown` + `preventDefault` on a
 * suggestion lets the click register before the input's `onBlur` would
 * otherwise close the list first.
 */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  className,
  ...inputProps
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.toLowerCase() !== q && s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, value]);

  return (
    <div className="relative">
      <input
        {...inputProps}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={className}
      />
      {open && matches.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-40 w-full divide-y divide-black/5 overflow-y-auto rounded-md border border-black/10 bg-white shadow-md dark:divide-white/10 dark:border-white/10 dark:bg-zinc-900">
          {matches.map((name) => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setOpen(false);
                }}
                className="block w-full px-2 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
