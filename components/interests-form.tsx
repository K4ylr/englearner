"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type InterestsDefaults = {
  topics: string[];
  dailyNewGoal: number;
};

const TOPICS: { id: string; label: string; desc: string; emoji: string }[] = [
  { id: "daily", label: "日常生活", desc: "衣食住行、情感、人际", emoji: "🍳" },
  { id: "news", label: "新闻时事", desc: "政治、社会、国际报道", emoji: "📰" },
  { id: "business", label: "商务职场", desc: "会议、合同、管理", emoji: "💼" },
  { id: "academic", label: "学术研究", desc: "论文、课程、学科术语", emoji: "🎓" },
  { id: "travel", label: "旅行出行", desc: "机场、酒店、景点", emoji: "✈️" },
  { id: "tech", label: "科技互联网", desc: "编程、AI、产品", emoji: "💻" },
];

export function InterestsForm({
  action,
  defaults,
}: {
  action: (fd: FormData) => Promise<void>;
  defaults: InterestsDefaults;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaults.topics)
  );
  const [dailyNewGoal, setDailyNewGoal] = useState(defaults.dailyNewGoal);
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const canSubmit = selected.size > 0 && !submitting;

  async function onSubmit(fd: FormData) {
    setSubmitting(true);
    try {
      await action(fd);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-8">
      <div className="grid grid-cols-2 gap-3">
        {TOPICS.map((t) => {
          const on = selected.has(t.id);
          return (
            <label
              key={t.id}
              className={cn(
                "relative rounded-xl border p-4 cursor-pointer transition",
                on
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-fg-muted)]"
              )}
            >
              <input
                type="checkbox"
                name="topic"
                value={t.id}
                checked={on}
                onChange={() => toggle(t.id)}
                className="sr-only"
              />
              <div className="flex items-start gap-3">
                <div className="text-2xl">{t.emoji}</div>
                <div>
                  <div className="font-medium">{t.label}</div>
                  <div className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                    {t.desc}
                  </div>
                </div>
              </div>
              {on && (
                <div className="absolute top-2 right-2 size-5 rounded-full bg-[var(--color-brand)] text-white text-xs flex items-center justify-center">
                  ✓
                </div>
              )}
            </label>
          );
        })}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="dailyNewGoal" className="font-medium">
            每日新词目标
          </label>
          <div className="text-sm text-[var(--color-fg-muted)]">
            <span className="text-lg font-semibold text-[var(--color-fg)] tabular-nums">
              {dailyNewGoal}
            </span>
            <span className="ml-1">/ 天</span>
          </div>
        </div>
        <input
          id="dailyNewGoal"
          name="dailyNewGoal"
          type="range"
          min={5}
          max={50}
          step={5}
          value={dailyNewGoal}
          onChange={(e) => setDailyNewGoal(Number(e.target.value))}
          className="w-full accent-[var(--color-brand)]"
        />
        <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
          默认 10 个，循序渐进；设置后可在
          <span className="mx-0.5">「</span>设置<span className="mx-0.5">」</span>
          里随时修改。无尽模式下这个数字只是每批的下限。
        </p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full h-11 rounded-lg bg-[var(--color-brand)] text-white text-sm font-medium hover:bg-[var(--color-brand-hover)] transition disabled:opacity-50"
      >
        {submitting ? "保存中…" : "开始学习 →"}
      </button>
      {selected.size === 0 && (
        <p className="text-center text-xs text-amber-600">至少选一个方向</p>
      )}
    </form>
  );
}
