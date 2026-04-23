"use client";

import { useEffect, useRef, useState } from "react";
import { Play, ExternalLink } from "lucide-react";

// YouGlish shows real speakers saying the word in context. We embed it via
// the official widget (widget.js + YG.Widget). Directly iframing
// `youglish.com/pronounce/X` doesn't work — that page sets
// X-Frame-Options: SAMEORIGIN and refuses third-party embedding.
//
// If the widget script fails to load (ad-blocker, network, CSP), we gracefully
// fall back to link-out buttons. A YouTube search link is always shown as a
// reliable alternative regardless.

declare global {
  interface Window {
    YG?: {
      Widget: new (
        elementId: string,
        options: {
          width?: number | string;
          components?: number;
          autoStart?: number;
          events?: Record<string, (...args: unknown[]) => void>;
        }
      ) => {
        fetch: (query: string, language: string) => void;
      };
    };
  }
}

const SCRIPT_SRC = "https://youglish.com/public/emb/widget.js";

// Cache the script promise so we only inject the <script> once per page.
let scriptPromise: Promise<void> | null = null;

function loadWidgetScript(timeoutMs = 5000): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("ssr"));
  }
  if (window.YG) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    const el = existing ?? document.createElement("script");
    if (!existing) {
      el.src = SCRIPT_SRC;
      el.async = true;
      document.head.appendChild(el);
    }
    const timer = window.setTimeout(() => {
      scriptPromise = null;
      reject(new Error("youglish widget script timed out"));
    }, timeoutMs);
    el.addEventListener("load", () => {
      window.clearTimeout(timer);
      if (window.YG) resolve();
      else {
        scriptPromise = null;
        reject(new Error("youglish widget loaded but YG missing"));
      }
    });
    el.addEventListener("error", () => {
      window.clearTimeout(timer);
      scriptPromise = null;
      reject(new Error("youglish widget script failed to load"));
    });
  });
  return scriptPromise;
}

export function YouGlishEmbed({ word }: { word: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">(
    "idle"
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    setStatus("loading");
    let cancelled = false;
    loadWidgetScript()
      .then(() => {
        if (cancelled || !window.YG || !containerRef.current) return;
        if (!containerRef.current.id) {
          containerRef.current.id = `yg-${Math.random().toString(36).slice(2)}`;
        }
        try {
          const widget = new window.YG.Widget(containerRef.current.id, {
            width: "100%",
            components: 9,
            events: {},
          });
          widget.fetch(word, "english");
          setStatus("ready");
        } catch {
          setStatus("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [open, word]);

  const youglishUrl = `https://youglish.com/pronounce/${encodeURIComponent(
    word
  )}/english`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    word + " pronunciation"
  )}`;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] h-8 px-3 text-sm hover:bg-[var(--color-border)] transition"
        >
          <Play className="size-3.5" />
          听真人怎么说
        </button>
        <OutboundLinks youglish={youglishUrl} youtube={youtubeUrl} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {status === "failed" ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-fg-muted)] space-y-2">
          <div>
            站内播放器没加载出来，可能被网络或广告拦截挡住了。试试外站 👇
          </div>
          <OutboundLinks youglish={youglishUrl} youtube={youtubeUrl} prominent />
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden bg-black">
          <div ref={containerRef} className="w-full min-h-[240px]" />
          {status === "loading" && (
            <div className="p-3 text-xs text-[var(--color-fg-muted)] bg-[var(--color-surface)]">
              加载 YouGlish…
            </div>
          )}
        </div>
      )}
      <OutboundLinks youglish={youglishUrl} youtube={youtubeUrl} />
    </div>
  );
}

function OutboundLinks({
  youglish,
  youtube,
  prominent = false,
}: {
  youglish: string;
  youtube: string;
  prominent?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1 hover:text-[var(--color-fg)] transition";
  const cls = prominent
    ? `${base} text-sm text-[var(--color-brand)] hover:underline`
    : `${base} text-xs text-[var(--color-fg-muted)]`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={youglish} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        在 YouGlish 打开
      </a>
      <a href={youtube} target="_blank" rel="noopener noreferrer" className={cls}>
        <ExternalLink className="size-3" />
        YouTube 搜索
      </a>
    </div>
  );
}
