export type CognitiveCategory = 'working-memory' | 'attention' | 'spatial' | 'reaction' | 'recall';

export interface GameMetadata {
  id: string;
  slug: string;
  title: string;
  category: CognitiveCategory;
  description: string;
  icon: string;
}

export interface GameConfig {
  difficulty?: number;
  [key: string]: unknown;
}

export interface GameResult {
  score: number;
  accuracy: number;
  difficultyReached: number;
  rawMetrics: Record<string, unknown>;
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

export interface UserStats {
  gameId: string;
  highScore: number;
  bestAccuracy: number;
  totalPlays: number;
  averageDifficulty: number;
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
