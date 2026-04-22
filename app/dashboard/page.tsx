import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "仪表盘 · EngLearner" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const [dueCount, newBudget, user, todaySession, totalWords] = await Promise.all(
    [
      prisma.userWord.count({
        where: { userId, due: { lte: now }, state: { not: "mastered" } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { dailyNewGoal: true, cefrLevel: true, onboardedAt: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { cefrLevel: true, onboardedAt: true },
      }),
      prisma.dailySession.findUnique({
        where: { userId_date: { userId, date: todayMidnight } },
      }),
      prisma.word.count(),
    ]
  );

  const dailyNewGoal = newBudget?.dailyNewGoal ?? 10;
  const newDoneToday = todaySession?.newDone ?? 0;
  const reviewDoneToday = todaySession?.reviewDone ?? 0;
  const remainingNew = Math.max(0, dailyNewGoal - newDoneToday);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  const needsSeeding = totalWords === 0;

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[var(--color-fg-muted)]">已登录</div>
            <div className="font-medium">{session.user.email}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm hover:bg-[var(--color-surface)] transition"
            >
              退出
            </button>
          </form>
        </header>

        {needsSeeding ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-2">
            <div className="font-medium">⚠️ 词库还没导入</div>
            <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
              管理员请调用 <code>POST /api/admin/seed</code> 带 header{" "}
              <code>x-admin-secret</code> 完成首次词库导入（见 README）。
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
            <div>
              <div className="text-sm text-[var(--color-fg-muted)]">
                今日任务
              </div>
              <div className="mt-1 text-3xl font-semibold">
                {dueCount + remainingNew}{" "}
                <span className="text-base font-normal text-[var(--color-fg-muted)]">
                  张卡片
                </span>
              </div>
              <div className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {remainingNew} 新词 · {dueCount} 待复习
              </div>
            </div>
            <Link
              href="/study"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-brand)] px-6 text-sm font-medium text-white hover:bg-[var(--color-brand-hover)] transition"
            >
              开始学习 →
            </Link>
          </section>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="今日已学" value={String(newDoneToday + reviewDoneToday)} />
          <Stat
            label="CEFR 水平"
            value={user?.cefrLevel ?? "—"}
            hint={user?.onboardedAt ? undefined : "做一次测评"}
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
