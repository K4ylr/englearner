import { prisma } from "@/lib/db";

// CEFR bands we test. A1 is easiest, C1 hardest. We skip C2 since our corpus
// doesn't cover it (see Phase C plan: A1-C1 only).
const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type PlacementLevel = (typeof LEVELS)[number];

// Approximate cumulative vocabulary size at each CEFR tier. These are the
// widely-cited estimates used by Oxford/Cambridge (A1≈500, A2≈1k, B1≈2k,
// B2≈4k, C1≈8k, C2≈16k). We use the "new words added at this level" delta
// for weighted-sum vocab estimation.
const BAND_SIZE: Record<PlacementLevel, number> = {
  A1: 500,
  A2: 1000,
  B1: 2000,
  B2: 4000,
  C1: 8000,
};

// How many sample words per band on the test. 10 gives a stable estimate
// without dragging the test past ~2 minutes.
export const SAMPLES_PER_BAND = 10;
export const TOTAL_TEST_WORDS = SAMPLES_PER_BAND * LEVELS.length;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type PlacementCard = {
  wordId: number;
  lemma: string;
  ipaUs: string | null;
  ipaUk: string | null;
  cefr: PlacementLevel;
};

// Build a fresh randomised test set for a user. Samples words the user
// hasn't already been asked about (we never ask the same lemma twice across
// sessions) so re-takes probe different words.
export async function buildPlacementSet(userId: string): Promise<PlacementCard[]> {
  const answered = await prisma.placementAnswer.findMany({
    where: { userId },
    select: { wordId: true },
  });
  const asked = new Set(answered.map((a) => a.wordId));

  const cards: PlacementCard[] = [];
  for (const level of LEVELS) {
    // Pull a larger pool and random-sample client-side for speed; Postgres
    // ORDER BY random() is fine but this is explicit and deterministic per
    // call once shuffled.
    const pool = await prisma.word.findMany({
      where: {
        cefr: level,
        id: { notIn: Array.from(asked) },
        ipaUs: { not: null },
      },
      select: { id: true, lemma: true, ipaUs: true, ipaUk: true, cefr: true },
      orderBy: { freqRank: "asc" },
      take: SAMPLES_PER_BAND * 10, // overfetch for shuffle variety
    });
    const shuffled = shuffle(pool).slice(0, SAMPLES_PER_BAND);
    for (const w of shuffled) {
      cards.push({
        wordId: w.id,
        lemma: w.lemma,
        ipaUs: w.ipaUs,
        ipaUk: w.ipaUk,
        cefr: w.cefr as PlacementLevel,
      });
    }
  }
  return shuffle(cards);
}

// Given answers, estimate the user's CEFR level and known-word count.
export function estimateLevel(
  answers: { cefr: PlacementLevel; known: boolean }[]
): { cefrLevel: PlacementLevel; estVocabSize: number; byLevel: Record<PlacementLevel, { known: number; total: number }> } {
  const byLevel = {} as Record<PlacementLevel, { known: number; total: number }>;
  for (const l of LEVELS) byLevel[l] = { known: 0, total: 0 };
  for (const a of answers) {
    byLevel[a.cefr].total += 1;
    if (a.known) byLevel[a.cefr].known += 1;
  }

  // Vocab size: weighted sum of known ratio × band size.
  let estVocabSize = 0;
  for (const l of LEVELS) {
    const { known, total } = byLevel[l];
    if (total > 0) estVocabSize += (known / total) * BAND_SIZE[l];
  }
  estVocabSize = Math.round(estVocabSize);

  // CEFR = the highest band where ≥50% known, clipped to [A1, C1]. If user
  // knows zero at every level, call it A1 (will re-test on retake).
  let cefrLevel: PlacementLevel = "A1";
  for (const l of LEVELS) {
    const { known, total } = byLevel[l];
    if (total > 0 && known / total >= 0.5) cefrLevel = l;
  }

  return { cefrLevel, estVocabSize, byLevel };
}
