import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  // If the corpus is empty, onboarding can't work — show a seeding banner.
  // Otherwise if the user hasn't completed onboarding, push them through it.
  if (user && !user.onboardedAt && totalWords > 0) {
    redirect("/onboarding/placement");
  }

  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const [dueCount, todaySession] = await Promise.all([
    prisma.userWord.count({
      where: { userId, due: { lte: now }, state: { not: "mastered" } },
    }),
    prisma.dailySession.findUnique({
      where: { userId_date: { userId, date: todayMidnight } },
    }),
  ]);

  const dailyNewGoal = user?.dailyNewGoal ?? 10;
  const newDoneToday = todaySession?.newDone ?? 0;
  const reviewDoneToday = todaySession?.reviewDone ?? 0;
  const mode = user?.mode ?? "endless";
  const remainingNew =
    mode === "endless" ? Infinity : Math.max(0, dailyNewGoal - newDoneToday);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  const needsSeeding = totalWords === 0;
  const canStudy = !needsSeeding && (dueCount > 0 || mode === "endless" || remainingNew > 0);

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
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
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
                      {dueCount > 0 ? "待复习 + 新词随学随有" : "张新词随时可学"}
                    </span>
                  </>
                ) : (
                  <>
                    {dueCount + (Number.isFinite(remainingNew) ? remainingNew : 0)}{" "}
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
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="今日已学"
            value={String(newDoneToday + reviewDoneToday)}
          />
          <Stat
            label="CEFR 水平"
            value={user?.cefrLevel ?? "—"}
            hint={
              user?.estVocabSize
                ? `约 ${user.estVocabSize.toLocaleString()} 词`
                : undefined
            }
          />
          <Stat label="词库总量" value={totalWords.toLocaleString()} />
        </section>
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
