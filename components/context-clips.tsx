"use client";

import { useEffect, useState } from "react";
import { Play, ExternalLink, Shuffle } from "lucide-react";

// Embed a TV/movie snippet where a native speaker says this word, via
// getyarn.io's public /yarn-clip/<id>/embed page. The clip IDs come from
// our server-side scrape API, which caches results per-word in the DB.
// If nothing usable comes back, we fall back to outbound search links.

type State =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "ready"; clipIds: string[]; idx: number }
  | { kind: "empty" } // API returned no clips
  | { kind: "error" };

export function ContextClips({ word }: { word: string }) {
  const [state, setState] = useState<State>({ kind: "closed" });

  useEffect(() => {
    if (state.kind !== "loading") return;
    let cancelled = false;
    fetch(`/api/clips/yarn?word=${encodeURIComponent(word)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { clipIds: string[] }) => {
        if (cancelled) return;
        if (data.clipIds && data.clipIds.length > 0) {
          setState({ kind: "ready", clipIds: data.clipIds, idx: 0 });
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

  const searchUrl = `https://getyarn.io/yarn-find?text=${encodeURIComponent(word)}`;
  const playphraseUrl = `https://www.playphrase.me/#/search?q=${encodeURIComponent(
    word
  )}`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    word + " scene"
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
          getyarn={searchUrl}
          playphrase={playphraseUrl}
          youtube={youtubeUrl}
        />
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-fg-muted)]">
        搜索英美剧片段中…
      </div>
    );
  }

  if (state.kind === "empty" || state.kind === "error") {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-fg-muted)] space-y-2">
        <div>
          {state.kind === "empty"
            ? "没找到对应的剧集片段。换几个站试试 👇"
            : "片段加载失败，换几个站试试 👇"}
        </div>
        <OutboundLinks
          getyarn={searchUrl}
          playphrase={playphraseUrl}
          youtube={youtubeUrl}
          prominent
        />
      </div>
    );
  }

  // ready
  const currentId = state.clipIds[state.idx];
  const embedSrc = `https://getyarn.io/yarn-clip/${encodeURIComponent(
    currentId
  )}/embed`;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden bg-black aspect-video">
        <iframe
          key={currentId}
          src={embedSrc}
          title={`TV/movie clip for ${word}`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="size-full"
        />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
          <span className="tabular-nums">
            {state.idx + 1} / {state.clipIds.length}
          </span>
          {state.clipIds.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setState({
                  ...state,
                  idx: (state.idx + 1) % state.clipIds.length,
                })
              }
              className="inline-flex items-center gap-1 h-7 px-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)] transition"
            >
              <Shuffle className="size-3" />
              换一个例子
            </button>
          )}
        </div>
        <OutboundLinks
          getyarn={searchUrl}
          playphrase={playphraseUrl}
          youtube={youtubeUrl}
        />
      </div>
    </div>
  );
}

function OutboundLinks({
  getyarn,
  playphrase,
  youtube,
  prominent = false,
}: {
  getyarn: string;
  playphrase: string;
  youtube: string;
  prominent?: boolean;
}) {
  const base = "inline-flex items-center gap-1 transition";
  const cls = prominent
    ? `${base} text-sm text-[var(--color-brand)] hover:underline`
    : `${base} text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={getyarn} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        getyarn
      </a>
      <a href={playphrase} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        PlayPhrase
      </a>
      <a href={youtube} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        YouTube 搜索
      </a>
    </div>
  );
}
