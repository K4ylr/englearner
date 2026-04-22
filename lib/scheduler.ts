import { prisma } from "@/lib/db";

// Interleave pattern: every 3 review cards, insert 1 new card.
// Keeps sessions flowing without dumping all new words at the end.
const REVIEWS_PER_NEW = 3;

// In endless mode we hand out this many new words at once so the user can
// keep going; they fetch a fresh batch when they finish.
const ENDLESS_BATCH = 30;

export type QueueItem = {
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
  if (!level) return ["A2", "B1", "B2"];
  const i = order.indexOf(level);
  if (i < 0) return ["A2", "B1", "B2"];
  return [order[i - 1], order[i], order[i + 1]].filter(Boolean) as string[];
}

async function pickNewWithFallback(
  seen: number[],
  cefrBucket: string[],
  topics: string[],
  budget: number
) {
  // Pass 1: topic ∩ CEFR match.
  const primary = await prisma.word.findMany({
    where: {
      id: { notIn: seen },
      cefr: { in: cefrBucket },
      topics: { hasSome: topics },
    },
    orderBy: { freqRank: "asc" },
    take: budget,
    include: { examples: { take: 2 } },
  });
  if (primary.length >= budget) return primary;

  // Pass 2: CEFR-only fallback for very narrow interests.
  const picked = new Set(primary.map((w) => w.id));
  const fallback = await prisma.word.findMany({
    where: {
      id: { notIn: [...seen, ...primary.map((w) => w.id)] },
      cefr: { in: cefrBucket },
    },
    orderBy: { freqRank: "asc" },
    take: budget - primary.length,
    include: { examples: { take: 2 } },
  });
  // Dedup just in case.
  return [...primary, ...fallback.filter((w) => !picked.has(w.id))];
}

export async function getTodayQueue(userId: string): Promise<QueueItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cefrLevel: true,
      dailyNewGoal: true,
      dailyReviewCap: true,
      mode: true,
      interests: true,
    },
  });
  if (!user) return [];

  const now = new Date();

  // 1. Due reviews — always capped.
  const dueReviews = await prisma.userWord.findMany({
    where: {
      userId,
      due: { lte: now },
      state: { not: "mastered" },
    },
    orderBy: { due: "asc" },
    take: user.dailyReviewCap,
    include: { word: { include: { examples: { take: 2 } } } },
  });

  // 2. New-word budget depends on mode.
  let newBudget: number;
  if (user.mode === "endless") {
    newBudget = Math.max(user.dailyNewGoal, ENDLESS_BATCH);
  } else {
    const todayMidnight = new Date(now);
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const alreadyNewToday = await prisma.reviewLog.count({
      where: {
        userId,
        reviewedAt: { gte: todayMidnight },
        state: "new",
      },
    });
    newBudget = Math.max(0, user.dailyNewGoal - alreadyNewToday);
  }

  // 3. Candidate pool: not-yet-seen, CEFR within ±1, and prefer topic matches.
  const seenRows = await prisma.userWord.findMany({
    where: { userId },
    select: { wordId: true },
  });
  const seen = seenRows.map((x) => x.wordId);

  const cefrBucket = cefrNeighbors(user.cefrLevel);
  const topics = user.interests.length > 0 ? user.interests : null;

  const newWords =
    newBudget === 0
      ? []
      : topics
      ? await pickNewWithFallback(seen, cefrBucket, topics, newBudget)
      : await prisma.word.findMany({
          where: { id: { notIn: seen }, cefr: { in: cefrBucket } },
          orderBy: { freqRank: "asc" },
          take: newBudget,
          include: { examples: { take: 2 } },
        });

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
