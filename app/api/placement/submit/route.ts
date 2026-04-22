import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estimateLevel, type PlacementLevel } from "@/lib/placement";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

const BodySchema = z.object({
  answers: z
    .array(
      z.object({
        wordId: z.number().int().positive(),
        cefr: z.enum(LEVELS),
        known: z.boolean(),
      })
    )
    .min(1),
});

const BAND_TO_FREQ_BAND: Record<PlacementLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const { answers } = parsed.data;

  const { cefrLevel, estVocabSize } = estimateLevel(answers);

  // Persist raw answers (for future re-calibration) and update user profile.
  // Pre-mark words the user said they knew as "mastered" so the recommender
  // never serves them as new.
  const now = new Date();
  const knownIds = answers.filter((a) => a.known).map((a) => a.wordId);

  await prisma.$transaction([
    prisma.placementAnswer.createMany({
      data: answers.map((a) => ({
        userId,
        wordId: a.wordId,
        known: a.known,
        freqBand: BAND_TO_FREQ_BAND[a.cefr],
        createdAt: now,
      })),
    }),
    prisma.user.update({
      where: { id: userId },
      data: { cefrLevel, estVocabSize },
    }),
    ...(knownIds.length > 0
      ? [
          prisma.userWord.createMany({
            data: knownIds.map((wordId) => ({
              userId,
              wordId,
              state: "mastered",
              // Give a large stability so FSRS treats these as done; they
              // won't come back for review for ~6 months.
              stability: 180,
              difficulty: 4,
              due: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ cefrLevel, estVocabSize });
}
