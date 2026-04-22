"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "recognize", label: "识别", desc: "看词想意思" },
  { id: "spell", label: "拼写", desc: "看中文拼英文" },
  { id: "dictate", label: "听写", desc: "听音写英文" },
] as const;

type Mode = (typeof MODES)[number]["id"];

const STORAGE_KEY = "englearner:study-mode";

export function StudyModeSelector({ current }: { current: Mode }) {
  const router = useRouter();
  const params = useSearchParams();

  // Persist last chosen mode so next visit restores it.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch {
      // Private-mode Safari etc.
    }
  }, [current]);

  function switchTo(mode: Mode) {
    if (mode === current) return;
    const next = new URLSearchParams(params);
    if (mode === "recognize") next.delete("mode");
    else next.set("mode", mode);
    const qs = next.toString();
    router.push(qs ? `/study?${qs}` : "/study");
  }

  return (
    <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {MODES.map((m) => {
        const active = m.id === current;
        return (
          <button
            key={m.id}
            onClick={() => switchTo(m.id)}
            className={cn(
              "px-3 h-8 rounded-md text-xs font-medium transition",
              active
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            )}
            title={m.desc}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// Helper: read saved mode from localStorage. Must be called in a client
// component effect; returns "recognize" by default.
export function readStoredMode(): Mode {
  if (typeof window === "undefined") return "recognize";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "spell" || v === "dictate") return v;
  return "recognize";
}
