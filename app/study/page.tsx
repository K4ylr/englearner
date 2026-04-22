import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getTodayQueue } from "@/lib/scheduler";
import { Flashcard } from "@/components/flashcard";

export const metadata = { title: "学习 · EngLearner" };
export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const queue = await getTodayQueue(session.user.id);

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between text-sm">
          <Link
            href="/dashboard"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← 返回
          </Link>
        </div>
        <Flashcard initialQueue={queue} />
      </div>
    </main>
  );
}
