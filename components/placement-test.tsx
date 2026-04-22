"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PronounceButton } from "./pronounce-button";
import { cn } from "@/lib/utils";

type Card = {
  wordId: number;
  lemma: string;
  ipaUs: string | null;
  ipaUk: string | null;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1";
};

type Answer = { wordId: number; cefr: Card["cefr"]; known: boolean };

export function PlacementTest({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    cefrLevel: string;
    estVocabSize: number;
  } | null>(null);

  const total = cards.length;
  const current = cards[idx];
  const done = idx >= total;

  const answer = useCallback(
    (known: boolean) => {
      if (!current) return;
      setAnswers((a) => [
        ...a,
        { wordId: current.wordId, cefr: current.cefr, known },
      ]);
      setIdx((i) => i + 1);
    },
    [current]
  );

  // Submit when finished.
  useEffect(() => {
    if (!done || result || submitting || answers.length === 0) return;
    setSubmitting(true);
    fetch("/api/placement/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    })
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
      })
      .finally(() => setSubmitting(false));
  }, [done, answers, result, submitting]);

  // Keyboard: J = don't know, K or Space = know.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        answer(false);
      } else if (e.key === "k" || e.key === "K" || e.key === " ") {
        e.preventDefault();
        answer(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, done]);

  if (total === 0) {
    return (
      <div className="text-center space-y-4 py-16">
        <div className="text-3xl">⏳</div>
        <p className="text-[var(--color-fg-muted)]">
          词库还在导入，请稍后再来测评。
        </p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="text-5xl">🎯</div>
        <div>
          <div className="text-sm text-[var(--color-fg-muted)]">测评结果</div>
          <div className="mt-2 text-6xl font-semibold tracking-tight">
            {result.cefrLevel}
          </div>
          <div className="mt-2 text-[var(--color-fg-muted)]">
            估测词汇量约 {result.estVocabSize.toLocaleString()} 词
          </div>
        </div>
        <p className="text-sm text-[var(--color-fg-muted)] max-w-md mx-auto leading-relaxed">
          接下来选一下你感兴趣的内容方向，系统会据此推荐相关词汇。
        </p>
        <button
          onClick={() => router.push("/onboarding/interests")}
          className="inline-flex h-11 items-center px-6 rounded-lg bg-[var(--color-brand)] text-white text-sm font-medium hover:bg-[var(--color-brand-hover)] transition"
        >
          下一步：选兴趣方向 →
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-16">
        <div className="animate-spin size-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full mx-auto" />
        <p className="text-[var(--color-fg-muted)]">正在计算你的水平…</p>
      </div>
    );
  }

  const progress = (idx / total) * 100;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between text-sm text-[var(--color-fg-muted)] mb-2">
          <span>
            {idx + 1} / {total}
          </span>
          <span>请如实回答，不认识就说不认识</span>
        </div>
        <div className="h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-brand)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] min-h-[360px] p-8 flex flex-col items-center justify-center gap-5">
        <div className="text-6xl sm:text-7xl font-semibold tracking-tight text-center">
          {current.lemma}
        </div>
        {current.ipaUs && (
          <div className="text-[var(--color-fg-muted)] text-lg">
            /{current.ipaUs}/
          </div>
        )}
        <div className="flex items-center gap-2">
          <PronounceButton word={current.lemma} variant="us" size="sm" />
          <PronounceButton word={current.lemma} variant="uk" size="sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => answer(false)} tone="rose" shortcut="J">
          不认识
        </Button>
        <Button onClick={() => answer(true)} tone="emerald" shortcut="K">
          认识
        </Button>
      </div>

      <p className="text-center text-xs text-[var(--color-fg-muted)]">
        键盘：<kbd className="kbd">J</kbd> 不认识 ·{" "}
        <kbd className="kbd">K</kbd> 或 <kbd className="kbd">Space</kbd> 认识
      </p>
    </div>
  );
}

function Button({
  onClick,
  tone,
  shortcut,
  children,
}: {
  onClick: () => void;
  tone: "rose" | "emerald";
  shortcut: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-16 rounded-xl text-white font-medium flex flex-col items-center justify-center gap-0.5 transition hover:brightness-110",
        tone === "rose" ? "bg-rose-500" : "bg-emerald-500"
      )}
    >
      <div className="text-base">{children}</div>
      <div className="text-xs opacity-80 tracking-wider">{shortcut}</div>
    </button>
  );
}
