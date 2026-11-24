import type { UserStats } from '../types/game';

/**
 * Scoring models differ per game because the cognitive goal differs:
 * - Recall games: accuracy dominates, with a small speed bonus for quick-but-correct retrieval.
 * - Matching games: move efficiency dominates, time is a minor factor.
 * - Attention games: accuracy dominates, reaction latency penalizes only extreme dithering.
 * - Reaction games: speed is the objective but false starts are penalized.
 *
 * Points are intentionally modest and never so speed-weighted that guessing pays off.
 */

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Typical human simple reaction time ~300ms; used as anchor for speed factors. */
const RT_ANCHOR_MS = 300;

/**
 * Working-memory recall score (Digit Span, Spatial Matrix, Object Grid).
 * accuracy ∈ [0,100], difficulty is level reached, avgResponseMs internal timing.
 */
export function recallScore(params: {
  accuracy: number;
  difficulty: number;
  avgResponseMs: number | null;
}): number {
  const { accuracy, difficulty, avgResponseMs } = params;
  const difficultyMultiplier = 1 + difficulty * 0.35;
  // Speed bonus capped at +10% and only awarded above 70% accuracy,
  // so rushing/guessing never pays.
  let speedBonus = 1;
  if (avgResponseMs != null && accuracy >= 70) {
    const factor = clamp01(1 - Math.max(0, avgResponseMs - RT_ANCHOR_MS) / 4000);
    speedBonus = 1 + factor * 0.1;
  }
  const base = accuracy * 2 * difficultyMultiplier;
  return Math.round(base * speedBonus);
}

/**
 * Efficiency score for Card Pairs: fewest moves is perfect play; time adds a small bonus.
 */
export function matchingScore(params: {
  pairs: number;
  moves: number;
  elapsedSec: number;
}): number {
  const { pairs, moves, elapsedSec } = params;
  const perfectMoves = pairs; // minimum possible
  const efficiency = clamp01(perfectMoves / Math.max(moves, 1));
  const timeBonus = clamp01(1 - elapsedSec / (pairs * 25)); // generous ceiling
  return Math.round(pairs * 60 * efficiency + pairs * 15 * timeBonus);
}

/**
 * Attention (Stroop): accuracy dominates; reaction speed contributes only a tiny bonus
 * and slow-correct answers are never penalized, only rewarded marginally less.
 */
export function attentionScore(params: {
  correct: number;
  total: number;
  avgReactionMs: number | null;
}): number {
  const { correct, total, avgReactionMs } = params;
  if (total === 0) return 0;
  const accuracy = correct / total;
  const speedFactor =
    avgReactionMs != null ? 1 + clamp01(1 - avgReactionMs / 2500) * 0.15 : 1;
  return Math.round(accuracy * 100 * (1 + correct * 0.02) * speedFactor);
}

/**
 * Reaction game (Rapid Flash): speed is the goal but hit accuracy gates the reward,
 * and misses subtract so click-spamming cannot win.
 */
export function reactionScore(params: {
  hits: number;
  misses: number;
  avgReactionMs: number;
}): number {
  const { hits, misses, avgReactionMs } = params;
  if (hits === 0) return 0;
  const accuracy = clamp01(hits / (hits + misses));
  const speedFactor = clamp01(1 - (avgReactionMs - 200) / 1300); // 200ms ≈ ceiling of human fast
  return Math.round(hits * 10 * (0.5 + 0.5 * speedFactor) * (0.4 + 0.6 * accuracy));
}

// ---------------------------------------------------------------------------
// Feedback messages (Phase 6.3) — derived from actual data, never random.
// ---------------------------------------------------------------------------

export interface FeedbackInput {
  accuracy: number; // 0-100
  isNewBest: boolean;
  improvementVsLast: number | null; // points delta vs previous attempt
  detail?: { label: string; value: string }[]; // game-specific stats
}

export function generateFeedback(input: FeedbackInput): { praise: string; improvement: string } {
  const { accuracy, isNewBest, improvementVsLast } = input;

  if (isNewBest) {
    return {
      praise: 'New personal best! Your consistency is paying off. See if you can build on this performance.',
      improvement: accuracy < 95
        ? 'Steadying your slower moments would push this even higher.'
        : 'Try raising the difficulty when this feels comfortable.',
    };
  }

  if (improvementVsLast != null && improvementVsLast > 0) {
    return {
      praise: "You're making progress! Your score improved compared with your previous attempt.",
      improvement: 'Keep the same focus and another small step up is very reachable.',
    };
  }

  if (accuracy >= 90) {
    return {
      praise: 'Excellent focus! You handled almost everything accurately. Keep challenging yourself with the next level.',
      improvement: 'A slightly faster pace at this accuracy would earn a personal best.',
    };
  }

  if (accuracy >= 70) {
    return {
      praise: 'Solid work — your recall held up well through most of the round.',
      improvement: 'The last few items are usually where slips hide; slow down just a little on the ending.',
    };
  }

  if (accuracy >= 40) {
    return {
      praise: 'Good effort! You handled the early challenges well. With a little more practice, longer sequences will become easier.',
      improvement: 'Try grouping items into small chunks — it lightens the load on working memory.',
    };
  }

  return {
    praise: 'Thanks for playing this round! Every attempt tunes your brain for the next one.',
    improvement: 'Shorter, calmer sessions tend to work better than pushing through when tired.',
  };
}

/** Was this run a personal best? */
export function checkNewBest(stats: UserStats | undefined, score: number): boolean {
  if (!stats) return score > 0;
  return score > stats.highScore;
}

export function improvementVsLast(stats: UserStats | undefined, score: number): number | null {
  if (!stats || stats.lastScore == null) return null;
  return score - stats.lastScore;
}
