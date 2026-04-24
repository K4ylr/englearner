import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame, Settings, Trophy } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDashboardStats } from "@/lib/stats";
import { ActivityHeatmap, HeatmapLegend, MasteryCurve } from "@/components/dashboard-charts";

export const metadata = { title: "仪表盘 · EngLearner" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyNewGoal: true,
      cefrLevel: true,
      estVocabSize: true,
      onboardedAt: true,
      mode: true,
    },
  });

  const totalWords = await prisma.word.count();

  if (user && !user.onboardedAt && totalWords > 0) {
    redirect("/onboarding/placement");
  }

  const needsSeeding = totalWords === 0;

  const [stats, dueCount] = await Promise.all([
    getDashboardStats(userId),
    prisma.userWord.count({
      where: { userId, due: { lte: new Date() }, state: { not: "mastered" } },
    }),
  ]);

  const dailyNewGoal = user?.dailyNewGoal ?? 10;
  const mode = user?.mode ?? "endless";
  const remainingNew =
    mode === "endless"
      ? Infinity
      : Math.max(0, dailyNewGoal - stats.totals.todayNew);
  const canStudy =
    !needsSeeding && (dueCount > 0 || mode === "endless" || remainingNew > 0);

  const accuracy =
    stats.totals.todayTotal > 0
      ? Math.round((stats.totals.todayCorrect / stats.totals.todayTotal) * 100)
      : null;

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--color-fg-muted)]">已登录</div>
            <div className="font-medium">{session.user.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              aria-label="设置"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition"
            >
              <Settings className="size-4" />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] transition"
              >
                退出
              </button>
            </form>
          </div>
        </header>

        {needsSeeding ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-2">
            <div className="font-medium">⚠️ 词库还没导入</div>
            <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
              管理员请调用 <code>POST /api/admin/seed</code> 带 header{" "}
              <code>x-admin-secret</code>（15k 词需要循环调用直到 done:true）。
            </p>
          </section>
        ) : (
          <>
            {/* Hero — today + streak side by side */}
            <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
                    今日任务
                    {mode === "endless" && (
                      <span className="text-[0.65rem] uppercase tracking-wider bg-[var(--color-brand)]/10 text-[var(--color-brand)] px-2 py-0.5 rounded">
                        无尽模式
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-3xl font-semibold">
                    {mode === "endless" ? (
                      <>
                        {dueCount > 0 ? dueCount : "∞"}{" "}
                        <span className="text-base font-normal text-[var(--color-fg-muted)]">
                          {dueCount > 0
                            ? "待复习 + 新词随学随有"
                            : "张新词随时可学"}
                        </span>
                      </>
                    ) : (
                      <>
                        {dueCount +
                          (Number.isFinite(remainingNew) ? remainingNew : 0)}{" "}
                        <span className="text-base font-normal text-[var(--color-fg-muted)]">
                          张卡片
                        </span>
                      </>
                    )}
                  </div>
                  {mode !== "endless" && (
                    <div className="mt-1 text-sm text-[var(--color-fg-muted)]">
                      {Number.isFinite(remainingNew) ? remainingNew : 0} 新词 ·{" "}
                      {dueCount} 待复习
                    </div>
                  )}
                </div>
                <Link
                  href={canStudy ? "/study" : "/settings"}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-brand)] px-6 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] transition"
                >
                  {canStudy ? "开始学习 →" : "去设置调整 →"}
                </Link>
                {stats.totals.todayTotal > 0 && (
                  <div className="text-sm text-[var(--color-fg-muted)] flex items-center gap-3 pt-2 border-t border-[var(--color-border)]">
                    <span>
                      今日已学{" "}
                      <strong className="text-[var(--color-fg)] tabular-nums">
                        {stats.totals.todayTotal}
                      </strong>{" "}
                      张
                    </span>
                    {accuracy !== null && (
                      <>
                        <span className="text-[var(--color-border)]">·</span>
                        <span>
                          正确率{" "}
                          <strong className="text-[var(--color-fg)] tabular-nums">
                            {accuracy}%
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
                  <Flame className="size-4 text-orange-500" />
                  连续打卡
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tabular-nums">
                    {stats.streak.current}
                  </span>
                  <span className="text-sm text-[var(--color-fg-muted)]">
                    天
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
                  <Trophy className="size-3" />
                  最长 {stats.streak.longest} 天
                </div>
                {stats.streak.current === 0 && (
                  <p className="mt-3 text-xs text-[var(--color-fg-muted)] leading-relaxed">
                    今天还没开始学哦，完成一张就能把连续记录续上。
                  </p>
                )}
              </div>
            </section>

            {/* Current totals */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="已掌握"
                value={stats.totals.masteredCount.toLocaleString()}
                hint="稳定度 ≥ 180 天"
              />
              <Stat
                label="熟悉中"
                value={stats.totals.knownCount.toLocaleString()}
                hint="已进入长期记忆"
              />
              <Stat
                label="本周新学"
                value={stats.totals.thisWeekNew.toLocaleString()}
                hint="过去 7 天"
              />
              <Stat
                label="CEFR / 词汇量"
                value={user?.cefrLevel ?? "—"}
                hint={
                  user?.estVocabSize
                    ? `约 ${user.estVocabSize.toLocaleString()} 词`
                    : "未测评"
                }
              />
            </section>

            {/* Activity heatmap + mastery curve side-by-side on lg */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
                <div>
                  <h2 className="font-medium">活跃热力图</h2>
                  <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                    过去 6 周每日新词 + 复习总量
                  </p>
                </div>
                <div className="text-[var(--color-fg-muted)] flex justify-center">
                  <ActivityHeatmap data={stats.activity} />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
                  <span>
                    活跃 {stats.activity.filter((d) => d.newDone + d.reviewDone > 0).length} 天
                  </span>
                  <HeatmapLegend />
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">词汇量增长曲线</h2>
                    <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                      过去 30 天累计学过的词数
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">
                      {stats.totals.totalEverSeen.toLocaleString()}
                    </div>
                    <div className="text-xs text-[var(--color-fg-muted)]">
                      / {totalWords.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-[var(--color-fg-muted)]">
                  <MasteryCurve data={stats.cumulative} />
                </div>
                <div className="text-xs text-[var(--color-fg-muted)]">
                  30 天增长{" "}
                  <strong className="text-[var(--color-fg)] tabular-nums">
                    {(() => {
                      const d =
                        stats.cumulative[stats.cumulative.length - 1].count -
                        stats.cumulative[0].count;
                      return `${d >= 0 ? "+" : ""}${d}`;
                    })()}
                  </strong>{" "}
                  词
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--color-fg-muted)]">{hint}</div>
      ) : null}
    </div>
  );
}
