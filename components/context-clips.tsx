"use client";

import { useEffect, useState } from "react";
import { Play, ExternalLink, Shuffle } from "lucide-react";

// Embed a short YouTube clip where the word appears (TV scene, vocab
// explainer, etc.) via youtube.com/embed. Video IDs come from our
// server-side Data API call, cached per-word in the DB.
//
// If nothing usable comes back (quota exhausted, key missing, search
// returned zero embeddable shorts) we fall back to outbound search links:
// YouTube, YouGlish, PlayPhrase.

type State =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "ready"; videoIds: string[]; idx: number }
  | { kind: "empty" }
  | { kind: "error" };

export function ContextClips({ word }: { word: string }) {
  const [state, setState] = useState<State>({ kind: "closed" });

  useEffect(() => {
    if (state.kind !== "loading") return;
    let cancelled = false;
    fetch(`/api/clips/youtube?word=${encodeURIComponent(word)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { videoIds: string[] }) => {
        if (cancelled) return;
        if (data.videoIds && data.videoIds.length > 0) {
          setState({ kind: "ready", videoIds: data.videoIds, idx: 0 });
        } else {
          setState({ kind: "empty" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [state.kind, word]);

  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `"${word}" scene`
  )}`;
  const youglishUrl = `https://youglish.com/pronounce/${encodeURIComponent(
    word
  )}/english`;
  const playphraseUrl = `https://www.playphrase.me/#/search?q=${encodeURIComponent(
    word
  )}`;

  if (state.kind === "closed") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setState({ kind: "loading" })}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] h-8 px-3 text-sm hover:bg-[var(--color-border)] transition"
        >
          <Play className="size-3.5" />
          看英美剧怎么说
        </button>
        <OutboundLinks
          youtube={youtubeUrl}
          youglish={youglishUrl}
          playphrase={playphraseUrl}
        />
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-fg-muted)]">
        搜索视频片段中…
      </div>
    );
  }

  if (state.kind === "empty" || state.kind === "error") {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-fg-muted)] space-y-2">
        <div>
          {state.kind === "empty"
            ? "没找到合适的视频片段。换几个站试试 👇"
            : "视频加载失败，换几个站试试 👇"}
        </div>
        <OutboundLinks
          youtube={youtubeUrl}
          youglish={youglishUrl}
          playphrase={playphraseUrl}
          prominent
        />
      </div>
    );
  }

  const currentId = state.videoIds[state.idx];
  const embedSrc = `https://www.youtube.com/embed/${encodeURIComponent(
    currentId
  )}`;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden bg-black aspect-video">
        <iframe
          key={currentId}
          src={embedSrc}
          title={`YouTube clip for ${word}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
          <span className="tabular-nums">
            {state.idx + 1} / {state.videoIds.length}
          </span>
          {state.videoIds.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setState({
                  ...state,
                  idx: (state.idx + 1) % state.videoIds.length,
                })
              }
              className="inline-flex items-center gap-1 h-7 px-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)] transition"
            >
              <Shuffle className="size-3" />
              换一个
            </button>
          )}
        </div>
        <OutboundLinks
          youtube={youtubeUrl}
          youglish={youglishUrl}
          playphrase={playphraseUrl}
        />
      </div>
    </div>
  );
}

function OutboundLinks({
  youtube,
  youglish,
  playphrase,
  prominent = false,
}: {
  youtube: string;
  youglish: string;
  playphrase: string;
  prominent?: boolean;
}) {
  const base = "inline-flex items-center gap-1 transition";
  const cls = prominent
    ? `${base} text-sm text-[var(--color-brand)] hover:underline`
    : `${base} text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={youtube} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        YouTube 搜索
      </a>
      <a href={youglish} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        YouGlish
      </a>
      <a href={playphrase} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        PlayPhrase
      </a>
    </div>
  );
}
