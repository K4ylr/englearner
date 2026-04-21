import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";

// Modern FSRS v5/v6 scheduler. Default params are well-tuned; per-user
// optimization can come later via ReviewLog data.
const scheduler = fsrs();

export type FsrsRating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy

export type UserWordFsrs = {
  state: string;
  stability: number;
  difficulty: number;
  elapsed: number;
  scheduled: number;
  reps: number;
  lapses: number;
  due: Date;
  lastReview: Date | null;
};

const STATE_TO_ENUM: Record<string, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
  mastered: State.Review, // mastered => treat as review for algorithm purposes
};

const ENUM_TO_STATE: Record<number, string> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

function toCard(uw: UserWordFsrs): Card {
  const base = createEmptyCard();
  return {
    ...base,
    due: uw.due,
    stability: uw.stability,
    difficulty: uw.difficulty,
    elapsed_days: uw.elapsed,
    scheduled_days: uw.scheduled,
    reps: uw.reps,
    lapses: uw.lapses,
    state: STATE_TO_ENUM[uw.state] ?? State.New,
    last_review: uw.lastReview ?? undefined,
  };
}

export function scheduleNext(
  uw: UserWordFsrs,
  rating: FsrsRating,
  now: Date = new Date()
) {
  const card = toCard(uw);
  const grade: Grade = rating as Grade;
  const result = scheduler.next(card, now, grade);
  const next = result.card;

  // Promote to "mastered" when stability is comfortably large (≥ ~180 days).
  const isMastered = next.stability >= 180 && next.state === State.Review;

  return {
    state: isMastered ? "mastered" : ENUM_TO_STATE[next.state] ?? "new",
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed: next.elapsed_days,
    scheduled: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    due: next.due,
    lastReview: now,
  };
}

export { Rating };
