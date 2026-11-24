import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Grid3x3 } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'showing' | 'input' | 'result' | 'complete';

// Cross-browser safe UUID — avoids crypto.randomUUID which isn't available in all mobile browsers
function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const ENCOURAGEMENTS = [
  'Your spatial memory is leveling up with every round!',
  'Each pattern you nail makes your visual recall sharper.',
  'The brain loves these challenges — keep stacking those wins!',
  'Positional memory improves with practice. You\'re on the right track!',
  'Even close calls train your brain to see patterns better next time.',
];

export default function SpatialMatrixGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const initialGridSize = (params.gridSize as number) ?? 3;
  const highlightRatio = params.highlightRatio != null ? (params.highlightRatio as number) : 0.25;
  const initialHighlights = Math.max(2, Math.round(initialGridSize * highlightRatio));

  const [phase, setPhase] = useState<Phase>('instruction');
  const [gridSize, setGridSize] = useState(initialGridSize);
  const [highlights, setHighlights] = useState<number[]>([]);
  const [userSelection, setUserSelection] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [lives, setLives] = useState(3);
  
  const gridSizeRef = useRef(3);
  const highlightsRef = useRef<number[]>([]);
  const roundRef = useRef(1);
  const scoreRef = useRef(0);
  const accuracyRef = useRef(100);
  const livesRef = useRef(3);
  const showingStartTimeRef = useRef(0);
  // Adaptive difficulty refs
  const difficultyLockedRef = useRef(false);
  const accuracyStreakRef = useRef(0); // consecutive correct rounds
  const highlightsCountRef = useRef(initialHighlights); // tracks how many cells to select

  const startGame = useCallback(() => {
    setPhase('showing');
    setGridSize(initialGridSize);
    setHighlights([]);
    setUserSelection([]);
    setRound(1);
    setScore(0);
    setAccuracy(100);
    setLives(3);

    gridSizeRef.current = initialGridSize;
    highlightsRef.current = [];
    roundRef.current = 1;
    scoreRef.current = 0;
    accuracyRef.current = 100;
    livesRef.current = 3;
    showingStartTimeRef.current = Date.now();
    difficultyLockedRef.current = false;
    accuracyStreakRef.current = 0;
    highlightsCountRef.current = initialHighlights;

    setTimeout(() => nextRound(initialGridSize, initialHighlights), 1200);
  }, [initialGridSize, initialHighlights]);

  const nextRound = useCallback((newGridSize: number, numHighlights: number) => {
    const cells = newGridSize * newGridSize;
    const indices = Array.from({ length: cells }, (_, i) => i);
    const shuffled = indices.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(numHighlights, cells - 1)).sort((a, b) => a - b);
    
    gridSizeRef.current = newGridSize;
    highlightsRef.current = selected;
    showingStartTimeRef.current = Date.now();
    
    setGridSize(newGridSize);
    setHighlights(selected);
    setUserSelection([]);
    setPhase('showing');
    
    setTimeout(() => {
      setPhase('input');
    }, Math.max(1200, newGridSize * 400 + 300));
  }, []);

  const handleCellClick = useCallback((index: number) => {
    // Prevent selecting more cells than target count
    if (userSelection.length >= highlightsRef.current.length && !userSelection.includes(index)) return;
    
    setUserSelection(prev => 
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  }, [userSelection]);

  const handleSubmit = useCallback(() => {
    const startTime = showingStartTimeRef.current;
    const responseTime = Date.now() - startTime;
    
    const correct = userSelection.length === highlightsRef.current.length &&
      highlightsRef.current.every(h => userSelection.includes(h));
    
    const newAccuracy = ((accuracyRef.current * (roundRef.current - 1)) + (correct ? 100 : 0)) / roundRef.current;
    
    if (correct) {
      const speedBonus = Math.max(0, Math.min(20, Math.floor((3000 - responseTime) / 100)));
      const points = highlightsRef.current.length * 15 + speedBonus;
      scoreRef.current += points;
      setScore(scoreRef.current);
    soundEnabled && playSound('correct');
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);
    soundEnabled && playSound('wrong');
      if (livesRef.current <= 0) {
        recordSession(
          {
            id: _uuid(),
            userId: null,
            gameId,
            score: scoreRef.current,
            accuracy: newAccuracy,
            difficultyLevel: gridSizeRef.current,
            metrics: { gridSize: gridSizeRef.current, roundsCompleted: roundRef.current },
          },
          { highScore: Math.max(scoreRef.current, 0), bestAccuracy: newAccuracy, averageDifficulty: gridSizeRef.current },
        );
        setPhase('complete');
        return;
      }
    }
    
    accuracyRef.current = newAccuracy;
    setAccuracy(newAccuracy);
    
    setPhase('result');
    roundRef.current += 1;
    setRound(roundRef.current);

    // ── Adaptive difficulty: simple streak-based, no spiral ──────────
    if (correct) {
      accuracyStreakRef.current += 1;
      difficultyLockedRef.current = false;
    } else {
      accuracyStreakRef.current = 0;
      difficultyLockedRef.current = true;
    }

    setTimeout(() => {
      const currentGrid = gridSizeRef.current;
      let nextSize: number;
      if (difficultyLockedRef.current) {
        // Locked after a mistake — stay at current grid size (don't reduce)
        nextSize = currentGrid;
      } else if (currentGrid < 6) {
        // Increase grid size every correct answer
        nextSize = currentGrid + 1;
      } else {
        nextSize = currentGrid;
      }
      // Highlights grow on correct answers, shrink on mistakes independently
      const maxPossible = nextSize * nextSize - 1; // can't fill all cells
      let nextHighlights: number;
      if (difficultyLockedRef.current) {
        // Reduce highlights after a mistake
        nextHighlights = Math.max(2, highlightsCountRef.current - 1);
      } else {
        // Increase highlights after a correct answer
        nextHighlights = Math.min(maxPossible, highlightsCountRef.current + 1);
      }
      highlightsCountRef.current = nextHighlights;
      nextRound(nextSize, nextHighlights);
    }, 800);
  }, [userSelection, gameId, recordSession, nextRound]);

  useEffect(() => {
    if (phase !== 'input') return;
    if (userSelection.length === highlightsRef.current.length && userSelection.length > 0) {
      const timer = setTimeout(() => {
        handleSubmit();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userSelection, phase, handleSubmit]);

  // Instruction with tier preview
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return (
        <DifficultyPreview
          tier={tier}
          masteryScore={masteryScore}
          message={message}
          howToPlay={howToPlay}
          onStart={() => startGame()}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-6 animate-fade-in px-6" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-center space-y-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-xl">
            <Grid3x3 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
            Spatial Matrix
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm">
            Watch the highlighted squares, then remember and tap their positions. Auto-checks when you select the right count!
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>

        <Button size="lg" onClick={startGame} className="w-full max-w-xs">
          Start Game (3 Lives)
        </Button>
      </div>
    );
  }


  // Showing pattern
  if (phase === 'showing') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 animate-fade-in px-4" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-center space-y-1">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Round {round} — Memorize These Positions
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {gridSize}×{gridSize} · {highlights.length} targets
          </p>
        </div>
        
        <div
          className="inline-grid gap-1 sm:gap-1.5"
          style={{ 
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            width: 'min(280px, 85vw)',
            aspectRatio: '1',
          }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, i) => (
            <div
              key={i}
              className={`rounded-lg transition-all duration-300 ${
                highlights.includes(i)
                  ? 'bg-gradient-to-br from-sky-500 to-blue-600 scale-105 shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
        
        <p className="text-slate-400 dark:text-slate-500 text-sm animate-pulse">Watch carefully...</p>
      </div>
    );
  }

  // Input phase
  if (phase === 'input') {
    const allSelected = userSelection.length === highlights.length;
    
    return (
      <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 animate-fade-in px-4" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        {/* Top info bar */}
        <div className="flex items-center justify-between w-full max-w-sm px-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Round {round}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {userSelection.length}/{highlights.length} selected
          </span>
          <span className="text-sm">{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</span>
          {difficultyLockedRef.current && (
            <span className="text-[10px] text-amber-500 font-semibold ml-1">🔒 Locked</span>
          )}
        </div>
        
        <p className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200">
          Tap the squares you remember!
        </p>
        
        {/* Grid */}
        <div
          className="inline-grid gap-1 sm:gap-1.5"
          style={{ 
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            width: 'min(280px, 85vw)',
            aspectRatio: '1',
            boxSizing: 'border-box'
          }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, i) => {
            const isSelected = userSelection.includes(i);
            return (
              <button
                key={i}
                onClick={() => handleCellClick(i)}
                className={`rounded-lg transition-all duration-150 touch-manipulation h-full w-full flex items-center justify-center ${isSelected ? 'bg-primary-500 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                style={{
                  transform: 'none',
                  flexShrink: 0,
                  aspectRatio: '1'
                }}
              >
                {isSelected && '✓'}
              </button>
            );
          })}
        </div>
        
        {allSelected && (
          <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 animate-pulse">
            ✓ All selected! Checking...
          </p>
        )}
      </div>
    );
  }

  // Result flash
  if (phase === 'result') {
    const correct = userSelection.length === highlights.length &&
      highlights.every(h => userSelection.includes(h));
    
    return (
      <div className={`flex flex-col items-center justify-center gap-4 animate-pop ${
        correct ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-rose-50/50 dark:bg-rose-900/10'
      }`} style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center ${
          correct ? 'bg-emerald-500' : 'bg-rose-500'
        } shadow-xl`}>
          <span className="text-2xl sm:text-3xl text-white font-bold">{correct ? '✓' : '✗'}</span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
          {correct ? 'Perfect!' : 'Not Quite — Try Again!'}
        </p>
      </div>
    );
  }

  // Complete
  if (phase === 'complete') {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-6" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-4xl sm:text-5xl mb-1">🎯</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
          Game Over
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{msg}</p>
        
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
            <p className="text-xl sm:text-2xl font-bold">{Math.round(accuracy)}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Rounds</p>
            <p className="text-xl sm:text-2xl font-bold">{round - 1}</p>
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

        <Button size="lg" onClick={startGame} className="w-full max-w-xs mt-2">
          Play Again
        </Button>
      </div>
    );
  }

  return null;
}
