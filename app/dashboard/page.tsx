import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export const metadata = { title: "仪表盘 · EngLearner" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="min-h-screen px-6 py-10">
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

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center space-y-3">
          <div className="text-4xl">🌱</div>
          <h1 className="text-2xl font-semibold">欢迎！</h1>
          <p className="text-[var(--color-fg-muted)] leading-relaxed max-w-md mx-auto">
            词库、水平测评与闪卡学习界面将在 Phase B 上线。
            当前 Phase A 已完成：账户系统与数据库骨架可用。
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat label="今日新词" value="—" hint="Phase B" />
          <Stat label="待复习" value="—" hint="Phase B" />
          <Stat label="连续天数" value="—" hint="Phase D" />
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
