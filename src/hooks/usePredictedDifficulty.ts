/**
 * Hook: reads current game skill state and resolves pre-game config.
 * Usage in any game component:
 *   const { tier, masteryScore, message, params, canUpgrade } = usePredictedDifficulty('digit-span');
 */
import { useMemo } from 'react';
import { useAppStore } from '../store/app';
import { resolveGameParameters } from '../utils/difficultyEngine';
import type { Tier } from '../types/difficulty';

export interface PredictedDifficulty {
  tier: Tier;
  masteryScore: number;
  message: string;
  params: Record<string, unknown>;
  totalPlays: number;
  highScore: number;
  bestAccuracy: number;
}

export function usePredictedDifficulty(gameId: string): PredictedDifficulty {
  const { gameSkillScores, userStats } = useAppStore();

  const skill = useMemo(() => gameSkillScores[gameId] ?? null, [gameSkillScores, gameId]);
  const stats = userStats[gameId];

  // When no data yet, show novice with a default message
  if (!skill) {
    return {
      tier: 'novice',
      masteryScore: 0,
      message: "Never played this game before? No worries — we'll start you at Novice and adapt as you go!",
      params: {},
      totalPlays: stats?.totalPlays ?? 0,
      highScore: stats?.highScore ?? 0,
      bestAccuracy: stats?.bestAccuracy ?? 0,
    };
  }

  // Full resolution via engine
  const resolved = resolveGameParameters(gameId, skill);
  return {
    tier: resolved.tier,
    masteryScore: skill.masteryScore,
    message: resolved.message,
    params: resolved.params,
    totalPlays: stats?.totalPlays ?? skill.sessionHistory.length,
    highScore: stats?.highScore ?? 0,
    bestAccuracy: stats?.bestAccuracy ?? skill.emaAccuracy,
  };
}

/** Whether the player qualifies for an automatic upgrade next session */
export function useUpgradePotential(gameId: string): boolean {
  const gameSkillScores = useAppStore(s => s.gameSkillScores);
  const skill = gameSkillScores[gameId];
  if (!skill) return false;
  const recentSessions = skill.sessionHistory.slice(-3);
  return recentSessions.every((s: { accuracy: number }) => s.accuracy >= 85) && skill.currentTier !== 'legend';
}
