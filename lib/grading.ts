// Spelling grading for recall modes (spell / dictate). Maps a user's typed
// guess to an FSRS rating so the scheduler gets signal without the user
// having to click a rating button.
//
// Policy:
//   exact match            → Good (3)
//   close typo (lev ≤ 2)   → Hard (2) — encourages re-exposure but doesn't
//                            nuke the stability
//   wrong / empty / skipped → Again (1)
//
// The caller may still let the user override on reveal via 1-4 keys.

export type Rating = 1 | 2 | 3 | 4;

// Iterative Levenshtein — small strings, no DP table bloat.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost // substitute
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export type GradingResult = {
  rating: Rating;
  distance: number;
  exact: boolean;
};

export function gradeAnswer(
  guess: string | null | undefined,
  correct: string
): GradingResult {
  const g = normalize(guess ?? "");
  const c = normalize(correct);
  if (g.length === 0) return { rating: 1, distance: c.length, exact: false };
  if (g === c) return { rating: 3, distance: 0, exact: true };

  const d = levenshtein(g, c);
  // Tolerate 1 typo on any word, 2 typos only on longer words where a double
  // keystroke slip is more forgivable.
  const tolerance = c.length >= 6 ? 2 : 1;
  if (d <= tolerance) return { rating: 2, distance: d, exact: false };
  return { rating: 1, distance: d, exact: false };
}
