"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Check, Circle, X } from "lucide-react";

const DISMISS_KEY = "onboarding-dismissed";
const DISMISS_EVENT = "onboarding-dismissed-change";

function subscribe(cb: () => void) {
  window.addEventListener(DISMISS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(DISMISS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function getStandalone() {
  // iOS Safari exposes navigator.standalone instead of the media query.
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function noopSubscribe() {
  return () => {};
}

type Step = { label: string; done: boolean; href?: string };

// First-use checklist on the Accueil. Steps tick themselves from data already
// loaded (albums, wishlist) — no extra DB flag — and the card goes away once
// everything is done or the user hides it (per-browser, localStorage).
export function OnboardingChecklist({
  albumCount,
  wishlistCount,
}: {
  albumCount: number;
  wishlistCount: number;
}) {
  const dismissed = useSyncExternalStore(subscribe, getDismissed, () => true);
  const installed = useSyncExternalStore(noopSubscribe, getStandalone, () => true);

  const steps: Step[] = [
    { label: "Ajouter votre premier album (scan ou saisie de l'ISBN)", done: albumCount > 0, href: "/albums/new" },
    { label: "Ajouter un tome à votre liste d'achats", done: wishlistCount > 0, href: "/albums/new?achat=1" },
    {
      label: "Installer l'app sur l'écran d'accueil (menu Partager sur iPhone, « Installer » sous Chrome)",
      done: installed,
    },
  ];

  if (dismissed || steps.every((s) => s.done)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <section className="rounded-lg border border-yellow-400/50 bg-yellow-400/10 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Bienvenue dans votre bédéthèque</h2>
          <p className="text-xs text-zinc-500">Quelques étapes pour bien démarrer.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer"
          title="Masquer"
          className="rounded p-1 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2 text-sm">
            {s.done ? (
              <Check size={16} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
            ) : (
              <Circle size={16} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden="true" />
            )}
            {s.done || !s.href ? (
              <span className={s.done ? "text-zinc-500 line-through" : ""}>{s.label}</span>
            ) : (
              <Link href={s.href} className="underline decoration-yellow-500 underline-offset-2">
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
