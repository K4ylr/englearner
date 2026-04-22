import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scheduleNext, type FsrsRating } from "@/lib/fsrs";

const BodySchema = z.object({
  wordId: z.number().int().positive(),
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
  durationMs: z.number().int().nonnegative().optional(),
  mode: z.enum(["recognize", "spell", "dictate"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { wordId, rating, durationMs, mode } = parsed.data;

  // Load existing UserWord or start a blank one.
  const existing = await prisma.userWord.findUnique({
    where: { userId_wordId: { userId, wordId } },
  });

  const priorState = existing?.state ?? "new";
  const now = new Date();

  const next = scheduleNext(
    {
      state: priorState,
      stability: existing?.stability ?? 0,
      difficulty: existing?.difficulty ?? 0,
      elapsed: existing?.elapsed ?? 0,
      scheduled: existing?.scheduled ?? 0,
      reps: existing?.reps ?? 0,
      lapses: existing?.lapses ?? 0,
      due: existing?.due ?? now,
      lastReview: existing?.lastReview ?? null,
    },
    rating as FsrsRating,
    now
  );

  await prisma.$transaction([
    prisma.userWord.upsert({
      where: { userId_wordId: { userId, wordId } },
      create: { userId, wordId, ...next },
      update: { ...next },
    }),
    prisma.reviewLog.create({
      data: {
        userId,
        wordId,
        rating,
        state: priorState, // snapshot of the state BEFORE this review
        stability: next.stability,
        difficulty: next.difficulty,
        elapsed: next.elapsed,
        scheduled: next.scheduled,
        mode: mode ?? "recognize",
        reviewedAt: now,
        durationMs: durationMs ?? null,
      },
    }),
    // Update daily session counters.
    prisma.dailySession.upsert({
      where: {
        userId_date: {
          userId,
          date: dateOnly(now),
        },
      },
      create: {
        userId,
        date: dateOnly(now),
        newDone: priorState === "new" ? 1 : 0,
        reviewDone: priorState === "new" ? 0 : 1,
        correct: rating >= 3 ? 1 : 0,
        total: 1,
      },
      update: {
        newDone: { increment: priorState === "new" ? 1 : 0 },
        reviewDone: { increment: priorState === "new" ? 0 : 1 },
        correct: { increment: rating >= 3 ? 1 : 0 },
        total: { increment: 1 },
      },
    }),
  ]);

  return NextResponse.json({
    due: next.due,
    state: next.state,
    stability: next.stability,
  });
}

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
