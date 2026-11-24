import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { MapPin } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

const OBJECTS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁'];

// Cross-browser safe UUID — avoids crypto.randomUUID which isn't available in all mobile browsers
function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Performance-based encouragement
function getEncouragement(_score: number, accuracy: number, rounds: number): string {
  if (accuracy >= 90 && rounds >= 6) return 'Exceptional spatial recall! Your mind mapped those positions flawlessly — your hippocampus is thriving!';
  if (accuracy >= 70) return 'Strong positional memory! You nailed most placements — your visual-spatial skills are solid!';
  if (accuracy >= 50) return 'Good progress! You remembered more than half — each round rewires your brain for better recall.';
  return 'Every miss trains your brain to pay closer attention next time. Spatial memory grows with practice!';
}

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'showing' | 'placing' | 'result' | 'complete';

interface ItemState {
  id: number;
  object: string;
  targetPosition: number;
  currentPosition: number | null;
}

interface GameState {
  gridSize: number;
  numItems: number;
  items: ItemState[];
  phase: Phase;
  score: number;
  accuracy: number;
  round: number;
  mistakes: number;
}

export default function ObjectLocationGame({ gameId, howToPlay: _howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const initialGridSize = (params.gridSize as number) ?? 3;
  const initialItems = (params.itemCount as number) ?? 3;

  const [state, setState] = useState<GameState>({
    gridSize: initialGridSize,
    numItems: initialItems,
    items: [],
    phase: 'instruction',
    score: 0,
    accuracy: 100,
    round: 1,
    mistakes: 0,
  });
  const [roundResults, setRoundResults] = useState<Array<{ correct: number; total: number; responseTime?: number }>>([]);
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const roundResultsRef = useRef(roundResults);
  const startedAtRef = useRef(0);
  const scoreRef = useRef(0);
  const accuracyRef = useRef(100);
  const roundRef = useRef(1);
  const mistakesRef = useRef(0);
  const difficultyLockedRef = useRef(false);
  const consecutiveCorrectRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { roundResultsRef.current = roundResults; }, [roundResults]);

  const initializeRound = useCallback((gridSize: number, numItems: number) => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    
    const positions = Array.from({ length: gridSize * gridSize }, (_, i) => i);
    const shuffled = positions.sort(() => Math.random() - 0.5);
    const selectedPositions = shuffled.slice(0, numItems).sort((a, b) => a - b);
    const objects = [...OBJECTS].sort(() => Math.random() - 0.5).slice(0, numItems);
    
    const items: ItemState[] = selectedPositions.map((pos, idx) => ({
      id: idx,
      object: objects[idx],
      targetPosition: pos,
      currentPosition: null,
    }));

    startedAtRef.current = Date.now();

    setState(prev => ({
      ...prev,
      gridSize,
      numItems,
      items,
      phase: 'showing',
    }));

    showTimerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, phase: 'placing' as Phase }));
    }, gridSize * 400 + 600);
  }, []);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    accuracyRef.current = 100;
    roundRef.current = 1;
    mistakesRef.current = 0;
    difficultyLockedRef.current = false;
    consecutiveCorrectRef.current = 0;

    setState(prev => ({ ...prev, phase: 'showing', score: 0, accuracy: 100, round: 1, items: [], mistakes: 0 }));
    setRoundResults([]);
    initializeRound(initialGridSize, initialItems);
  }, [initializeRound, initialGridSize, initialItems]);

  const handleCellClick = useCallback((targetPos: number) => {
    setState(prev => {
      const unplacedIdx = prev.items.findIndex(item => item.currentPosition === null);
      if (unplacedIdx === -1) return prev;
      
      const updatedItems = prev.items.map((it, idx) =>
        idx === unplacedIdx ? { ...it, currentPosition: targetPos } : it
      );
      
      return { ...prev, items: updatedItems };
    });
  }, []);

  const handleItemPickup = useCallback((itemId: number) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(it => 
        it.id === itemId && it.currentPosition !== null
          ? { ...it, currentPosition: null }
          : it
      ),
    }));
  }, []);

  const checkAnswer = useCallback(() => {
    setState(prev => {
      const placed = prev.items.filter(i => i.currentPosition !== null);
      if (placed.length !== prev.numItems) return prev;
      
      const correctCount = prev.items.filter(
        item => item.currentPosition === item.targetPosition
      ).length;
      const acc = (correctCount / prev.numItems) * 100;
      
      // Speed bonus
      const responseTime = Date.now() - startedAtRef.current;
      const speedBonus = Math.max(0, Math.floor((3000 - responseTime) / 100));
      const points = correctCount * 20 + speedBonus;
      
      scoreRef.current += points;
      
      const newResults = [...roundResultsRef.current, { correct: correctCount, total: prev.numItems, responseTime }];
      setRoundResults(newResults);

      if (correctCount === prev.numItems) {
        soundEnabled && playSound('correct');
      } else if (correctCount < prev.numItems) {
        soundEnabled && playSound('wrong');
      }
      
      const newAccuracy = ((accuracyRef.current * (roundRef.current - 1)) + acc) / roundRef.current;
      accuracyRef.current = newAccuracy;
      
      // Track mistakes
      const roundMistakes = prev.numItems - correctCount;
      mistakesRef.current += roundMistakes;
      
      roundRef.current += 1;
      
      return {
        ...prev,
        phase: 'result' as Phase,
        score: scoreRef.current,
        accuracy: newAccuracy,
        round: roundRef.current,
        mistakes: mistakesRef.current,
      };
    });
    
    // Auto-advance after showing result
    setTimeout(() => {
      setState(prev => {
        // Game over on 3+ mistakes
        if (prev.mistakes >= 3) {
          const finalAcc = prev.accuracy;
          const finalScore = prev.score;

          recordSession(
            {
              id: _uuid(),
              userId: null,
              gameId,
              score: finalScore,
              accuracy: finalAcc,
              difficultyLevel: prev.gridSize,
              metrics: { roundsCompleted: prev.round, gridSizes: Array.from({ length: prev.round }, (_, i) => Math.min(7, initialGridSize + i)) },
            },
            { highScore: Math.max(finalScore, 0), bestAccuracy: finalAcc, averageDifficulty: prev.gridSize },
          );

          soundEnabled && playSound('complete');
          return { ...prev, phase: 'complete' as Phase };
        }

        const currentResults = roundResultsRef.current;
        const lastResult = currentResults[currentResults.length - 1];
        const correctLast = lastResult ? lastResult.correct / lastResult.total : 1;

        if (!lastResult || correctLast < 0.7 || prev.round > 8) {
          const finalAcc = prev.accuracy;
          const finalScore = prev.score;

          recordSession(
            {
              id: _uuid(),
              userId: null,
              gameId,
              score: finalScore,
              accuracy: finalAcc,
              difficultyLevel: prev.gridSize,
              metrics: { roundsCompleted: prev.round, gridSizes: Array.from({ length: prev.round }, (_, i) => Math.min(7, initialGridSize + i)) },
            },
            { highScore: Math.max(finalScore, 0), bestAccuracy: finalAcc, averageDifficulty: prev.gridSize },
          );

          soundEnabled && playSound('complete');
          return { ...prev, phase: 'complete' as Phase };
        }

        // Adaptive difficulty: track results and lock/grow grid
        if (correctLast >= 1.0) {
          consecutiveCorrectRef.current += 1;
          if (difficultyLockedRef.current && consecutiveCorrectRef.current >= 2) {
            difficultyLockedRef.current = false;
          }
        } else {
          difficultyLockedRef.current = true;
          consecutiveCorrectRef.current = 0;
        }

        // Next round — adapt grid size based on locked state
        const baseGrowth = difficultyLockedRef.current ? 0 : 1;
        const nextGridSize = Math.min(7, prev.gridSize + baseGrowth);
        const nextNumItems = Math.min(prev.numItems + 1, nextGridSize * nextGridSize - 1);

        setTimeout(() => initializeRound(nextGridSize, nextNumItems), 100);

        return prev;
      });
    }, 1400);
  }, [gameId, recordSession, initializeRound]);

  // Auto-check when all items placed
  useEffect(() => {
    if (state.phase !== 'placing') return;
    const placed = state.items.filter(item => item.currentPosition !== null);
    if (placed.length === state.numItems) {
      const timer = setTimeout(() => {
        checkAnswer();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [state.items, state.phase, state.numItems, checkAnswer]);

  if (state.phase === 'instruction') {
    if (masteryScore > 0) {
      return (
        <DifficultyPreview
          tier={tier}
          masteryScore={masteryScore}
          message={message}
          onStart={startGame}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl">
            <MapPin className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
            Object Grid
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Watch where each creature appears, then tap cells to place them back. 3 mistakes ends the game!
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 w-full max-w-xs text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">How it works:</p>
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p>👀 Memorize object positions</p>
            <p>👆 Tap cells to place objects</p>
            <p>⚠️ 3 mistakes = game over</p>
            <p>✅ Auto-checks when all placed</p>
          </div>
        </div>
        
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">
          Start Game
        </Button>
      </div>
    );
  }

  if (state.phase === 'showing') {
    const size = state.gridSize;
    return (
      <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 animate-fade-in px-4" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-center space-y-1">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Round {state.round} — Memorize!
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {size}×{size} grid · {state.numItems} objects
          </p>
        </div>
        
        <div
          className="inline-grid gap-1.5 sm:gap-2 mx-auto"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, width: 'min(280px, 90vw)' }}
        >
          {Array.from({ length: size * size }).map((_, i) => {
            const item = state.items.find(it => it.targetPosition === i);
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg flex items-center justify-center text-2xl sm:text-3xl transition-all ${
                  item
                    ? 'bg-violet-100 dark:bg-violet-900/30 animate-reveal'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
                style={{ animationDelay: `${item ? item.id * 80 : 0}ms` }}
              >
                {item?.object}
              </div>
            );
          })}
        </div>
        
        <p className="text-slate-400 dark:text-slate-500 text-sm animate-pulse">Remember these positions!</p>
      </div>
    );
  }

  if (state.phase === 'placing') {
    const size = state.gridSize;
    const placedItems = state.items.filter(item => item.currentPosition !== null);
    const allPlaced = placedItems.length === state.numItems;
    const heartsRemaining = Math.max(0, 3 - state.mistakes);

    return (
      <div className="flex flex-col bg-slate-50 dark:bg-slate-900" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        {/* Compact stats bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl mx-2 sm:mx-3 mt-2 p-2 sm:p-3 border border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <span className="text-slate-500 dark:text-slate-400">R{state.round}</span>
            <span className="text-slate-400 dark:text-slate-500">{placedItems.length}/{state.numItems}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-700 dark:text-slate-200">{state.score}</span> pts
            </span>
            <span className="text-sm">{'❤️'.repeat(heartsRemaining)}{'🖤'.repeat(3 - heartsRemaining)}</span>
          </div>
        </div>

        {/* Grid — centered, but doesn't push tray off-screen */}
        <div className="flex-1 flex flex-col items-center justify-center px-3 py-2 min-h-0">
          <div
            className="inline-grid gap-1.5 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, width: 'min(280px, 88vw)' }}
          >
            {Array.from({ length: size * size }).map((_, i) => {
              const placedItem = state.items.find(it => it.currentPosition === i);
              return (
                <button
                  key={i}
                  onClick={() => handleCellClick(i)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-2xl sm:text-3xl transition-all touch-manipulation ${
                    placedItem
                      ? 'bg-violet-200 dark:bg-violet-800/40 border-2 border-violet-500 cursor-pointer hover:scale-95'
                      : 'border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500'
                  }`}
                >
                  {placedItem?.object}
                </button>
              );
            })}
          </div>
        </div>

        {/* Unplaced items tray — always visible at bottom */}
        {!allPlaced && (
          <div className="px-3 pb-3 sm:pb-4 shrink-0">
            <div className="flex flex-wrap justify-center gap-2">
              {state.items.filter(item => item.currentPosition === null).map(item => (
                <button
                  key={item.id}
                  onClick={() => handleItemPickup(item.id)}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 dark:bg-slate-700 text-2xl hover:bg-violet-100 dark:hover:bg-violet-900/30 border border-slate-300 dark:border-slate-600 active:scale-95 transition-all touch-manipulation"
                >
                  {item.object}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">
              Tap an object below, then tap a cell to place it
            </p>
          </div>
        )}

        {allPlaced && (
          <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 animate-pulse px-3 pb-2 sm:pb-3 shrink-0">
            ✓ All placed! Checking...
          </p>
        )}
      </div>
    );
  }

  if (state.phase === 'result') {
    const correct = state.items.filter(item => item.currentPosition === item.targetPosition).length;
    const isPerfect = correct === state.numItems;

    return (
      <div className={`flex flex-col items-center justify-center gap-3 animate-pop py-8 ${
        isPerfect ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-amber-50/50 dark:bg-amber-900/10'
      }`} style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center ${
          isPerfect ? 'bg-emerald-500' : 'bg-amber-500'
        } shadow-xl`}>
          <span className="text-2xl sm:text-3xl text-white font-bold">{isPerfect ? '✓' : `${correct}/${state.numItems}`}</span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
          {isPerfect ? 'Perfect!' : `${correct} of ${state.numItems} correct`}
        </p>

        {/* Round summary — show what you placed vs correct positions */}
        <div className="flex flex-wrap justify-center gap-1.5 px-4 max-w-xs">
          {state.items.map(item => (
            <div
              key={item.id}
              className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl ${
                item.currentPosition === item.targetPosition
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-500'
                  : 'bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-500'
              }`}
            >
              {item.object}
              {item.currentPosition !== item.targetPosition && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center">✕</span>
              )}
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPerfect ? 'Moving to next round...' : 'Keep going — you\'ve got lives left!'}
        </p>
      </div>
    );
  }

  if (state.phase === 'complete') {
    const finalAcc = state.accuracy;
    const finalScore = state.score;
    const msg = getEncouragement(0, finalAcc, state.round - 1);

    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-4xl sm:text-5xl mb-1">🗺️</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
          Game Over
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{msg}</p>
        
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">{finalScore}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
            <p className="text-xl sm:text-2xl font-bold">{Math.round(finalAcc)}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Rounds</p>
            <p className="text-xl sm:text-2xl font-bold">{state.round - 1}</p>
          </div>
        </div>
        
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-lg font-black px-3 py-1 rounded-full text-white ${
              tier === 'novice' ? 'bg-emerald-500' :
              tier === 'explorer' ? 'bg-blue-500' :
              tier === 'master' ? 'bg-violet-500' :
              tier === 'grandmaster' ? 'bg-amber-500' :
              'bg-rose-500'
            }`}>{tier.toUpperCase()}</span>
            <div className="flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Mastery Score</p>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${masteryScore}%`,
                    background: tier === 'novice' ? '#10b981' :
                                tier === 'explorer' ? '#3b82f6' :
                                tier === 'master' ? '#8b5cf6' :
                                tier === 'grandmaster' ? '#f59e0b' : '#f43f5e',
                  }}
                />
              </div>
              <p className="text-right text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{masteryScore}/100</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>

        <Button size="lg" onClick={startGame} className="w-full max-w-xs">
          Play Again
        </Button>
      </div>
    );
  }

  return null;
}
