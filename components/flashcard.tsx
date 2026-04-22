"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PronounceButton } from "./pronounce-button";
import { YouGlishEmbed } from "./youglish-embed";
import { cn } from "@/lib/utils";

type Example = { en: string; zh: string | null };
type QueueItem = {
  wordId: number;
  kind: "new" | "review";
  lemma: string;
  pos: string | null;
  ipaUs: string | null;
  ipaUk: string | null;
  defEn: string | null;
  defZh: string | null;
  cefr: string | null;
  examples: Example[];
};

type Rating = 1 | 2 | 3 | 4;

const RATING_LABELS: Record<Rating, { label: string; sub: string; tone: string }> = {
  1: { label: "不会", sub: "Again", tone: "bg-rose-500" },
  2: { label: "模糊", sub: "Hard", tone: "bg-amber-500" },
  3: { label: "会", sub: "Good", tone: "bg-emerald-500" },
  4: { label: "熟练", sub: "Easy", tone: "bg-sky-500" },
};

export function Flashcard({ initialQueue }: { initialQueue: QueueItem[] }) {
  const router = useRouter();
  const [queue] = useState<QueueItem[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const startRef = useRef<number>(Date.now());

  const current = queue[idx];
  const done = idx >= queue.length;

  const submit = useCallback(
    async (rating: Rating) => {
      if (!current || submitting) return;
      setSubmitting(true);
      const durationMs = Date.now() - startRef.current;
      try {
        await fetch("/api/study/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wordId: current.wordId,
            rating,
            durationMs,
          }),
        });
        setStats((s) => ({
          correct: s.correct + (rating >= 3 ? 1 : 0),
          total: s.total + 1,
        }));
        setFlipped(false);
        setIdx((i) => i + 1);
        startRef.current = Date.now();
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting]
  );

  // Keyboard: space to flip, 1-4 to rate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        return;
      }
      if (!flipped) return;
      if (e.key === "1") submit(1);
      else if (e.key === "2") submit(2);
      else if (e.key === "3") submit(3);
      else if (e.key === "4") submit(4);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, submit, done]);

  if (queue.length === 0) {
    return (
      <div className="text-center space-y-4 py-16">
        <div className="text-4xl">🎉</div>
        <h2 className="text-2xl font-semibold">今天没有任务</h2>
        <p className="text-[var(--color-fg-muted)]">
          明天再来吧——或者去设置里提高每日目标。
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-[var(--color-brand)] hover:underline"
        >
          返回仪表盘
        </Link>
      </div>
    );
  }

  if (done) {
    const accuracy =
      stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
    return (
      <div className="text-center space-y-4 py-16">
        <div className="text-4xl">✅</div>
        <h2 className="text-2xl font-semibold">今天的任务完成啦！</h2>
        <p className="text-[var(--color-fg-muted)]">
          一共 {stats.total} 张卡片，正确率 {accuracy}%
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="h-10 inline-flex items-center px-4 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] transition"
          >
            返回仪表盘
          </Link>
          <button
            onClick={() => router.refresh()}
            className="h-10 inline-flex items-center px-4 rounded-lg bg-[var(--color-brand)] text-white text-sm hover:bg-[var(--color-brand-hover)] transition"
          >
            继续下一组
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between text-sm text-[var(--color-fg-muted)]">
        <div>
          {idx + 1} / {queue.length}
          <span className="mx-2">·</span>
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-xs",
              current.kind === "new"
                ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                : "bg-amber-500/10 text-amber-600"
            )}
          >
            {current.kind === "new" ? "新词" : "复习"}
          </span>
          {current.cefr && (
            <span className="ml-2 text-xs text-[var(--color-fg-muted)]">
              {current.cefr}
            </span>
          )}
        </div>
        <div>
          正确率{" "}
          {stats.total === 0
            ? "—"
            : `${Math.round((stats.correct / stats.total) * 100)}%`}
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] min-h-[380px] p-8 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="text-4xl sm:text-5xl font-semibold tracking-tight">
            {current.lemma}
          </div>
          {current.pos && (
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              {current.pos}
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-[var(--color-fg-muted)]">
            {current.ipaUs && <span>/{current.ipaUs}/</span>}
            <PronounceButton word={current.lemma} variant="us" size="sm" />
            <PronounceButton word={current.lemma} variant="uk" size="sm" />
          </div>
        </div>

        {flipped ? (
          <div className="border-t border-[var(--color-border)] pt-6 mt-6 space-y-4">
            {current.defZh && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  中文释义
                </div>
                <div className="text-lg leading-relaxed">{current.defZh}</div>
              </div>
            )}
            {current.defEn && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  English
                </div>
                <div className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  {current.defEn}
                </div>
              </div>
            )}
            {current.examples.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  例句
                </div>
                <ul className="space-y-2">
                  {current.examples.map((ex, i) => (
                    <li
                      key={i}
                      className="text-sm leading-relaxed border-l-2 border-[var(--color-border)] pl-3"
                    >
                      <div>{ex.en}</div>
                      {ex.zh && (
                        <div className="text-[var(--color-fg-muted)]">
                          {ex.zh}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <YouGlishEmbed word={current.lemma} />
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="mt-6 h-10 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-border)] transition"
          >
            显示释义（Space）
          </button>
        )}
      </div>

      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as Rating[]).map((r) => (
            <button
              key={r}
              disabled={submitting}
              onClick={() => submit(r)}
              className={cn(
                "h-14 rounded-xl text-white font-medium transition flex flex-col items-center justify-center gap-0.5 disabled:opacity-50",
                RATING_LABELS[r].tone,
                "hover:brightness-110"
              )}
            >
              <div className="text-sm">{RATING_LABELS[r].label}</div>
              <div className="text-[0.65rem] opacity-80 tracking-wider">
                {r} · {RATING_LABELS[r].sub}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
