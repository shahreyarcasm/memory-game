/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Adaptive Difficulty Engine
 *
 *  Based on:
 *  • Item Response Theory (IRT) — ability estimated from item performance
 *  • Dynamic Difficulty Adjustment (DDA) — real-time parameter scaling
 *  • Flow Theory (Csikszentmihalyi) — balance between skill and challenge
 *
 *  Mastery formula (per game):
 *    mastery = α·accuracy + β·speedFactor + γ·consistency
 *      where α=0.6, β=0.25, γ=0.15
 *
 *  Upgrade rule:
 *    If last N sessions have mastery > threshold → tier + 1
 *  Degrade rule:
 *    If last N sessions have mastery < degradeThreshold → tier - 1
 *  Minimum session buffer prevents rapid tier-flipping.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  GameSkillScore,
  GlobalSkillScore,
  GameDifficultyConfig,
  DifficultyThresholds,
  SessionDataPoint,
  Tier,
} from '../types/difficulty';
import { TIERS } from '../types/difficulty';
export { DEFAULT_THRESHOLDS } from '../types/difficulty';
import { DEFAULT_THRESHOLDS } from '../types/difficulty';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALPHA = 0.60;   // accuracy weight
const BETA  = 0.25;   // speed weight
const GAMMA = 0.15;   // consistency weight
const EMA_ALPHA = 0.18; // exponential moving average smoothing factor
const STREAK_WINDOW = 3; // recent sessions considered for streak

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function ema(current: number, next: number, alpha: number): number {
  return alpha * next + (1 - alpha) * current;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map(v => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// median is available for future use
// function median(values: number[]): number { ... }

// Convert raw time to a percentile score (faster = better = higher score)
// Uses anchor baselines per cognitive category
function speedPercentile(timeMs: number | undefined, category: string): number {
  if (timeMs == null || timeMs <= 0) return 0.5;
  const anchors: Record<string, number> = {
    'working-memory': 4000,   // digit span round ~3–5s
    attention:        700,    // sustained vigilance reaction ~300–900ms
    spatial:          3500,   // card pairs full game ~30–90s
    reaction:         400,    // rapid flash hit ~200–500ms
    recall:           3000,   // object location placement ~2–4s
    'vigilance':      700,    // alias for attention-category timing
  };
  const anchor = anchors[category] ?? 3000;
  // sigmoid-like mapping: fast answer ≈ 1.0, slow answer ≈ 0
  return 1 / (1 + Math.exp((timeMs - anchor * 0.6) / (anchor * 0.4)));
}

// Consistency = inverse of coefficient of variation of recent accuracies
function calcConsistency(history: Array<{ accuracy: number }>): number {
  if (history.length < 2) return 0.7; // neutral when insufficient data
  const accs = history.map(h => h.accuracy);
  const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
  if (mean === 0) return 0.5;
  const sd = stdDev(accs);
  // cv = std/mean; consistency = 1 - clamp(cv, 0, 1)
  const cv = sd / mean;
  return clamp(1 - cv, 0, 1);
}

function tierIndex(tier: Tier): number {
  return TIERS.indexOf(tier);
}

function indexToTier(idx: number): Tier {
  return TIERS[clamp(idx, 0, TIERS.length - 1)];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Process one completed session and return updated per-game skill state.
 * The caller should persist this result in Zustand store.
 */
export function processSession(
  existing: GameSkillScore | null,
  session: SessionDataPoint,
  thresholds: DifficultyThresholds = DEFAULT_THRESHOLDS,
): GameSkillScore {
  const now = new Date().toISOString();

  // Push into rolling history (keep last 20 entries)
  const recentHistory = [...(existing?.sessionHistory ?? []), {
    accuracy: session.accuracy,
    time: session.avgReactionMs ?? (session.timeToCompleteSec != null ? session.timeToCompleteSec * 1000 : undefined),
  }].slice(-20);

  // Compute EMA values
  const newAccuracyEma = ema(existing?.emaAccuracy ?? session.accuracy, session.accuracy, EMA_ALPHA);
  const avgTime = recentHistory
    .filter(h => h.time != null)
    .map(h => h.time!)
    .reduce((a, b) => a + b, 0) /
    Math.max(1, recentHistory.filter(h => h.time != null).length);
  const newTimeEma = existing?.emaTime != null
    ? ema(existing.emaTime, avgTime, EMA_ALPHA)
    : avgTime;
  const newConsistency = calcConsistency(recentHistory);

  // Speed factor: 0 (slowest) → 1 (fastest)
  const speedVal = session.avgReactionMs != null
    ? speedPercentile(session.avgReactionMs, session.gameId)
    : 0.5;

  // Master score composite
  const newMastery = ALPHA * newAccuracyEma
                   + BETA  * speedVal * 100
                   + GAMMA * newConsistency * 100;

  // Streak tracking for upgrade/degrade
  const recentSessions = recentHistory.slice(-STREAK_WINDOW);
  const qualifyingUpgrades = recentSessions.filter(s =>
    s.accuracy >= thresholds.masteryUpgradeAccuracy,
  ).length;
  const qualifyingDowngrades = recentSessions.filter(s =>
    s.accuracy <= thresholds.masteryDegradeAccuracy,
  ).length;

  let newTier = (existing?.currentTier ?? 'novice') as Tier;
  let newStreak = existing?.streakCount ?? 0;
  const totalPlays = (existing?.peakDifficulty ?? 0) > 0
    ? recentHistory.length
    : 0;

  if (totalPlays >= thresholds.minSessionsBeforeChange) {
    if (qualifyingUpgrades >= thresholds.masteryUpgradeStreak && newTier !== 'legend') {
      newTier = TIERS[tierIndex(newTier) + 1];
      newStreak = 0; // reset after promotion
    } else if (qualifyingDowngrades >= thresholds.masteryDegradeStreak && newTier !== 'novice') {
      newTier = TIERS[tierIndex(newTier) - 1];
      newStreak = 0; // reset after demotion
    } else {
      newStreak = clamp(newStreak + 1, 0, thresholds.masteryUpgradeStreak);
    }
  } else {
    newStreak = 0;
  }

  return {
    gameId: session.gameId,
    emaAccuracy: Math.round(newAccuracyEma),
    emaTime: Math.round(newTimeEma),
    consistency: Math.round(newConsistency * 100) / 100,
    masteryScore: Math.round(newMastery),
    currentTier: newTier,
    streakCount: newStreak,
    peakDifficulty: Math.max(existing?.peakDifficulty ?? 0, session.difficultyLevel),
    lastUpdated: now,
    sessionHistory: recentHistory,
  };
}

/**
 * Compute the difficulty config to inject BEFORE the game starts.
 * Caller passes current skill state; returns params and preview text.
 */
export function getDifficultyConfig(
  skill: GameSkillScore | null,
  _thresholds: DifficultyThresholds = DEFAULT_THRESHOLDS,
): GameDifficultyConfig {
  const tier = skill?.currentTier ?? 'novice';
  const idx  = tierIndex(tier);
  const isPatternEnabled = idx >= 1; // pattern breakers start at explorer+

  const previews: Record<Tier, string> = {
    novice:      '🌱 Starting simple. Build your foundation here — every expert was once a beginner!',
    explorer:    '⚡ A bit more challenging ahead! Your brain is ready for new patterns.',
    master:      '🧠 You\'ve proven yourself. Expect faster sequences and smart distractions.',
    grandmaster: '💎 Elite territory — we\'re pushing your limits with unpredictable twists.',
    legend:      '🔥 Maximum difficulty. No mercy. Only the sharpest minds survive.',
  };

  return {
    gameId: skill?.gameId ?? '',
    tier,
    tierIndex: idx,
    patternBreakerEnabled: isPatternEnabled,
    params: buildParamsForTier(tier),
    previewMessage: previews[tier],
  };
}

/**
 * Per-tier parameter overrides for each supported game.
 * When a new game is added, append its block here.
 */
function buildParamsForTier(tier: Tier): Record<string, unknown> {
  switch (tier) {
    case 'novice':      return { multiplier: 1.0, variantChance: 0.0   };
    case 'explorer':    return { multiplier: 1.1, variantChance: 0.15  };
    case 'master':      return { multiplier: 1.25, variantChance: 0.30 };
    case 'grandmaster': return { multiplier: 1.45, variantChance: 0.50 };
    case 'legend':      return { multiplier: 1.7,  variantChance: 0.70 };
    default: return {};
  }
}

/**
 * Map game-level parameters using the given skill state.
 * Returns the concrete config the game component should use at startup.
 */
export function resolveGameParameters(
  gameId: string,
  skill: GameSkillScore | null,
  thresholds: DifficultyThresholds = DEFAULT_THRESHOLDS,
): { tier: Tier; params: Record<string, unknown>; message: string } {
  const base = getDifficultyConfig(skill, thresholds);
  const mult = (base.params.multiplier as number) ?? 1;
  const chance = (base.params.variantChance as number) ?? 0;
  const idx = base.tierIndex;

  // Per-game parameter overrides
  const overrides: Record<string, Record<string, unknown>> = {
    // Digit Span
    'digit-span': {
      sequenceLength: 3 + idx,            // starts at 3 digits, adds 1 per tier
      backwardMode:   idx >= 2,           // unlocks at master
      dualTaskAt:     idx >= 4,           // legend gets both at once
    },
    // Spatial Matrix
    'spatial-matrix': {
      gridSize:       Math.min(3 + idx, 7),    // 3×3 up to 7×7
      highlightRatio: clamp(0.25 + idx * 0.07, 0.25, 0.65),
      showDuration:   Math.max(2000 - idx * 250, 600),  // ms
    },
    // Rapid Flash (deprecated — kept for old session records)
    'rapid-flash': {
      targetSize:    Math.max(60 - idx * 6, 28),
      spawnInterval: Math.max(1400 - idx * 200, 400),
      fadeChance:    clamp(chance + 0.05, 0, 0.7),
    },
    // Number Stream (pure reaction speed — tap only on target digit)
    'number-stream': {
      roundTime:     Math.max(4000, 8000 - idx * 600),   // ms to respond in
      targetDigit:   7,
    },
    // Flanker Attack (attention — selective filtering of decoy arrows)
    'flanker-attack': {
      numFlankers:   Math.min(5, 2 + idx),       // more deceptive flankers at higher tiers
      maxResponseMs: Math.max(1200, 2500 - idx * 200),
    },
    // Sequence Recall (working-memory — replay digit sequence in order)
    'sequence-recall': {
      baseLength: 3,
      maxLen:      9 + idx,
    },
    // Grid Shuffle (spatial — mental rotation of grid patterns)
    'grid-shuffle': {
      gridSizes: [3, 4, 5],
      fillRatio: clamp(0.25 + idx * 0.05, 0.25, 0.55),
    },
    // Flash Recall (recall — icon position memory after brief display)
    'flash-recall': {
      showDuration: Math.max(800, 1500 - idx * 100),
      nIconsBase:   3,
    },
    // Stroop
    'stroop': {
      colorCount: Math.min(5 + (idx >= 3 ? 1 : 0), 7), // extra colors at grandmaster+
      ruleSwitchAt: idx >= 2 ? 5 : Infinity,            // switch mid-game at master+
    },
    // Card Pairs
    'card-pairs': {
      pairCount: Math.min(6 + idx, 18),    // 6 pairs (4×6) up to 18 (6×6)
      hintCount: Math.max(3 - idx, 0),     // fewer hints at higher tiers
    },
    // Object Location
    'object-location': {
      gridSize:    Math.min(3 + idx, 7),
      itemCount:   Math.min(3 + idx * 2, 14),
      hideDelay:   Math.max(2500 - idx * 300, 500),
      moveObjects: idx >= 3,               // objects shift slightly at grandmaster+
    },
    // Sustained Vigilance — sequential single-stimulus loop
    'vigilance': {
      spawnRate:     Math.max(400, 700 - idx * 60),       // ms gap between appearances — faster per tier
      stimulusLife:  Math.max(1600, 4000 - idx * 240), // shorter visibility window
      targetRatio:   clamp(0.75 - idx * 0.025, 0.60, 0.75), // 25 % red at novice → 35 % at legend
    },
  };

  return {
    tier: base.tier,
    params: overrides[gameId] ?? { multiplier: mult, variantChance: chance },
    message: base.previewMessage,
  };
}

/**
 * Aggregate global skill across all tracked games.
 */
export function computeGlobalScore(gameSkills: GameSkillScore[]): GlobalSkillScore {
  if (gameSkills.length === 0) {
    return { totalPlayCount: 0, averageMasteryAcrossGames: 0, highestTier: 'novice', updated: new Date().toISOString() };
  }
  const totalPlays = gameSkills.reduce((sum, g) => sum + g.sessionHistory.length, 0);
  const avgMastery = gameSkills.reduce((sum, g) => sum + g.masteryScore, 0) / gameSkills.length;
  const highestIdx = Math.max(...gameSkills.map(g => tierIndex(g.currentTier)));
  return {
    totalPlayCount: totalPlays,
    averageMasteryAcrossGames: Math.round(avgMastery),
    highestTier: indexToTier(highestIdx),
    updated: new Date().toISOString(),
  };
}

/**
 * Admin utility: check if a manual override is valid.
 */
export function validateThresholdUpdate(overrides: Partial<DifficultyThresholds>): Partial<DifficultyThresholds> {
  const valid: Partial<DifficultyThresholds> = {};
  if (typeof overrides.masteryUpgradeAccuracy === 'number')
    valid.masteryUpgradeAccuracy = clamp(overrides.masteryUpgradeAccuracy, 50, 99);
  if (typeof overrides.masteryUpgradeStreak === 'number')
    valid.masteryUpgradeStreak = clamp(overrides.masteryUpgradeStreak, 1, 10);
  if (typeof overrides.masteryDegradeAccuracy === 'number')
    valid.masteryDegradeAccuracy = clamp(overrides.masteryDegradeAccuracy, 10, 70);
  if (typeof overrides.masteryDegradeStreak === 'number')
    valid.masteryDegradeStreak = clamp(overrides.masteryDegradeStreak, 1, 10);
  if (typeof overrides.speedWeight === 'number')
    valid.speedWeight = clamp(overrides.speedWeight, 0, 0.5);
  if (typeof overrides.minSessionsBeforeChange === 'number')
    valid.minSessionsBeforeChange = clamp(overrides.minSessionsBeforeChange, 1, 10);
  return valid;
}
