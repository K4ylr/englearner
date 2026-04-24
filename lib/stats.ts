import { prisma } from "@/lib/db";

// Dashboard stats: streak, daily activity, mastery curve. All computed
// from DailySession (per-day rollup) and UserWord (current state) so one
// query each, no N+1 scans.

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;

export type DashboardStats = {
  streak: { current: number; longest: number };
  activity: { date: string; newDone: number; reviewDone: number }[];
  cumulative: { date: string; count: number }[];
  totals: {
    knownCount: number; // state in (review, mastered)
    masteredCount: number; // state = mastered
    learningCount: number; // state in (learning, relearning)
    totalEverSeen: number;
    thisWeekNew: number;
    todayNew: number;
    todayReview: number;
    todayCorrect: number;
    todayTotal: number;
  };
};

function dayStart(d: Date): number {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.getTime();
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const now = new Date();
  const today = dayStart(now);
  const windowStart = today - (WINDOW_DAYS - 1) * DAY_MS;

  // Pull everything we need in parallel.
  const [sessions, userWords] = await Promise.all([
    prisma.dailySession.findMany({
      where: { userId },
      select: {
        date: true,
        newDone: true,
        reviewDone: true,
        correct: true,
        total: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.userWord.findMany({
      where: { userId },
      select: { createdAt: true, state: true },
    }),
  ]);

  // ---- Streak ----
  // Consecutive days ending today (or yesterday — today hasn't started yet)
  // where DailySession.total > 0.
  const activeDays = new Set(
    sessions.filter((s) => s.total > 0).map((s) => dayStart(s.date))
  );
  let current = 0;
  let cursor = today;
  if (!activeDays.has(cursor)) cursor -= DAY_MS; // grace for not-started-today
  while (activeDays.has(cursor)) {
    current++;
    cursor -= DAY_MS;
  }

  const sortedActive = [...activeDays].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev = -Infinity;
  for (const t of sortedActive) {
    run = t - prev === DAY_MS ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = t;
  }

  // ---- Daily activity (past 30 days, including empty days) ----
  const byDate = new Map<number, { newDone: number; reviewDone: number }>();
  for (const s of sessions) {
    byDate.set(dayStart(s.date), {
      newDone: s.newDone,
      reviewDone: s.reviewDone,
    });
  }
  const activity: DashboardStats["activity"] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const t = windowStart + i * DAY_MS;
    const hit = byDate.get(t);
    activity.push({
      date: isoDate(t),
      newDone: hit?.newDone ?? 0,
      reviewDone: hit?.reviewDone ?? 0,
    });
  }

  // ---- Cumulative known words (past 30 days) ----
  // Starts from the baseline of words created before the window, then
  // accumulates as each word's createdAt falls within each day.
  const uwSorted = [...userWords].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  let idx = 0;
  let running = 0;
  // Baseline: everything created strictly before window start.
  while (idx < uwSorted.length && uwSorted[idx].createdAt.getTime() < windowStart) {
    running++;
    idx++;
  }
  const cumulative: DashboardStats["cumulative"] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const dayEnd = windowStart + (i + 1) * DAY_MS - 1;
    while (
      idx < uwSorted.length &&
      uwSorted[idx].createdAt.getTime() <= dayEnd
    ) {
      running++;
      idx++;
    }
    cumulative.push({ date: isoDate(windowStart + i * DAY_MS), count: running });
  }

  // ---- Totals ----
  let knownCount = 0;
  let masteredCount = 0;
  let learningCount = 0;
  const sevenDaysAgo = today - 7 * DAY_MS;
  let thisWeekNew = 0;
  for (const w of userWords) {
    if (w.state === "mastered") {
      masteredCount++;
      knownCount++;
    } else if (w.state === "review") {
      knownCount++;
    } else if (w.state === "learning" || w.state === "relearning") {
      learningCount++;
    }
    if (w.createdAt.getTime() >= sevenDaysAgo) thisWeekNew++;
  }

  const todaySession = sessions.find((s) => dayStart(s.date) === today);

  return {
    streak: { current, longest },
    activity,
    cumulative,
    totals: {
      knownCount,
      masteredCount,
      learningCount,
      totalEverSeen: userWords.length,
      thisWeekNew,
      todayNew: todaySession?.newDone ?? 0,
      todayReview: todaySession?.reviewDone ?? 0,
      todayCorrect: todaySession?.correct ?? 0,
      todayTotal: todaySession?.total ?? 0,
    },
  };
}
