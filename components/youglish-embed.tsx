"use client";

import { useState } from "react";
import { Play } from "lucide-react";

// YouGlish embeds video clips of real speakers saying the word — huge for
// hearing natural pronunciation in context. We open on demand so the iframe
// doesn't load until the user asks (saves bandwidth during a review session).
export function YouGlishEmbed({ word }: { word: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] h-8 px-3 text-sm hover:bg-[var(--color-border)] transition"
      >
        <Play className="size-3.5" />
        听真人怎么说
      </button>
    );
  }

  const src = `https://youglish.com/pronounce/${encodeURIComponent(
    word
  )}/english?`;

  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden bg-black aspect-video">
      <iframe
        src={src}
        title={`YouGlish: ${word}`}
        allow="autoplay; encrypted-media"
        className="size-full"
      />
    </div>
  );
}
