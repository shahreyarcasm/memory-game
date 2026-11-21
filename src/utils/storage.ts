export const STORAGE_KEYS = {
  USER_PREFS: 'cp_user_prefs',
  GAME_SESSIONS: 'cp_game_sessions',
  USER_STATS: 'cp_user_stats',
} as const;

// Local storage helpers for guest users
export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn('Failed to save to localStorage');
  }
}

export function migrateGuestData(): Record<string, unknown> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { sessions: [], stats: {} };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
    return stored ? JSON.parse(stored) : { sessions: [], stats: {} };
  } catch {
    return { sessions: [], stats: {} };
  }
}
