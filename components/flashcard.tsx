"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PronounceButton } from "./pronounce-button";
import { ContextClips } from "./context-clips";
import { Definition } from "./definition";
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

const RATING_META: Record<
  Rating,
  { label: string; sub: string; tone: string; key: string }
> = {
  1: { label: "不会", sub: "Again", tone: "bg-rose-500", key: "1" },
  2: { label: "模糊", sub: "Hard", tone: "bg-amber-500", key: "2" },
  3: { label: "会", sub: "Good", tone: "bg-emerald-500", key: "3" },
  4: { label: "熟练", sub: "Easy", tone: "bg-sky-500", key: "4" },
};

export function Flashcard({
  initialQueue,
  revealHoldMs,
  swipeRightIsKnow,
}: {
  initialQueue: QueueItem[];
  revealHoldMs: number;
  swipeRightIsKnow: boolean;
}) {
  const router = useRouter();
  const [queue] = useState<QueueItem[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [holdingRating, setHoldingRating] = useState<Rating | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const startRef = useRef<number>(Date.now());
  const holdTimerRef = useRef<number | null>(null);

  // --- Touch/pointer swipe gestures (Tinder-style) ----------------------
  // Card follows finger horizontally with a rotation. Past threshold (or fast
  // flick), it flies off in that direction and we rate: right = Good, left =
  // Again. Mid-hold swipe just advances like Space/Enter.
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragAxisRef = useRef<"pending" | "horizontal" | "vertical">("pending");
  const exitTimerRef = useRef<number | null>(null);

  const current = queue[idx];
  const done = idx >= queue.length;
  const holding = holdingRating !== null;

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearHoldTimer();
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    [clearHoldTimer]
  );

  const advance = useCallback(() => {
    clearHoldTimer();
    setHoldingRating(null);
    setFlipped(false);
    setDragX(0);
    setExitDir(null);
    setIdx((i) => i + 1);
    startRef.current = Date.now();
  }, [clearHoldTimer]);

  const submit = useCallback(
    async (rating: Rating) => {
      if (!current || submitting || holding) return;
      setSubmitting(true);
      setFlipped(true);
      setHoldingRating(rating);
      const durationMs = Date.now() - startRef.current;
      try {
        await fetch("/api/study/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wordId: current.wordId,
            rating,
            mode: "recognize",
            durationMs,
          }),
        });
        setStats((s) => ({
          correct: s.correct + (rating >= 3 ? 1 : 0),
          total: s.total + 1,
        }));
        // Wrong answers (Again) keep the definition on screen indefinitely —
        // the user asked to study it before moving on. Only auto-advance for
        // ratings where the user says they knew it (Hard/Good/Easy).
        if (rating === 1) {
          // no-op: wait for manual advance (swipe / Space / Enter / click)
        } else if (revealHoldMs <= 0) {
          advance();
        } else {
          holdTimerRef.current = window.setTimeout(advance, revealHoldMs);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting, holding, revealHoldMs, advance]
  );

  // --- Swipe handlers (defined after submit/advance so closure is fresh).
  // Not wrapped in useCallback: the card re-renders on every drag tick
  // anyway (dragX is state), so referential stability buys nothing.
  const SWIPE_THRESHOLD_PX = 110;
  const SWIPE_VELOCITY = 0.5; // px per ms

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (exitDir) return;
    const target = e.target as HTMLElement;
    // Let buttons, links, iframes, form fields handle their own input.
    if (target.closest("button, a, input, select, textarea, iframe")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
    };
    dragAxisRef.current = "pending";
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // First meaningful movement: decide horizontal (swipe) vs vertical
    // (scroll). If vertical, bail so the page can scroll normally.
    if (dragAxisRef.current === "pending") {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 8 && absDy < 8) return;
      if (absDy > absDx) {
        dragAxisRef.current = "vertical";
        setDragging(false);
        setDragX(0);
        dragStartRef.current = null;
        return;
      }
      dragAxisRef.current = "horizontal";
    }
    setDragX(dx);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragStartRef.current) {
      setDragging(false);
      return;
    }
    const dx = e.clientX - dragStartRef.current.x;
    const dt = Math.max(performance.now() - dragStartRef.current.t, 1);
    const velocity = Math.abs(dx) / dt;
    dragStartRef.current = null;
    setDragging(false);

    const commit =
      Math.abs(dx) > SWIPE_THRESHOLD_PX || velocity > SWIPE_VELOCITY;
    if (!commit) {
      setDragX(0); // spring back
      return;
    }

    const dir: "left" | "right" = dx > 0 ? "right" : "left";
    setExitDir(dir);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      if (holding) {
        advance();
      } else {
        // Reset drag; submit() enters hold phase so the definition reveals
        // in place (the card "reappears" with the translation shown).
        setDragX(0);
        setExitDir(null);
        const knowsDir: "left" | "right" = swipeRightIsKnow ? "right" : "left";
        submit(dir === knowsDir ? 3 : 1);
      }
    }, 260);
  }

  // Keyboard flow:
  //   Space / Enter   — flip; after flip, Space = Good (3). During hold, advance early.
  //   J / ←           — Again (1) "don't know"
  //   K / →           — Good (3)  "know"
  //   1 / 2 / 3 / 4   — precise rating
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;

      if (holding) {
        // Post-rating reveal: any of these advances immediately.
        if (
          e.key === " " ||
          e.key === "Enter" ||
          e.key === "k" ||
          e.key === "K" ||
          e.key === "ArrowRight" ||
          e.key === "j" ||
          e.key === "J" ||
          e.key === "ArrowLeft"
        ) {
          e.preventDefault();
          advance();
        }
        return;
      }

      if (!flipped) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setFlipped(true);
        } else if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
          // Power-user: say "I don't know it" without flipping first.
          e.preventDefault();
          submit(1);
        } else if (e.key === "k" || e.key === "K" || e.key === "ArrowRight") {
          e.preventDefault();
          submit(3);
        }
        return;
      }

      // flipped, no rating yet
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        submit(3);
      } else if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
        e.preventDefault();
        submit(1);
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowRight") {
        e.preventDefault();
        submit(3);
      } else if (e.key === "1") submit(1);
      else if (e.key === "2") submit(2);
      else if (e.key === "3") submit(3);
      else if (e.key === "4") submit(4);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, submit, done, holding, advance]);

  if (queue.length === 0) {
    return (
      <div className="text-center space-y-4 py-16">
        <div className="text-4xl">🎉</div>
        <h2 className="text-2xl font-semibold">暂时没有任务</h2>
        <p className="text-[var(--color-fg-muted)]">
          到设置里切换到<strong className="font-medium">无尽模式</strong>可以一直学。
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="h-10 inline-flex items-center px-4 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] transition"
          >
            返回仪表盘
          </Link>
          <Link
            href="/settings"
            className="h-10 inline-flex items-center px-4 rounded-lg bg-[var(--color-brand)] text-white text-sm hover:bg-[var(--color-brand-hover)] transition"
          >
            去设置
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    const accuracy =
      stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
    return (
      <div className="text-center space-y-4 py-16">
        <div className="text-4xl">✅</div>
        <h2 className="text-2xl font-semibold">这一组背完啦！</h2>
        <p className="text-[var(--color-fg-muted)]">
          一共 {stats.total} 张，正确率 {accuracy}%
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
            再来一组 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meta row */}
      <header className="flex items-center justify-between text-sm text-[var(--color-fg-muted)]">
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {idx + 1} / {queue.length}
          </span>
          <span className="text-[var(--color-border)]">·</span>
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
            <span className="text-xs">{current.cefr}</span>
          )}
        </div>
        <div>
          正确率{" "}
          {stats.total === 0
            ? "—"
            : `${Math.round((stats.correct / stats.total) * 100)}%`}
        </div>
      </header>

      {/* Card — goes two-column on wide screens: word+pronounce on the
          left, definition/examples/video on the right (after flip).
          Wrapped in pointer handlers for Tinder-style swipe gestures. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: exitDir
            ? `translate3d(${
                exitDir === "right" ? "130%" : "-130%"
              }, 0, 0) rotate(${exitDir === "right" ? 22 : -22}deg)`
            : dragX !== 0
            ? `translate3d(${dragX}px, 0, 0) rotate(${dragX / 22}deg)`
            : undefined,
          transition: dragging
            ? "none"
            : "transform 280ms cubic-bezier(.22,.61,.36,1)",
          touchAction: "pan-y",
        }}
        className={cn(
          "relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] min-h-[560px] p-6 sm:p-10 select-none",
          flipped ? "lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-10" : "flex flex-col"
        )}
      >
        {/* Swipe direction overlays — fade in as the user drags past ~40px.
            Labels/colors follow the user's swipeRightIsKnow preference. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-6 right-6 rounded-lg border-4 px-3 py-1 text-3xl font-bold rotate-12",
            swipeRightIsKnow
              ? "border-emerald-500 text-emerald-500"
              : "border-rose-500 text-rose-500"
          )}
          style={{
            opacity: Math.max(0, Math.min(1, (dragX - 40) / 80)),
          }}
        >
          {swipeRightIsKnow ? "会 ✓" : "不会 ✗"}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-6 left-6 rounded-lg border-4 px-3 py-1 text-3xl font-bold -rotate-12",
            swipeRightIsKnow
              ? "border-rose-500 text-rose-500"
              : "border-emerald-500 text-emerald-500"
          )}
          style={{
            opacity: Math.max(0, Math.min(1, (-dragX - 40) / 80)),
          }}
        >
          {swipeRightIsKnow ? "不会 ✗" : "会 ✓"}
        </div>
        {/* Left / top panel: the lemma itself */}
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-6 text-center min-w-0",
            flipped ? "lg:border-r lg:border-[var(--color-border)] lg:pr-10" : "flex-1"
          )}
        >
          <div
            className={cn(
              "font-semibold tracking-tight break-words leading-[1.05] w-full",
              flipped
                ? "text-5xl sm:text-6xl lg:text-7xl"
                : "text-7xl sm:text-8xl lg:text-9xl"
            )}
          >
            {current.lemma}
          </div>
          <div className="flex items-center gap-3 text-base">
            {current.pos && (
              <span className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                {current.pos}
              </span>
            )}
            {current.ipaUs && (
              <span className="text-[var(--color-fg-muted)]">
                /{current.ipaUs}/
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PronounceButton word={current.lemma} variant="us" />
            <PronounceButton word={current.lemma} variant="uk" />
          </div>
        </div>

        {flipped && (
          <div className="mt-8 lg:mt-0 pt-6 lg:pt-0 border-t lg:border-t-0 border-[var(--color-border)] space-y-5 overflow-y-auto min-w-0">
            {current.defZh && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  中文释义
                </div>
                <Definition text={current.defZh} size="lg" />
              </div>
            )}
            {current.defEn && (
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                  English
                </div>
                <Definition text={current.defEn} size="sm" muted />
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
            <ContextClips word={current.lemma} />
          </div>
        )}
      </div>

      {/* Actions */}
      {!flipped ? (
        <div className="space-y-3">
          <button
            onClick={() => setFlipped(true)}
            className="w-full h-12 rounded-xl border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] transition"
          >
            显示释义
          </button>
          <KeyboardHints
            lines={[
              { keys: ["Space"], desc: "显示释义" },
              { keys: ["J", "←"], desc: "不会" },
              { keys: ["K", "→"], desc: "会" },
            ]}
          />
          <p className="text-center text-xs text-[var(--color-fg-muted)] sm:hidden">
            {swipeRightIsKnow
              ? "👈 向左滑 = 不会　向右滑 = 会 👉"
              : "👈 向左滑 = 会　向右滑 = 不会 👉"}
          </p>
        </div>
      ) : holding ? (
        <div className="space-y-3">
          <button
            onClick={advance}
            className={cn(
              "w-full h-12 rounded-xl text-white text-sm font-medium transition flex items-center justify-center gap-2",
              RATING_META[holdingRating!].tone
            )}
          >
            <span>{RATING_META[holdingRating!].label}</span>
            <span className="opacity-75">· 下一张</span>
            <span className="text-xs opacity-80">Enter</span>
          </button>
          <KeyboardHints
            lines={[
              {
                keys: ["Space", "Enter"],
                desc:
                  holdingRating === 1
                    ? "记住了再进入下一张"
                    : "跳过等待进入下一张",
              },
            ]}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick 2-button row */}
          <div className="grid grid-cols-2 gap-2">
            <RateButton
              onClick={() => submit(1)}
              disabled={submitting}
              tone="bg-rose-500"
              label="不会"
              hint="J / ←"
            />
            <RateButton
              onClick={() => submit(3)}
              disabled={submitting}
              tone="bg-emerald-500"
              label="会"
              hint="K / → / Space"
            />
          </div>
          {/* Precise 4-button row */}
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <button
                key={r}
                disabled={submitting}
                onClick={() => submit(r)}
                className={cn(
                  "h-11 rounded-lg text-white text-xs font-medium transition flex items-center justify-center gap-1.5 disabled:opacity-50 hover:brightness-110",
                  RATING_META[r].tone
                )}
              >
                <kbd className="bg-black/25 rounded px-1 py-0.5 text-[0.65rem] tabular-nums">
                  {r}
                </kbd>
                <span>{RATING_META[r].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RateButton({
  onClick,
  disabled,
  tone,
  label,
  hint,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-16 rounded-xl text-white font-medium transition flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 hover:brightness-110",
        tone
      )}
    >
      <div className="text-base">{label}</div>
      <div className="text-[0.65rem] opacity-80 tracking-wider">{hint}</div>
    </button>
  );
}

function KeyboardHints({
  lines,
}: {
  lines: { keys: string[]; desc: string }[];
}) {
  return (
    <div className="flex items-center justify-center gap-4 text-xs text-[var(--color-fg-muted)] flex-wrap">
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {l.keys.map((k, j) => (
            <kbd
              key={j}
              className="inline-block rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[0.7rem] font-mono"
            >
              {k}
            </kbd>
          ))}
          <span>{l.desc}</span>
        </div>
      ))}
    </div>
  );
}
