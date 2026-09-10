"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

type ToastApi = {
  toast: (message: string, tone?: Tone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONE_CLASS: Record<Tone, string> = {
  success: "border-green-600/30 bg-green-50 text-green-800 dark:border-green-400/30 dark:bg-green-950 dark:text-green-200",
  error: "border-red-600/30 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-950 dark:text-red-200",
  info: "border-black/15 bg-white text-zinc-900 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (m) => toast(m, "success"),
      error: (m) => toast(m, "error"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Above the mobile bottom nav (z-40) and dialogs; safe-area aware. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => remove(t.id)}
            className={`pointer-events-auto max-w-sm rounded-lg border px-4 py-2.5 text-sm shadow-lg ${TONE_CLASS[t.tone]}`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Safe to call outside a provider (falls back to a no-op) so a component can
// use it without every test/host wiring the provider.
export function useToast(): ToastApi {
  return (
    useContext(ToastContext) ?? {
      toast: () => {},
      success: () => {},
      error: () => {},
    }
  );
}
