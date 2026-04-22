import { prisma } from "@/lib/db";

// Interleave pattern: every 3 review cards, insert 1 new card.
// This keeps the session flowing without dumping all new words at the end
// (which is what fatigues users).
const REVIEWS_PER_NEW = 3;

export type QueueItem = {
  userWordId?: never; // composite key; use {userId, wordId} instead
  wordId: number;
  kind: "new" | "review";
  lemma: string;
  pos: string | null;
  ipaUs: string | null;
  ipaUk: string | null;
  defEn: string | null;
  defZh: string | null;
  cefr: string | null;
  examples: { en: string; zh: string | null }[];
};

function cefrNeighbors(level: string | null): string[] {
  const order = ["A1", "A2", "B1", "B2", "C1", "C2"];
  if (!level) return ["A2", "B1", "B2"]; // reasonable default for unknown level
  const i = order.indexOf(level);
  if (i < 0) return ["A2", "B1", "B2"];
  // include the level itself plus one step up, and one step down as bridge
  return [order[i - 1], order[i], order[i + 1]].filter(Boolean) as string[];
}

export async function getTodayQueue(userId: string): Promise<QueueItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cefrLevel: true,
      dailyNewGoal: true,
      dailyReviewCap: true,
      interests: true,
    },
  });
  if (!user) return [];

  const now = new Date();

  // --- 1. Fetch due reviews (oldest due first) up to cap ---
  const dueReviews = await prisma.userWord.findMany({
    where: {
      userId,
      due: { lte: now },
      state: { not: "mastered" },
    },
    orderBy: { due: "asc" },
    take: user.dailyReviewCap,
    include: {
      word: { include: { examples: { take: 2 } } },
    },
  });

  // --- 2. Count how many new words already done today (respect daily cap) ---
  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const alreadyNewToday = await prisma.reviewLog.count({
    where: {
      userId,
      reviewedAt: { gte: todayMidnight },
      state: "new", // logged state snapshots at time of review → "new" means it was a new word
    },
  });
  const newBudget = Math.max(0, user.dailyNewGoal - alreadyNewToday);

  // --- 3. Pick new words matching CEFR (±1) and interests, excluding what user already has ---
  const seenWordIds = await prisma.userWord.findMany({
    where: { userId },
    select: { wordId: true },
  });
  const seen = new Set(seenWordIds.map((x) => x.wordId));

  const cefrBucket = cefrNeighbors(user.cefrLevel);
  const topics = user.interests.length > 0 ? user.interests : null;

  const newWordCandidates = await prisma.word.findMany({
    where: {
      id: { notIn: Array.from(seen) },
      cefr: { in: cefrBucket },
      ...(topics ? { topics: { hasSome: topics } } : {}),
    },
    orderBy: { freqRank: "asc" }, // prefer more common first
    take: newBudget * 3, // overfetch, then slice
    include: { examples: { take: 2 } },
  });

  // If not enough matches (e.g. user still untargeted topics), widen to CEFR only.
  let newWords = newWordCandidates.slice(0, newBudget);
  if (newWords.length < newBudget && topics) {
    const fallback = await prisma.word.findMany({
      where: {
        id: { notIn: [...Array.from(seen), ...newWords.map((w) => w.id)] },
        cefr: { in: cefrBucket },
      },
      orderBy: { freqRank: "asc" },
      take: newBudget - newWords.length,
      include: { examples: { take: 2 } },
    });
    newWords = [...newWords, ...fallback];
  }

  // --- 4. Interleave ---
  const reviewItems: QueueItem[] = dueReviews.map((uw) => ({
    wordId: uw.wordId,
    kind: "review",
    lemma: uw.word.lemma,
    pos: uw.word.pos,
    ipaUs: uw.word.ipaUs,
    ipaUk: uw.word.ipaUk,
    defEn: uw.word.defEn,
    defZh: uw.word.defZh,
    cefr: uw.word.cefr,
    examples: uw.word.examples.map((e) => ({ en: e.en, zh: e.zh })),
  }));
  const newItems: QueueItem[] = newWords.map((w) => ({
    wordId: w.id,
    kind: "new",
    lemma: w.lemma,
    pos: w.pos,
    ipaUs: w.ipaUs,
    ipaUk: w.ipaUk,
    defEn: w.defEn,
    defZh: w.defZh,
    cefr: w.cefr,
    examples: w.examples.map((e) => ({ en: e.en, zh: e.zh })),
  }));

  const queue: QueueItem[] = [];
  let r = 0;
  let n = 0;
  while (r < reviewItems.length || n < newItems.length) {
    for (let i = 0; i < REVIEWS_PER_NEW && r < reviewItems.length; i++) {
      queue.push(reviewItems[r++]);
    }
    if (n < newItems.length) queue.push(newItems[n++]);
  }
  return queue;
}
