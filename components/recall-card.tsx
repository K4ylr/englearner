"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Volume2, RefreshCw } from "lucide-react";
import { PronounceButton } from "./pronounce-button";
import { YouGlishEmbed } from "./youglish-embed";
import { gradeAnswer, type Rating } from "@/lib/grading";
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

type Mode = "spell" | "dictate";

// Hide all whole-word occurrences of the lemma in an example sentence so the
// learner can't read the answer off the example. Falls back to the plain
// sentence if the lemma doesn't appear.
function maskExample(sentence: string, lemma: string): string {
  const pattern = new RegExp(
    `\\b${lemma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es|ed|ing|ly)?\\b`,
    "gi"
  );
  return sentence.replace(pattern, "___");
}

export function RecallCard({
  mode,
  initialQueue,
}: {
  mode: Mode;
  initialQueue: QueueItem[];
}) {
  const router = useRouter();
  const [queue] = useState<QueueItem[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [autoRating, setAutoRating] = useState<Rating | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const startRef = useRef<number>(Date.now());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = queue[idx];
  const done = idx >= queue.length;

  // Auto-play audio when a new dictate card shows up.
  useEffect(() => {
    if (mode !== "dictate" || !current || revealed) return;
    const t = setTimeout(() => playAudio(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, mode, revealed]);

  // Keep focus on the input across card transitions.
  useEffect(() => {
    if (!revealed) inputRef.current?.focus();
  }, [idx, revealed]);

  function playAudio() {
    if (!current) return;
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(
      current.lemma
    )}&type=0`;
    if (!audioRef.current) audioRef.current = new Audio(url);
    else audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
  }

  const sendRating = useCallback(
    async (rating: Rating) => {
      if (!current) return;
      const durationMs = Date.now() - startRef.current;
      try {
        await fetch("/api/study/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wordId: current.wordId,
            rating,
            mode,
            durationMs,
          }),
        });
      } catch {
        // Best-effort — we still advance so the user isn't stuck.
      }
      setStats((s) => ({
        correct: s.correct + (rating >= 3 ? 1 : 0),
        total: s.total + 1,
      }));
    },
    [current, mode]
  );

  const submit = useCallback(async () => {
    if (!current || submitting || revealed) return;
    setSubmitting(true);
    try {
      const grade = gradeAnswer(guess, current.lemma);
      setAutoRating(grade.rating);
      setRevealed(true);
      await sendRating(grade.rating);
    } finally {
      setSubmitting(false);
    }
  }, [current, guess, revealed, sendRating, submitting]);

  const skip = useCallback(async () => {
    if (!current || revealed) return;
    setAutoRating(1);
    setRevealed(true);
    await sendRating(1);
  }, [current, revealed, sendRating]);

  const next = useCallback(() => {
    setGuess("");
    setRevealed(false);
    setAutoRating(null);
    setIdx((i) => i + 1);
    startRef.current = Date.now();
  }, []);

  // If user manually overrides the rating after reveal, fire an extra review
  // with the new rating. FSRS will compose the two updates; the more recent
  // rating dominates stability.
  const override = useCallback(
    async (rating: Rating) => {
      if (!current || !revealed) return;
      setAutoRating(rating);
      await sendRating(rating);
    },
    [current, revealed, sendRating]
  );

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (!revealed) {
        if (e.key === "Escape") {
          e.preventDefault();
          skip();
        } else if (e.key === "Enter" && guess.trim().length > 0) {
          e.preventDefault();
          submit();
        } else if (
          mode === "dictate" &&
          (e.key === "r" || e.key === "R") &&
          document.activeElement !== inputRef.current
        ) {
          e.preventDefault();
          playAudio();
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "1") override(1);
      else if (e.key === "2") override(2);
      else if (e.key === "3") override(3);
      else if (e.key === "4") override(4);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, revealed, guess, mode, submit, skip, next, override]);

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

  const autoLabel =
    autoRating === 3 ? "✓ 正确" : autoRating === 2 ? "~ 差一点" : "✗ 错误";
  const autoTone =
    autoRating === 3
      ? "text-emerald-600"
      : autoRating === 2
      ? "text-amber-600"
      : "text-rose-600";

  return (
    <div className="space-y-6">
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
          {current.cefr && <span className="text-xs">{current.cefr}</span>}
        </div>
        <div>
          正确率{" "}
          {stats.total === 0
            ? "—"
            : `${Math.round((stats.correct / stats.total) * 100)}%`}
        </div>
      </header>

      <div
        className={cn(
          "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] min-h-[480px] p-6 sm:p-10",
          revealed ? "lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-10" : "flex flex-col"
        )}
      >
        {/* Prompt */}
        {!revealed ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            {mode === "spell" ? (
              <>
                <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                  看中文，拼英文
                </div>
                {current.defZh ? (
                  <div className="text-3xl sm:text-4xl leading-relaxed max-w-xl">
                    {current.defZh}
                  </div>
                ) : (
                  <div className="text-xl text-[var(--color-fg-muted)] max-w-xl">
                    {current.defEn}
                  </div>
                )}
                {current.examples[0] && (
                  <div className="text-sm text-[var(--color-fg-muted)] border-l-2 border-[var(--color-border)] pl-3 max-w-xl text-left">
                    {maskExample(current.examples[0].en, current.lemma)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                  听音拼写
                </div>
                <button
                  onClick={playAudio}
                  className="size-28 rounded-full bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] transition flex items-center justify-center shadow-lg"
                  aria-label="播放发音"
                >
                  <Volume2 className="size-10" />
                </button>
                <button
                  onClick={playAudio}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                >
                  <RefreshCw className="size-3" />
                  重播（R）
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Left panel — lemma + pronounce */}
            <div className="flex flex-col items-center justify-center gap-5 lg:border-r lg:border-[var(--color-border)] lg:pr-10 text-center">
              {autoRating !== null && (
                <div className={cn("text-sm font-medium", autoTone)}>
                  {autoLabel}
                  {autoRating !== 3 && guess && (
                    <span className="ml-2 text-[var(--color-fg-muted)] font-normal">
                      你写的: <code className="font-mono">{guess}</code>
                    </span>
                  )}
                </div>
              )}
              <div className="text-6xl sm:text-7xl lg:text-8xl font-semibold tracking-tight break-words leading-[1.05]">
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

            {/* Right panel — definitions + examples + video */}
            <div className="mt-8 lg:mt-0 pt-6 lg:pt-0 border-t lg:border-t-0 border-[var(--color-border)] space-y-5 overflow-y-auto">
              {current.defZh && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
                    中文释义
                  </div>
                  <div className="text-xl leading-relaxed">{current.defZh}</div>
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
          </>
        )}
      </div>

      {/* Actions */}
      {!revealed ? (
        <div className="space-y-3">
          <input
            ref={inputRef}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="输入英文…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full h-14 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-lg font-mono outline-none focus:border-[var(--color-brand)] transition"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={skip}
              className="h-12 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] transition"
            >
              不会 <span className="text-xs opacity-70">Esc</span>
            </button>
            <button
              onClick={submit}
              disabled={guess.trim().length === 0 || submitting}
              className="h-12 rounded-xl bg-[var(--color-brand)] text-white text-sm font-medium hover:bg-[var(--color-brand-hover)] transition disabled:opacity-50"
            >
              提交 <span className="text-xs opacity-80">Enter</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={next}
            className="w-full h-12 rounded-xl bg-[var(--color-brand)] text-white text-sm font-medium hover:bg-[var(--color-brand-hover)] transition"
          >
            下一张 <span className="text-xs opacity-80">Enter</span>
          </button>
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <span>覆盖自动评分：</span>
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <kbd
                key={r}
                className={cn(
                  "inline-block rounded border px-2 py-0.5 font-mono cursor-pointer transition",
                  autoRating === r
                    ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                    : "border-[var(--color-border)] hover:text-[var(--color-fg)]"
                )}
                onClick={() => override(r)}
              >
                {r}
              </kbd>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
