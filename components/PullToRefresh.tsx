"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;

// Lightweight pull-to-refresh for the installed PWA (no browser chrome, so
// no other way to force a data refresh on iOS). Passive listeners only — it
// never fights the native scroll; it just watches an at-the-top downward
// drag and reloads the page past a threshold.
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  useEffect(() => {
    function atTop() {
      return window.scrollY <= 0 && !document.querySelector("dialog[open]");
    }
    function onStart(e: TouchEvent) {
      startY.current = atTop() && !refreshing ? e.touches[0].clientY : null;
    }
    function onMove(e: TouchEvent) {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && atTop()) {
        setDragging(true);
        setPull(Math.min(dy * 0.5, THRESHOLD * 1.6));
      } else {
        startY.current = null;
        setDragging(false);
        setPull(0);
      }
    }
    function onEnd() {
      if (startY.current == null) return;
      startY.current = null;
      setDragging(false);
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        setTimeout(() => window.location.reload(), 200);
      } else {
        setPull(0);
      }
    }
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

  if (pull === 0 && !refreshing) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center sm:hidden"
      style={{
        transform: `translateY(${pull}px)`,
        transition: dragging ? "none" : "transform 0.2s ease",
      }}
    >
      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md dark:bg-zinc-800">
        <RefreshCw
          size={16}
          className={refreshing ? "animate-spin text-yellow-500" : "text-zinc-500"}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
