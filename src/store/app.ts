import { create } from 'zustand';
import type { UserStats, SessionRecord } from '../types/game';

interface AppState {
  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Current navigation
  currentPage: 'home' | 'games' | 'stats' | 'profile';
  setCurrentPage: (page: 'home' | 'games' | 'stats' | 'profile') => void;
  selectedGameId: string | null;
  setSelectedGameId: (id: string | null) => void;

  // User stats (local)
  userStats: Record<string, UserStats>;
  sessionHistory: SessionRecord[];
  
  addSession: (record: SessionRecord) => void;
  updateStats: (gameId: string, result: Omit<UserStats, 'gameId'>) => void;
  
  // Guest mode tracking
  isGuest: boolean;
  setAuthenticated: (auth: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page }),
  selectedGameId: null,
  setSelectedGameId: (id) => set({ selectedGameId: id }),
  
  userStats: {},
  sessionHistory: [],
  isGuest: true,

  addSession: (record) =>
    set((s) => ({
      sessionHistory: [record, ...s.sessionHistory].slice(0, 100),
    })),

  updateStats: (gameId, result) =>
    set((s) => {
      const existing = s.userStats[gameId];
      const newStats: UserStats = {
        gameId,
        highScore: Math.max(existing?.highScore ?? 0, result.highScore),
        bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, result.bestAccuracy),
        totalPlays: (existing?.totalPlays ?? 0) + 1,
        averageDifficulty:
          ((existing?.averageDifficulty ?? 0) * (existing?.totalPlays ?? 0) + result.averageDifficulty) /
          ((existing?.totalPlays ?? 0) + 1),
      };
      return {
        userStats: { ...s.userStats, [gameId]: newStats },
      };
    }),

  setAuthenticated: (auth) => set({ isGuest: !auth }),
}));
