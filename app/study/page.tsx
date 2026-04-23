import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayQueue } from "@/lib/scheduler";
import { Flashcard } from "@/components/flashcard";
import { RecallCard } from "@/components/recall-card";
import { StudyModeSelector } from "@/components/study-mode-selector";
import { StoredModeRedirect } from "@/components/stored-mode-redirect";

export const metadata = { title: "学习 · EngLearner" };
export const dynamic = "force-dynamic";

type Mode = "recognize" | "spell" | "dictate";

function coerceMode(v: string | undefined): Mode | null {
  if (v === "spell" || v === "dictate" || v === "recognize") return v;
  return null;
}

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const requestedMode = coerceMode(sp.mode);

  // If no mode in URL, client component will check localStorage and push
  // the remembered mode into the URL. Default render uses "recognize".
  const mode: Mode = requestedMode ?? "recognize";
  const [queue, user] = await Promise.all([
    getTodayQueue(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { revealHoldMs: true, swipeRightIsKnow: true },
    }),
  ]);
  const revealHoldMs = user?.revealHoldMs ?? 1500;
  const swipeRightIsKnow = user?.swipeRightIsKnow ?? true;

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-6">
      <div className="max-w-5xl mx-auto">
        {requestedMode === null && <StoredModeRedirect />}
        <div className="mb-6 flex items-center justify-between gap-3 text-sm">
          <Link
            href="/dashboard"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← 返回
          </Link>
          <StudyModeSelector current={mode} />
        </div>
        {mode === "recognize" ? (
          <Flashcard
            initialQueue={queue}
            revealHoldMs={revealHoldMs}
            swipeRightIsKnow={swipeRightIsKnow}
          />
        ) : (
          <RecallCard mode={mode} initialQueue={queue} />
        )}
      </div>
    </main>
  );
}
