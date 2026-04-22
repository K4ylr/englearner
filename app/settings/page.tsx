import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/settings-form";

export const metadata = { title: "设置 · EngLearner" };
export const dynamic = "force-dynamic";

async function saveSettings(formData: FormData): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  const raw = formData.getAll("topic").map(String);
  const allowed = ["daily", "news", "business", "academic", "travel", "tech"];
  const interests = raw.filter((t) => allowed.includes(t));

  const mode = formData.get("mode") === "normal" ? "normal" : "endless";
  const dailyNewGoal = clamp(Number(formData.get("dailyNewGoal")) || 10, 5, 50);
  const dailyReviewCap = clamp(
    Number(formData.get("dailyReviewCap")) || 50,
    20,
    200
  );

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mode,
      dailyNewGoal,
      dailyReviewCap,
      interests,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      cefrLevel: true,
      estVocabSize: true,
      dailyNewGoal: true,
      dailyReviewCap: true,
      mode: true,
      interests: true,
      onboardedAt: true,
    },
  });

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">设置</h1>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1">
              随时调整，马上生效
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← 返回
          </Link>
        </header>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm flex items-center justify-between">
          <div>
            <div className="text-[var(--color-fg-muted)] text-xs">
              当前水平
            </div>
            <div className="font-medium mt-0.5">
              {user?.cefrLevel ?? "未测评"}
              {user?.estVocabSize ? (
                <span className="ml-2 text-[var(--color-fg-muted)] font-normal">
                  约 {user.estVocabSize.toLocaleString()} 词
                </span>
              ) : null}
            </div>
          </div>
          <Link
            href="/onboarding/placement"
            className="h-8 inline-flex items-center px-3 rounded-md border border-[var(--color-border)] text-xs hover:bg-[var(--color-border)] transition"
          >
            重新测评
          </Link>
        </section>

        <SettingsForm
          action={saveSettings}
          defaults={{
            mode: (user?.mode as "normal" | "endless") ?? "endless",
            dailyNewGoal: user?.dailyNewGoal ?? 10,
            dailyReviewCap: user?.dailyReviewCap ?? 50,
            topics: user?.interests ?? [],
          }}
        />
      </div>
    </main>
  );
}
