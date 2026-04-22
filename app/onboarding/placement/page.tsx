import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { buildPlacementSet } from "@/lib/placement";
import { PlacementTest } from "@/components/placement-test";

export const metadata = { title: "水平测评 · EngLearner" };
export const dynamic = "force-dynamic";

export default async function PlacementPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cards = await buildPlacementSet(session.user.id);

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 text-center space-y-2">
          <h1 className="text-2xl font-semibold">先测个水平</h1>
          <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
            我会让你看 {cards.length} 个词，如实标记认识或不认识。
            <br />
            结果只决定推荐难度，不打分、不公开。
          </p>
        </header>
        <PlacementTest cards={cards} />
      </div>
    </main>
  );
}
