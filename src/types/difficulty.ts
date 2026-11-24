// ─────────────────────────────────────────────────────────────────────────────
//  Cognitive Pulse — Adaptive Difficulty System
//  Reference: Item Response Theory + Dynamic Difficulty Adjustment literature
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export type Tier = 'novice' | 'explorer' | 'master' | 'grandmaster' | 'legend';
export type GameCategory = 'working-memory' | 'attention' | 'spatial' | 'reaction' | 'recall';

/** A single game session record fed into the mastery calculator */
export interface SessionDataPoint {
  gameId: string;
  accuracy: number;          // 0–100
  avgReactionMs?: number;    // null = not tracked by this game
  timeToCompleteSec?: number;
  difficultyLevel: number;
  score: number;
  sessionDate: string;       // ISO date
}

/** Per-game running skill state (persisted) */
export interface GameSkillScore {
  gameId: string;
  /** Exponential moving average of accuracy (α = 0.15 → recency-weighted) */
  emaAccuracy: number;
  /** Recent average reaction / completion time (seconds or ms, depends on game type) */
  emaTime: number;
  /** Consistency ratio — std dev inverse; high = very consistent, low = erratic */
  consistency: number;
  /** Composite mastery score 0–100 */
  masteryScore: number;
  /** Current difficulty tier */
  currentTier: Tier;
  /** How many consecutive qualifying sessions before upgrade/degrade */
  streakCount: number;
  /** Highest difficulty level ever reached */
  peakDifficulty: number;
  lastUpdated: string;
  sessionHistory: Array<{ accuracy: number; time?: number }>;
}

/** Global aggregate skill score across ALL games */
export interface GlobalSkillScore {
  totalPlayCount: number;
  averageMasteryAcrossGames: number;
  highestTier: Tier;
  updated: string;
}

/** Configuration that governs how a game behaves at a given level */
export interface GameDifficultyConfig {
  gameId: string;
  /** Predicted level label shown to user before they start */
  tier: Tier;
  /** Numeric tier index 0–4 */
  tierIndex: number;
  /** Whether pattern-breaking variants are enabled this session */
  patternBreakerEnabled: boolean;
  /** Parameters adjusted for this tier */
  params: Record<string, unknown>;
  /** Description the user sees */
  previewMessage: string;
}

/** Admin-overridable thresholds stored per-game and globally */
export interface DifficultyThresholds {
  /** Accuracy ceiling above which the next session is considered "too easy" */
  masteryUpgradeAccuracy: number;   // e.g. 85%
  /** Consecutive qualifying sessions needed before an automatic upgrade */
  masteryUpgradeStreak: number;     // e.g. 3
  /** Accuracy floor below which we degrade (prevents stuck-in-too-hard loops) */
  masteryDegradeAccuracy: number;   // e.g. 40%
  /** Degrade streak count */
  masteryDegradeStreak: number;     // e.g. 3
  /** Speed bonus weight (higher = time matters more) */
  speedWeight: number;              // 0–1
  /** Minimum sessions before any tier change is allowed */
  minSessionsBeforeChange: number;  // prevents rapid flips
}

/** Default thresholds (can be overridden from admin panel) */
export const DEFAULT_THRESHOLDS: DifficultyThresholds = {
  masteryUpgradeAccuracy: 82,
  masteryUpgradeStreak: 3,
  masteryDegradeAccuracy: 38,
  masteryDegradeStreak: 3,
  speedWeight: 0.2,
  minSessionsBeforeChange: 2,
};

/** All tiers in ascending order */
export const TIERS: Tier[] = ['novice', 'explorer', 'master', 'grandmaster', 'legend'];
export const TIER_NAMES: Record<Tier, string> = {
  novice: 'Novice',
  explorer: 'Explorer',
  master: 'Master',
  grandmaster: 'Grandmaster',
  legend: 'Legend',
};

/** Colors / emoji per tier for UI display */
export const TIER_STYLES: Record<Tier, { color: string; bg: string; emoji: string }> = {
  novice:      { color: 'text-slate-500 dark:text-slate-400',  bg: 'bg-slate-100 dark:bg-slate-800',  emoji: '🌱' },
  explorer:    { color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-100 dark:bg-blue-900/30', emoji: '⚡' },
  master:      { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', emoji: '🧠' },
  grandmaster: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', emoji: '💎' },
  legend:      { color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30',  emoji: '🔥' },
};
