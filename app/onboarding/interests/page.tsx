import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InterestsForm } from "@/components/interests-form";

export const metadata = { title: "兴趣方向 · EngLearner" };
export const dynamic = "force-dynamic";

async function saveInterests(formData: FormData): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  const raw = formData.getAll("topic").map(String);
  const allowed = ["daily", "news", "business", "academic", "travel", "tech"];
  const topics = raw.filter((t) => allowed.includes(t));

  const dailyNewGoal = clamp(Number(formData.get("dailyNewGoal")) || 10, 5, 50);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      interests: topics,
      dailyNewGoal,
      onboardedAt: new Date(),
    },
  });

  redirect("/dashboard");
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default async function InterestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cefrLevel: true, dailyNewGoal: true, interests: true },
  });

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-xs text-[var(--color-fg-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-3 py-1">
            <span>你的水平：{user?.cefrLevel ?? "未知"}</span>
          </div>
          <h1 className="text-2xl font-semibold">你对什么内容感兴趣？</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            我会优先从这些方向推荐单词。至少选一个，越多推荐越丰富。
          </p>
        </header>
        <InterestsForm
          action={saveInterests}
          defaults={{
            topics: user?.interests ?? [],
            dailyNewGoal: user?.dailyNewGoal ?? 10,
          }}
        />
      </div>
    </main>
  );
}
