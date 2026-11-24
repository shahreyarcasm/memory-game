/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Pattern Breakers — Randomised difficulty variants for each game
 *
 *  These are injected after the base parameters from difficultyEngine.ts
 *  are resolved. Each function returns a modifier object (or null if not active).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Tier } from '../types/difficulty';

// Helper: random chance trigger
const roll = (chance: number): boolean => Math.random() < chance;

// ─── Digit Span Breakers ──────────────────────────────────────────────────────

export interface DigitSpanBreaker {
  sequence?: number[];         // pre-mixed with a distractor digit
  isBackward?: boolean;        // force reverse mode even if not enabled
  pairMode?: boolean;          // show pairs of digits instead of singles
}

export function generateDigitSpanBreaker(tier: Tier, baseLength: number): DigitSpanBreaker | null {
  if (!roll(0.12 + tierIndex(tier) * 0.08)) return null;
  const r = Math.random();
  if (r < 0.4) {
    // Insert a "ghost" digit that doesn't count toward length
    const seq = Array.from({ length: baseLength }, () => Math.floor(Math.random() * 10));
    const ghostIdx = Math.floor(Math.random() * (seq.length + 1));
    seq.splice(ghostIdx, 0, Math.floor(Math.random() * 10));
    return { sequence: seq };
  }
  if (r < 0.7) return { isBackward: true };
  return { pairMode: true };
}

// ─── Rapid Flash Breakers ─────────────────────────────────────────────────────

export interface RapidFlashBreaker {
  distractorProbability?: number;   // extra decoy targets spawn alongside real ones
  colorShift?: boolean;             // target colour changes mid-flight
  speedBurst?: boolean;             // brief acceleration window
}

export function generateRapidFlashBreaker(tier: Tier, baseChance: number): RapidFlashBreaker | null {
  if (!roll(baseChance * 0.6)) return null;
  const effects: RapidFlashBreaker = {};
  if (roll(0.5))  effects.distractorProbability = 0.3 + tierIndex(tier) * 0.05;
  if (roll(0.3))  effects.colorShift = true;
  if (roll(0.2))  effects.speedBurst = true;
  return Object.keys(effects).length > 0 ? effects : null;
}

// ─── Spatial Matrix Breakers ──────────────────────────────────────────────────

export interface SpatialMatrixBreaker {
  flippedGrid?: boolean;              // positions mirrored on X or Y axis
  partialReveal?: boolean;            // show some cells briefly before full pattern
  trailHighlight?: boolean;           // faint trail marks previous round's pattern
}

export function generateSpatialMatrixBreaker(tier: Tier, gridSize: number): SpatialMatrixBreaker | null {
  if (!roll(0.1 + tierIndex(tier) * 0.06)) return null;
  const effects: SpatialMatrixBreaker = {};
  if (roll(0.5)) effects.flippedGrid = Math.random() > 0.5;
  if (roll(0.4)) effects.partialReveal = true;
  if (gridSize >= 5 && roll(0.3)) effects.trailHighlight = true;
  return Object.keys(effects).length > 0 ? effects : null;
}

// ─── Stroop Breakers ──────────────────────────────────────────────────────────

export interface StroopBreaker {
  ruleSwitchMidRound?: number;   // switch rule after N correct answers
  extraColor?: string;           // hex colour name added to palette
  dualRuleActive?: boolean;      // both word AND ink possible in same round
}

export function generateStroopBreaker(tier: Tier, currentAccuracy: number): StroopBreaker | null {
  if (!roll(0.08 + tierIndex(tier) * 0.06)) return null;
  const effects: StroopBreaker = {};
  if (currentAccuracy > 80 && tierIndex(tier) >= 2) {
    effects.ruleSwitchMidRound = 3 + Math.floor(Math.random() * 4);
  }
  if (tierIndex(tier) >= 3 && roll(0.4)) effects.extraColor = '#00ffcc'; // teal
  if (tierIndex(tier) >= 4 && roll(0.5)) effects.dualRuleActive = true;
  return Object.keys(effects).length > 0 ? effects : null;
}

// ─── Card Pairs Breakers ──────────────────────────────────────────────────────

export interface CardPairsBreaker {
  temporaryOverlap?: boolean;       // briefly flip two cards face-up together
  shuffledWhileFlipped?: boolean;   // swap two unmatched cards after first look
  limitedFlipTime?: number;         // ms — must tap within window
}

export function generateCardPairsBreaker(tier: Tier, pairCount: number): CardPairsBreaker | null {
  if (!roll(0.06 + tierIndex(tier) * 0.05)) return null;
  const effects: CardPairsBreaker = {};
  if (pairCount >= 9 && roll(0.4)) effects.temporaryOverlap = true;
  if (tierIndex(tier) >= 2 && roll(0.3)) effects.shuffledWhileFlipped = true;
  if (tierIndex(tier) >= 3) effects.limitedFlipTime = Math.max(3000 - tierIndex(tier) * 400, 1500);
  return Object.keys(effects).length > 0 ? effects : null;
}

// ─── Object Location Breakers ─────────────────────────────────────────────────

export interface ObjectLocationBreaker {
  objectsMoveBeforeHide?: boolean;     // objects shift one cell before disappearing
  similarObjects?: boolean;            // two objects look nearly identical
  gridOffset?: 'left' | 'right' | 'up' | 'down';  // perspective tilt
}

export function generateObjectLocationBreaker(tier: Tier, gridSize: number): ObjectLocationBreaker | null {
  if (!roll(0.07 + tierIndex(tier) * 0.05)) return null;
  const effects: ObjectLocationBreaker = {};
  if (roll(0.5)) effects.objectsMoveBeforeHide = true;
  if (gridSize >= 5 && roll(0.4)) effects.similarObjects = true;
  if (tierIndex(tier) >= 3 && roll(0.3)) effects.gridOffset = ['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)] as NonNullable<ObjectLocationBreaker['gridOffset']>;
  return Object.keys(effects).length > 0 ? effects : null;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function tierIndex(tier: Tier): number {
  return ['novice', 'explorer', 'master', 'grandmaster', 'legend'].indexOf(tier);
}
