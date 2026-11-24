import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserStats, SessionRecord } from '../types/game';
import type { GameSkillScore, GlobalSkillScore, DifficultyThresholds } from '../types/difficulty';
import { processSession, computeGlobalScore, validateThresholdUpdate, DEFAULT_THRESHOLDS } from '../utils/difficultyEngine';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'cognitivedifficulty2024';

export interface DemoPrefs {
  /** Global toggle — when false, never auto-show demos */
  enabled: boolean;
  /** Per-game: has the user completed their first play? */
  firstPlayed: Record<string, boolean>;
  /** Per-game: user explicitly hid the demo for this game */
  suppressed: Record<string, boolean>;
}

export type SyncStatus = 'saved' | 'pending' | 'synced';

interface AppState {
  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Sound
  soundEnabled: boolean;
  toggleSound: () => void;

  // Current navigation
  currentPage: 'home' | 'games' | 'stats' | 'profile' | 'admin';
  setCurrentPage: (page: 'home' | 'games' | 'stats' | 'profile' | 'admin') => void;
  selectedGameId: string | null;
  setSelectedGameId: (id: string | null) => void;

  // User stats (local)
  userStats: Record<string, UserStats>;
  sessionHistory: SessionRecord[];

  /**
   * Persist a finished game session + update stats atomically.
   * Dedupes by session id so offline retries can't double-count.
   * Also updates adaptive difficulty skill scores.
   */
  recordSession: (
    record: Omit<SessionRecord, 'id' | 'playedAt'> & { id?: string; playedAt?: string },
    stats: { highScore: number; bestAccuracy: number; averageDifficulty: number },
  ) => { isNewBest: boolean; improvementVsLast: number | null };

  // Adaptive difficulty skill tracking
  gameSkillScores: Record<string, GameSkillScore>;
  globalSkillScore: GlobalSkillScore;

  /** Called after each session to update per-game mastery state */
  updateSkillScore: (gameId: string, accuracy: number, avgReactionMs?: number, timeToCompleteSec?: number) => void;

  /** Returns pre-computed config for a game before it starts */
  getGameConfig: (gameId: string) => { tier: string; params: Record<string, unknown>; message: string } | null;

  // Admin thresholds (can be overridden from admin panel)
  difficultyThresholds: DifficultyThresholds;
  setDifficultyThresholds: (overrides: Partial<DifficultyThresholds>) => void;

  /** Sync status indicator (local-first: 'saved' for guests) */
  syncStatus: SyncStatus;

  // Demo/first-play preferences
  demoPrefs: DemoPrefs;
  setDemoEnabled: (enabled: boolean) => void;
  suppressDemoForGame: (gameId: string, suppressed: boolean) => void;
  markGamePlayed: (gameId: string) => void;
  /** Whether the demo should auto-show right now for this game */
  shouldShowDemo: (gameId: string) => boolean;

  // Guest mode tracking
  isGuest: boolean;
  /** Admin authentication — gates the developer-only /admin area */
  isAdmin: boolean;
  /** Returns true on success, false on bad credentials */
  adminLogin: (username: string, password: string) => boolean;
  adminLogout: () => void;

  // Data reset
  resetAllData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      darkMode:
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

      soundEnabled: true,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

      currentPage: 'home',
      setCurrentPage: (page) => set({ currentPage: page }),
      selectedGameId: null,
      setSelectedGameId: (id) => set({ selectedGameId: id }),

      userStats: {},
      sessionHistory: [],
      syncStatus: 'saved',
      isGuest: true,
      isAdmin: false,

      demoPrefs: {
        enabled: true,
        firstPlayed: {},
        suppressed: {},
      },

      // ── Adaptive Difficulty State ─────────────────────────────────────────
      gameSkillScores: {},
      globalSkillScore: { totalPlayCount: 0, averageMasteryAcrossGames: 0, highestTier: 'novice', updated: new Date().toISOString() },
      difficultyThresholds: DEFAULT_THRESHOLDS,

      updateSkillScore: (gameId, accuracy, avgReactionMs, timeToCompleteSec) => {
        const state = get();
        const existing = state.gameSkillScores[gameId] ?? null;

        const sessionPoint = {
          gameId,
          accuracy,
          avgReactionMs,
          timeToCompleteSec,
          difficultyLevel: state.userStats[gameId]?.averageDifficulty ?? 1,
          score: state.userStats[gameId]?.highScore ?? 0,
          sessionDate: new Date().toISOString(),
        };

        const newSkill = processSession(existing, sessionPoint, state.difficultyThresholds);
        const updatedScores = { ...state.gameSkillScores, [gameId]: newSkill };

        // Recompute global score
        const allSkills = Object.values(updatedScores);
        const global = computeGlobalScore(allSkills);

        set({ gameSkillScores: updatedScores, globalSkillScore: global });
      },

      getGameConfig: (gameId) => {
        const state = get();
        const skill = state.gameSkillScores[gameId] ?? null;
        if (!skill) return null;
        // This is intentionally lightweight here; full param resolution lives in the engine
        // called by individual game components via import.
        return {
          tier: skill.currentTier,
          params: {
            multiplier: 1 + (['novice','explorer','master','grandmaster','legend'].indexOf(skill.currentTier)) * 0.15,
            variantChance: Math.max(0, (skill.masteryScore - 50) / 100),
          },
          message: `${skill.currentTier.charAt(0).toUpperCase() + skill.currentTier.slice(1)} tier — ${skill.masteryScore}% mastery`,
        };
      },

      setDifficultyThresholds: (overrides) => {
        const valid = validateThresholdUpdate(overrides);
        if (Object.keys(valid).length === 0) return;
        set((s) => ({
          difficultyThresholds: { ...s.difficultyThresholds, ...valid },
        }));
      },

      // ── Original Methods ──────────────────────────────────────────────────

      recordSession: (record, stats) => {
        const state = get();
        const id = record.id ?? crypto.randomUUID?.() ?? `sess-${Date.now()}-${Math.random()}`;

        // Dedupe
        if (state.sessionHistory.some((s) => s.id === id)) {
          return {
            isNewBest: false,
            improvementVsLast: state.userStats[record.gameId]?.lastScore != null
              ? record.score - (state.userStats[record.gameId]?.lastScore ?? 0)
              : null,
          };
        }

        const existing = state.userStats[record.gameId];
        const isNewBest = !existing || record.score > existing.highScore;
        const improvementVsLast =
          existing?.lastScore != null ? record.score - existing.lastScore : null;

        const newStats: UserStats = {
          gameId: record.gameId,
          highScore: Math.max(existing?.highScore ?? 0, record.score),
          bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, stats.bestAccuracy),
          totalPlays: (existing?.totalPlays ?? 0) + 1,
          averageDifficulty:
            ((existing?.averageDifficulty ?? 0) * (existing?.totalPlays ?? 0) +
              stats.averageDifficulty) /
            ((existing?.totalPlays ?? 0) + 1),
          lastScore: record.score,
          lastPlayedAt: record.playedAt ?? new Date().toISOString(),
        };

        // Pull metrics needed for skill scoring
        const metrics = record.metrics as Record<string, unknown> | undefined;
        const avgReactionMs = typeof metrics?.avgReactionMs === 'number'
          ? metrics.avgReactionMs
          : undefined;
        const timeToCompleteSec = typeof metrics?.time === 'number'
          ? metrics.time / 1000
          : undefined;

        set((s) => ({
          sessionHistory: [{ ...record, id, playedAt: record.playedAt ?? new Date().toISOString() }, ...s.sessionHistory].slice(0, 200),
          userStats: { ...s.userStats, [record.gameId]: newStats },
          demoPrefs: {
            ...s.demoPrefs,
            firstPlayed: { ...s.demoPrefs.firstPlayed, [record.gameId]: true },
          },
          syncStatus: s.isGuest ? 'saved' : 'pending',
        }));

        // Update adaptive skill score asynchronously (non-blocking)
        setTimeout(() => {
          get().updateSkillScore(record.gameId, record.accuracy, avgReactionMs, timeToCompleteSec);
        }, 0);

        // Guest/local persistence is the source of truth; mark synced shortly after
        setTimeout(() => {
          set((s) => ({ syncStatus: s.isGuest ? 'saved' : 'synced' }));
        }, 800);

        return { isNewBest, improvementVsLast };
      },

      setDemoEnabled: (enabled) =>
        set((s) => ({ demoPrefs: { ...s.demoPrefs, enabled } })),

      suppressDemoForGame: (gameId, suppressed) =>
        set((s) => ({
          demoPrefs: {
            ...s.demoPrefs,
            suppressed: { ...s.demoPrefs.suppressed, [gameId]: suppressed },
          },
        })),

      markGamePlayed: (gameId) =>
        set((s) => ({
          demoPrefs: {
            ...s.demoPrefs,
            firstPlayed: { ...s.demoPrefs.firstPlayed, [gameId]: true },
          },
        })),

      shouldShowDemo: (gameId) => {
        const { demoPrefs } = get();
        if (!demoPrefs.enabled) return false;
        if (demoPrefs.suppressed[gameId]) return false;
        return !demoPrefs.firstPlayed[gameId];
      },

      adminLogin: (username: string, password: string) => {
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
          set({ isAdmin: true });
          return true;
        }
        return false;
      },

      adminLogout: () => set({ isAdmin: false }),

      resetAllData: () =>
        set({
          userStats: {},
          sessionHistory: [],
          gameSkillScores: {},
          globalSkillScore: { totalPlayCount: 0, averageMasteryAcrossGames: 0, highestTier: 'novice', updated: new Date().toISOString() },
          difficultyThresholds: DEFAULT_THRESHOLDS,
          demoPrefs: { enabled: true, firstPlayed: {}, suppressed: {} },
          syncStatus: 'saved',
        }),
    }),
    {
      name: 'cognitive-pulse-storage',
      partialize: (state) => ({
        darkMode: state.darkMode,
        soundEnabled: state.soundEnabled,
        userStats: state.userStats,
        sessionHistory: state.sessionHistory,
        gameSkillScores: state.gameSkillScores,
        globalSkillScore: state.globalSkillScore,
        difficultyThresholds: state.difficultyThresholds,
        isGuest: state.isGuest,
        demoPrefs: state.demoPrefs,
      }),
    },
  ),
);
