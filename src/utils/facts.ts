import { useMemo } from 'react';
import { FACTS, pickSessionFact, type MemoryFact } from '../data/facts';

const KEY_FACT_HISTORY = 'cp_fact_history';

/**
 * Returns the fact shown for this page load. Each new session/reload rotates
 * to a different fact and avoids repeating the last ~8 shown on this device.
 * The rotation itself is persisted so a reload always advances to a new fact.
 */
export function getSessionFact(): MemoryFact {
  try {
    const history = JSON.parse(localStorage.getItem(KEY_FACT_HISTORY) ?? '[]') as number[];
    const fact = pickSessionFact(history);
    const idx = FACTS.indexOf(fact);
    if (idx >= 0) {
      localStorage.setItem(KEY_FACT_HISTORY, JSON.stringify([...history, idx].slice(-20)));
    }
    return fact;
  } catch {
    return pickSessionFact([]);
  }
}

/** React hook: stable fact for the lifetime of this page session. */
export function useSessionFact(): MemoryFact {
  return useMemo(getSessionFact, []);
}
