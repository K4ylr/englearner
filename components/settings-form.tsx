"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type SettingsDefaults = {
  mode: "normal" | "endless";
  dailyNewGoal: number;
  dailyReviewCap: number;
  revealHoldMs: number;
  swipeRightIsKnow: boolean;
  topics: string[];
};

const TOPICS: { id: string; label: string; emoji: string }[] = [
  { id: "daily", label: "日常生活", emoji: "🍳" },
  { id: "news", label: "新闻时事", emoji: "📰" },
  { id: "business", label: "商务职场", emoji: "💼" },
  { id: "academic", label: "学术研究", emoji: "🎓" },
  { id: "travel", label: "旅行出行", emoji: "✈️" },
  { id: "tech", label: "科技互联网", emoji: "💻" },
];

export function SettingsForm({
  action,
  defaults,
}: {
  action: (fd: FormData) => Promise<void>;
  defaults: SettingsDefaults;
}) {
  const [mode, setMode] = useState<"normal" | "endless">(defaults.mode);
  const [newGoal, setNewGoal] = useState(defaults.dailyNewGoal);
  const [reviewCap, setReviewCap] = useState(defaults.dailyReviewCap);
  const [revealHold, setRevealHold] = useState(defaults.revealHoldMs);
  const [swipeRightIsKnow, setSwipeRightIsKnow] = useState(
    defaults.swipeRightIsKnow
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaults.topics)
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function onSubmit(fd: FormData) {
    setSaving(true);
    try {
      await action(fd);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = selected.size > 0 && !saving;

  return (
    <form action={onSubmit} className="space-y-8">
      {/* Mode */}
      <Section title="学习模式">
        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            active={mode === "endless"}
            onClick={() => setMode("endless")}
            name="mode"
            value="endless"
            title="无尽模式"
            desc="每日新词不设上限，复习照常调度"
          />
          <ModeCard
            active={mode === "normal"}
            onClick={() => setMode("normal")}
            name="mode"
            value="normal"
            title="常规模式"
            desc="按每日目标学，学完提示今天任务完成"
          />
        </div>
      </Section>

      {/* Daily new */}
      <Section title={mode === "endless" ? "每批新词数" : "每日新词目标"}>
        <Slider
          id="dailyNewGoal"
          value={newGoal}
          onChange={setNewGoal}
          min={5}
          max={50}
          step={5}
          suffix="个"
        />
        <p className="text-xs text-[var(--color-fg-muted)] mt-2 leading-relaxed">
          {mode === "endless"
            ? "无尽模式下，每次从学习页拿到至少这么多新词；做完还会再取下一批。"
            : "到达这个数量后今天就"}
        </p>
      </Section>

      {/* Daily review cap */}
      <Section title="每日复习上限">
        <Slider
          id="dailyReviewCap"
          value={reviewCap}
          onChange={setReviewCap}
          min={20}
          max={200}
          step={10}
          suffix="张"
        />
        <p className="text-xs text-[var(--color-fg-muted)] mt-2 leading-relaxed">
          防止堆积太多复习把你压垮。超出部分会顺延到明天。
        </p>
      </Section>

      {/* Reveal hold */}
      <Section title="评分后停留时间">
        <Slider
          id="revealHoldMs"
          value={revealHold}
          onChange={setRevealHold}
          min={0}
          max={5000}
          step={500}
          suffix="毫秒"
        />
        <p className="text-xs text-[var(--color-fg-muted)] mt-2 leading-relaxed">
          识别模式下选择&ldquo;会&rdquo;之后卡片会停留一段时间让你再看一眼释义；
          按 Space / Enter 可立即进入下一张。设为 0 就不等待。
          选了&ldquo;不会&rdquo;时不自动跳转——卡片会一直保留释义等你手动进下一张。
        </p>
      </Section>

      {/* Swipe direction */}
      <Section title="滑动方向偏好">
        <input
          type="hidden"
          name="swipeRightIsKnow"
          value={swipeRightIsKnow ? "1" : "0"}
        />
        <div className="grid grid-cols-2 gap-3">
          <SwipeCard
            active={swipeRightIsKnow}
            onClick={() => setSwipeRightIsKnow(true)}
            title="右滑 = 会"
            desc="左滑 = 不会（默认，和 Tinder 一样）"
          />
          <SwipeCard
            active={!swipeRightIsKnow}
            onClick={() => setSwipeRightIsKnow(false)}
            title="右滑 = 不会"
            desc="左滑 = 会（惯用右手也可以把不要的甩到右边）"
          />
        </div>
        <p className="text-xs text-[var(--color-fg-muted)] mt-2 leading-relaxed">
          仅影响识别模式的手势（和 J/K 键盘无关）。
        </p>
      </Section>

      {/* Interests */}
      <Section title="兴趣方向">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {TOPICS.map((t) => {
            const on = selected.has(t.id);
            return (
              <label
                key={t.id}
                className={cn(
                  "rounded-lg border p-3 cursor-pointer transition flex items-center gap-3",
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
                <div className="text-xl">{t.emoji}</div>
                <div className="flex-1 text-sm font-medium">{t.label}</div>
                {on && (
                  <div className="size-4 rounded-full bg-[var(--color-brand)] text-white text-[0.65rem] flex items-center justify-center">
                    ✓
                  </div>
                )}
              </label>
            );
          })}
        </div>
        {selected.size === 0 && (
          <p className="text-xs text-amber-600 mt-2">至少选一个方向</p>
        )}
      </Section>

      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-[var(--color-fg-muted)]">
          {savedAt && !saving ? "已保存 ✓" : null}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-10 px-6 rounded-lg bg-[var(--color-brand)] text-white text-sm font-medium hover:bg-[var(--color-brand-hover)] transition disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium mb-3">{title}</h2>
      {children}
    </div>
  );
}

function SwipeCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border p-4 transition",
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-fg-muted)]"
      )}
    >
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-[var(--color-fg-muted)] mt-1 leading-relaxed">
        {desc}
      </div>
    </button>
  );
}

function ModeCard({
  active,
  onClick,
  name,
  value,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  value: string;
  title: string;
  desc: string;
}) {
  return (
    <label
      className={cn(
        "rounded-xl border p-4 cursor-pointer transition",
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-fg-muted)]"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={active}
        onChange={onClick}
        className="sr-only"
      />
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-[var(--color-fg-muted)] mt-1 leading-relaxed">
        {desc}
      </div>
    </label>
  );
}

function Slider({
  id,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--color-fg-muted)]">
          {min} – {max}
        </span>
        <span className="text-2xl font-semibold tabular-nums">
          {value}
          <span className="text-sm font-normal text-[var(--color-fg-muted)] ml-1">
            {suffix}
          </span>
        </span>
      </div>
      <input
        id={id}
        name={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-brand)]"
      />
    </div>
  );
}
