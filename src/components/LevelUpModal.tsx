import { TIER_STYLES, type Tier } from '../types/difficulty';

/**
 * LevelUpModal.tsx - Animated notification that shows when player qualifies for next tier
 * 
 * This component:
 * - Displays animated modal when player qualifies for upgrade (3 consecutive sessions with ≥82% accuracy)
 * - Explains exactly what changes (sequence length, grid size, target speed, etc.)
 * - Uses game-specific parameters from usePredictedDifficulty
 * - Is reusable across all games
 * - Presentational only - no hooks, just props
 */

export interface LevelUpModalProps {
  /** Whether the upgrade animation should show */
  isUpgrading: boolean;
  /** Current tier before upgrade */
  currentTier: Tier;
  /** New tier after upgrade */
  nextTier: Tier;
  /** Upgrade details with game-specific parameter changes */
  upgradeInfo: {
    gameId: string;
    newTier: Tier;
    parameters: Record<string, unknown>;
  };
  /** Callback when user dismisses the modal */
  onDismiss: () => void;
}

export function LevelUpModal({ 
  isUpgrading, 
  currentTier, 
  nextTier, 
  upgradeInfo,
  onDismiss 
}: LevelUpModalProps) {
  if (!isUpgrading) return null;

  const nextStyle = TIER_STYLES[nextTier];
  const TIER_ORDER: Tier[] = ['novice', 'explorer', 'master', 'grandmaster', 'legend'];
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const nextIndex = TIER_ORDER.indexOf(nextTier);

  // Format parameter changes for display
  const formatParameterChange = (key: string, value: unknown): string => {
    switch (key) {
      case 'sequenceLength':
        return `Longer digit sequences (up to ${value})`;
      case 'gridSize':
        return `Larger grid (${value}×${value})`;
      case 'targetSpeed':
        return `Faster target speed (${Math.round((value as number) * 100)}%)`;
      case 'patternVariation':
        return 'Randomized pattern variations to prevent memorization';
      case 'highlightRatio':
        return `Higher highlight ratio (${Math.round((value as number) * 100)}%)`;
      case 'sequenceLength':
        return `Longer sequences (up to ${value})`;
      case 'stroopComplexity':
        return `More complex color/word combinations (level ${value})`;
      case 'pairCount':
        return `More card pairs to match (${value} pairs)`;
      default:
        return `${key} changed to ${String(value)}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative max-w-md w-full mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 animate-pop">
        {/* Close button */}
        <button 
          onClick={onDismiss} 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-300 dark:text-gray-300 dark:hover:text-gray-200 transition-colors"
          aria-label="Dismiss upgrade notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Celebration header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl mb-4 animate-bounce-slow">
            <span className="text-4xl">{nextStyle.emoji}</span>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            {nextTier === 'legend' ? '🏆 LEGEND STATUS ACHIEVED!' : 
             nextTier === 'grandmaster' ? '🌟 GRANDMASTER STATUS ACHIEVED!' : 
             nextTier === 'master' ? '✨ MASTER STATUS ACHIEVED!' : 
             nextTier === 'explorer' ? '🔍 EXPLORER STATUS ACHIEVED!' : 
             '🌱 TIER UPGRADE!'}
          </h2>
          
          <p className="text-slate-600 dark:text-slate-400">
            Congratulations on reaching the next level!
          </p>
        </div>

        {/* Tier progression visualization */}
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Your Progress</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tier {currentIndex + 1} → Tier {nextIndex + 1}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            {TIER_ORDER.map((t, idx) => (
              <div key={t} className="flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${
                    idx < nextIndex 
                      ? `${TIER_STYLES[t].bg} ${TIER_STYLES[t].color}` 
                      : idx === nextIndex 
                        ? `${TIER_STYLES[t].bg} ${TIER_STYLES[t].color} animate-pulse`
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {TIER_STYLES[t].emoji}
                </div>
                <span className={`text-xs font-medium mt-1 ${idx <= nextIndex ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                  {TIER_STYLES[t].emoji === '🌱' ? 'Novice' : TIER_STYLES[t].emoji === '⚡' ? 'Explorer' : TIER_STYLES[t].emoji === '🧠' ? 'Master' : TIER_STYLES[t].emoji === '💎' ? 'Grand.' : 'Legend'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* What's changing */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Your upgrade unlocks:
          </h3>
          <ul className="space-y-2">
            {Object.entries(upgradeInfo.parameters).map(([key, value]) => (
              <li key={key} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {formatParameterChange(key, value)}
                </span>
              </li>
            ))}
          </ul>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
            These changes will be active starting your next session.
          </p>
        </div>

        {/* Dismiss button */}
        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg active:scale-95"
          >
            Got it — Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
}