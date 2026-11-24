import type { LucideIcon } from 'lucide-react';

export type CognitiveCategory = 'working-memory' | 'attention' | 'spatial' | 'reaction' | 'recall';

export interface GameMetadata {
  id: string;
  slug: string;
  title: string;
  category: CognitiveCategory;
  description: string;
  /** Short label shown on the icon tile (fallback for platforms without lucide) */
  icon: string;
  /** Lucide icon component for the game's visual identity */
  lucideIcon: LucideIcon;
  /** Tailwind-safe hex used for game-specific theming */
  color: string;
  /** One-line "how to play" used by the demo system */
  howToPlay: string;
}

export interface GameConfig {
  difficulty?: number;
  [key: string]: unknown;
}

export interface ScoreBreakdown {
  /** Primary earned points */
  points: number;
  accuracy: number;
  difficultyReached: number;
  components: { label: string; value: string }[];
}

export interface GameResult {
  score: number;
  accuracy: number;
  difficultyReached: number;
  rawMetrics: Record<string, unknown>;
  /** Optional richer breakdown for the results screen */
  breakdown?: ScoreBreakdown;
  /** Feedback copy derived from actual performance */
  feedback?: { praise: string; improvement: string };
  isNewBest?: boolean;
  improvementVsLast?: number;
}

export interface GameState<T = unknown> {
  currentPhase: 'instruction' | 'countdown' | 'playing' | 'complete';
  data: T;
}

export interface GameModule {
  metadata: GameMetadata;
  initialState(config: GameConfig): GameState<unknown>;
  getNextState(state: GameState<unknown>, action: GameAction): GameState<unknown> | null;
  calculateResult(state: GameState<unknown>): GameResult;
}

export interface GameAction {
  type: string;
  payload?: unknown;
}

/** Legacy stats — still stored, merged with new skill scores */
export interface UserStats {
  gameId: string;
  highScore: number;
  bestAccuracy: number;
  totalPlays: number;
  averageDifficulty: number;
  lastScore?: number;
  lastPlayedAt?: string;
}

export interface SessionRecord {
  id: string;
  userId: string | null;
  gameId: string;
  score: number;
  accuracy: number;
  difficultyLevel: number;
  metrics: Record<string, unknown>;
  playedAt: string;
}
