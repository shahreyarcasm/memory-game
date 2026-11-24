import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Eye } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'preview' | 'playing' | 'complete';

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'W'];

interface Cell {
  symbol: string;
  isOddOne: boolean;
}

function generateGrid(size: number): { cells: Cell[][]; oddPos: { row: number; col: number } } {
  const baseSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  let oddSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  while (oddSymbol === baseSymbol) oddSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  const rows: Cell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < size; c++) {
      row.push({ symbol: baseSymbol, isOddOne: false });
    }
    rows.push(row);
  }

  const oddRow = Math.floor(Math.random() * size);
  const oddCol = Math.floor(Math.random() * size);
  rows[oddRow][oddCol] = { symbol: oddSymbol, isOddOne: true };

  return { cells: rows, oddPos: { row: oddRow, col: oddCol } };
}

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.9) return 'Eagle eyes! Your selective attention is operating at peak performance!';
  if (pct >= 0.7) return 'Sharp focus! You spotted most differences quickly — your pattern detection is improving.';
  if (pct >= 0.5) return 'Good scanning strategy! Keep training — your visual processing speed will accelerate.';
  return 'Every miss teaches your brain what to look for next. Trust the process!';
}

export default function VisualSearchGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const diff = (params.difficulty ?? 2) as number;

  const [phase, setPhase] = useState<Phase>('instruction');
  const [config, setConfig] = useState({ score: 0, correct: 0, total: 0 });
  const [timeLeft, setTimeLeft] = useState(60);
  const [hasStartedTimer, setHasStartedTimer] = useState(false);
  const [gridSize, setGridSize] = useState(3);
  const [cells, setCells] = useState<Cell[][]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Adaptive
  const [effectiveDiff, setEffectiveDiff] = useState(diff);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const recentResultsRef = useRef<boolean[]>([]);

  const generateRound = useCallback(() => {
    const size = Math.min(3 + Math.floor(effectiveDiff / 2) + Math.floor(config.total / 6), 6);
    setGridSize(size);
    const { cells: newCells } = generateGrid(size);
    setCells(newCells);
    setFeedback('none');
  }, [effectiveDiff, config.total]);

  const startGame = useCallback(() => {
    setConfig({ score: 0, correct: 0, total: 0 });
    setTimeLeft(60);
    setHasStartedTimer(false);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    recentResultsRef.current = [];
    generateRound();
    setPhase('instruction');
  }, [generateRound, diff]);

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: config.score, accuracy, difficultyLevel: effectiveDiff, metrics: {} },
      { highScore: Math.max(config.score, 0), bestAccuracy: accuracy, averageDifficulty: effectiveDiff },
    );
    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [gameId, config, diff, effectiveDiff, recordSession, soundEnabled]);

  const beginPlaying = useCallback(() => {
    setPhase('playing');
    setHasStartedTimer(false);
    setTimeLeft(60);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    recentResultsRef.current = [];
    generateRound();
  }, [generateRound, diff]);

  // Timer effect — fixed: was using useState instead of useEffect
  useEffect(() => {
    if (phase !== 'playing' || !hasStartedTimer) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { finishGame(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, hasStartedTimer, finishGame]);

  const handleCellTap = useCallback((row: number, col: number) => {
    if (feedback !== 'none') return;
    if (!hasStartedTimer) setHasStartedTimer(true);

    const isCorrect = cells[row]?.[col]?.isOddOne;
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      soundEnabled && playSound('correct');
      setConfig(prev => ({ ...prev, score: prev.score + 15, correct: prev.correct + 1, total: prev.total + 1 }));
      recentResultsRef.current = [...recentResultsRef.current, true].slice(-3);
    } else {
      soundEnabled && playSound('wrong');
      setConfig(prev => ({ ...prev, total: prev.total + 1 }));
      recentResultsRef.current = [...recentResultsRef.current, false].slice(-3);
    }

    // Adaptive difficulty
    const accuracy = recentResultsRef.current.filter(Boolean).length / recentResultsRef.current.length;
    if (recentResultsRef.current.length === 3) {
      if (!difficultyLocked && accuracy < 0.4) {
        setDifficultyLocked(true);
        setEffectiveDiff(prev => Math.max(1, prev - 1));
      } else if (accuracy >= 0.8) {
        setDifficultyLocked(false);
        setEffectiveDiff(prev => Math.min(prev + 1, diff + 2));
      }
    }

    setTimeout(() => generateRound(), 400);
  }, [cells, feedback, generateRound, hasStartedTimer, soundEnabled, difficultyLocked, diff, effectiveDiff]);

  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-xl">
            <Eye className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
            Visual Search
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Find the ONE symbol that is different from all others. The grid grows as you progress!
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>
        <Button size="lg" onClick={() => setPhase('preview')} className="w-full max-w-xs">Start (60s)</Button>
      </div>
    );
  }

  if (phase === 'preview') {
    return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={beginPlaying} />;
  }

  if (phase === 'complete') {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">🔍</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">Done!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{getEncouragement(config.correct, config.total)}</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p><p className="text-2xl font-bold">{Math.round(accuracy)}%</p></div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{config.correct} out of {config.total} found</p>
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-lg font-black px-3 py-1 rounded-full text-white ${tier === 'novice' ? 'bg-emerald-500' : tier === 'explorer' ? 'bg-blue-500' : tier === 'master' ? 'bg-violet-500' : tier === 'grandmaster' ? 'bg-amber-500' : 'bg-rose-500'}`}>{tier.toUpperCase()}</span>
            <div className="flex-1"><p className="text-xs text-slate-500 dark:text-slate-400">Mastery Score</p><div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${masteryScore}%`, background: tier === 'novice' ? '#10b981' : tier === 'explorer' ? '#3b82f6' : tier === 'master' ? '#8b5cf6' : tier === 'grandmaster' ? '#f59e0b' : '#f43f5e' }} /></div><p className="text-right text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{masteryScore}/100</p></div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Try Again</Button>
      </div>
    );
  }

  // Playing — clean grid with no overlapping text
  const cellSize = Math.min(Math.floor(260 / gridSize), 64);

  return (
    <div className="flex flex-col items-center justify-between max-w-xl mx-auto px-3 py-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      {/* Top bar */}
      <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0 mb-3">
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-lg sm:text-xl font-bold">{config.score}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Time</p><p className={`text-lg sm:text-xl font-bold ${timeLeft <= 10 && hasStartedTimer ? 'text-red-500 animate-pulse' : ''}`}>{timeLeft}s</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Found</p><p className="text-lg sm:text-xl font-bold">{config.correct}/{config.total}</p></div>
      </div>

      {/* Grid area */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div
          className="grid gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)` }}
        >
          {cells.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => handleCellTap(r, c)}
                disabled={feedback !== 'none'}
                className={`rounded-lg font-black text-base sm:text-lg flex items-center justify-center transition-all duration-150 touch-manipulation select-none ${
                  feedback === 'wrong' && cells[r][c].isOddOne
                    ? 'bg-emerald-500 text-white scale-105 shadow-lg'
                    : feedback === 'correct'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95 shadow-sm'
                }`}
                style={{ width: cellSize, height: cellSize }}
              >
                {cell.symbol}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Instruction label — separate from grid, never overlaps */}
      <p className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400 mt-3 shrink-0">
        Find the {gridSize * gridSize} symbols — tap the one that is different
      </p>
    </div>
  );
}
