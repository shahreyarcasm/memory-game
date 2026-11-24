import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Puzzle } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'preview' | 'showing' | 'input' | 'result' | 'complete';
type ColorKey = string;

const COLORS: ColorKey[] = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const EMPTY_COLOR = '#ffffff';
const GRID_SIZES = [3, 4, 5];

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function generatePattern(rows: number, cols: number, numCells: number): Map<string, ColorKey> {
  const pattern = new Map<string, ColorKey>();
  const used = new Set<string>();
  while (pattern.size < numCells) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const key = `${r}-${c}`;
    if (!used.has(key)) {
      used.add(key);
      pattern.set(key, COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
  }
  return pattern;
}

function getShowDuration(diff: number): number {
  return Math.max(1200, 2800 - diff * 200);
}

function getEncouragement(rounds: number, avgAccuracy: number): string {
  if (avgAccuracy >= 90 && rounds >= 5) return 'Exceptional pattern memory! Your spatial recall is operating at an elite level.';
  if (avgAccuracy >= 70) return 'Strong visualization skills! Each round strengthens your ability to hold complex patterns.';
  if (avgAccuracy >= 50) return 'Solid practice! Pattern memory improves with repetition — trust the process!';
  return 'Your brain is learning to encode shapes and colors together. Each attempt builds the pathway!';
}

export default function PatternBuilderGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const diff = (params.difficulty ?? 2) as number;

  const [phase, setPhase] = useState<Phase>('instruction');
  const [round, setRound] = useState(0);
  const [totalRounds] = useState(6 + Math.min(diff, 4));
  const [config, setConfig] = useState({ score: 0, correctCells: 0, totalAttempted: 0, accuracies: [] as number[] });
  const [gridSize, setGridSize] = useState(3);
  // Adaptive difficulty: tracks effective difficulty during the session.
  // Drops when accuracy is poor, rises slowly when streaking high.
  const [effectiveDiff, setEffectiveDiff] = useState(diff);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const [pattern, setPattern] = useState<Map<string, ColorKey>>(new Map());
  const [userGuess, setUserGuess] = useState<Map<string, ColorKey>>(new Map());
  const [selectedColor, setSelectedColor] = useState<ColorKey>(COLORS[0]);
  const [resultMsg, setResultMsg] = useState('');
  // Live countdown seconds remaining (shown during showing phase)
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Refs to avoid closure staleness in intervals/timeouts
  const phaseRef = useRef(phase);
  const showStartRef = useRef(0);
  const pendingTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /** Generate and show a new round's pattern — uses adaptive effectiveDiff */
  const showPattern = useCallback(() => {
    // Clamp effectiveDiff so grid size stays valid
    const clampedDiff = Math.max(1, Math.min(effectiveDiff, 9));
    const sizeIdx = Math.min(Math.floor(clampedDiff / 2), GRID_SIZES.length - 1);
    const size = GRID_SIZES[sizeIdx];
    setGridSize(size);
    const numCells = 2 + Math.floor(clampedDiff * 0.8) + Math.floor(round * 0.3);
    const p = generatePattern(size, size, Math.min(numCells, size * size));
    setPattern(p);
    setUserGuess(new Map());
    // Auto-select the first color in the current pattern's palette so user always has a visible choice
    const pPalette = Array.from(new Set(Array.from(p.values())));
    setSelectedColor(pPalette.length > 0 ? pPalette[0] : COLORS[0]);
    setResultMsg('');

    // Cancel any pending transitions from previous rounds
    if (pendingTransitionRef.current) clearTimeout(pendingTransitionRef.current);
    if (clockRef.current) clearInterval(clockRef.current);

    const durationMs = getShowDuration(clampedDiff);
    showStartRef.current = Date.now();
    setPhase('showing');
    setSecondsLeft(Math.round(durationMs / 1000));

    // Live countdown tick every 200ms
    clockRef.current = setInterval(() => {
      if (phaseRef.current !== 'showing') {
        if (clockRef.current) clearInterval(clockRef.current);
        return;
      }
      const remaining = Math.max(0, Math.ceil((durationMs - (Date.now() - showStartRef.current)) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && clockRef.current) clearInterval(clockRef.current);
    }, 200);

    // Auto-transition to input when timer expires
    pendingTransitionRef.current = setTimeout(() => {
      if (clockRef.current) clearInterval(clockRef.current);
      if (phaseRef.current === 'showing') setPhase('input');
    }, durationMs);
  }, [diff, round, effectiveDiff]);

  const startGame = useCallback(() => {
    setConfig({ score: 0, correctCells: 0, totalAttempted: 0, accuracies: [] });
    setRound(0);
    showPattern();
    setPhase('instruction');
  }, [showPattern]);

  const beginPlaying = useCallback(() => {
    setConfig({ score: 0, correctCells: 0, totalAttempted: 0, accuracies: [] });
    setRound(0);
    showPattern();
  }, [showPattern]);

  const finishGame = useCallback(() => {
    if (pendingTransitionRef.current) clearTimeout(pendingTransitionRef.current);
    if (clockRef.current) clearInterval(clockRef.current);
    const accuracy = config.totalAttempted > 0 ? (config.correctCells / config.totalAttempted) * 100 : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: config.score, accuracy, difficultyLevel: effectiveDiff, metrics: {} },
      { highScore: Math.max(config.score, 0), bestAccuracy: accuracy, averageDifficulty: effectiveDiff },
    );
    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [gameId, config, diff, recordSession, soundEnabled]);

  /** Tap a cell: fill with selected color, or clear if already that exact color */
  const handleCellTap = useCallback((row: number, col: number) => {
    if (phaseRef.current !== 'input') return;
    const key = `${row}-${col}`;
    setUserGuess(prev => {
      const next = new Map(prev);
      if (next.get(key) === selectedColor) {
        next.delete(key);
      } else {
        next.set(key, selectedColor);
      }
      return next;
    });
  }, [selectedColor]);

  const handleSubmitGuess = useCallback(() => {
    if (phaseRef.current !== 'input') return;
    // Clean up any pending transitions
    if (pendingTransitionRef.current) clearTimeout(pendingTransitionRef.current);
    if (clockRef.current) clearInterval(clockRef.current);

    let correct = 0;
    const total = pattern.size;

    pattern.forEach((expectedColor, key) => {
      if (userGuess.get(key) === expectedColor) correct++;
    });

    const accPct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const scoreGain = correct * 20;

    setConfig(prev => ({
      ...prev,
      score: prev.score + scoreGain,
      correctCells: prev.correctCells + correct,
      // Count every pattern cell as attempted this round (whether guessed or missed)
      totalAttempted: prev.totalAttempted + total,
      accuracies: [...prev.accuracies, accPct],
    }));

    if (accPct >= 80) soundEnabled && playSound('correct');
    else if (accPct < 40) soundEnabled && playSound('wrong');

    setResultMsg(accPct >= 80 ? 'Excellent!' : accPct >= 50 ? 'Good try!' : 'Keep practicing!');

    // ── Adaptive difficulty adjustment ──────────────────────────────
    // If locked due to prior poor performance, only unlock after a good round
    if (difficultyLocked) {
      if (accPct >= 70) {
        // Recovering — unlock and optionally raise difficulty slightly
        setDifficultyLocked(false);
        setEffectiveDiff(prev => Math.min(prev + 1, diff + 2));
      }
      // else stay locked at current effectiveDiff
    } else {
      if (accPct < 40) {
        // Poor performance — lock and lower difficulty
        setDifficultyLocked(true);
        setEffectiveDiff(prev => Math.max(1, prev - 1));
      } else if (accPct >= 80 && round > 0) {
        // Strong streak — gradually raise (but never above initial + 2)
        setEffectiveDiff(prev => Math.min(prev + 1, diff + 2));
      }
      // 40–79%: hold steady
    }

    setPhase('result');
  }, [pattern, userGuess, soundEnabled, difficultyLocked, diff, round]);

  const nextRound = useCallback(() => {
    setRound(prev => {
      const nextR = prev + 1;
      if (nextR >= totalRounds) { finishGame(); return nextR; }
      return nextR;
    });
    showPattern();
  }, [totalRounds, finishGame, showPattern]);

  // ── Instruction ────────────────────────────────────────────────────────
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-xl">
            <Puzzle className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
            Pattern Builder
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Memorize which cells are colored and what color each one is. Then recreate the pattern using the palette below!
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>
        <Button size="lg" onClick={() => setPhase('preview')} className="w-full max-w-xs">Start</Button>
      </div>
    );
  }

  if (phase === 'preview') {
    return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={beginPlaying} />;
  }

  // ── Result screen (between rounds) ─────────────────────────────────────
  if (phase === 'result') {
    const lastAcc = config.accuracies.length > 0
      ? config.accuracies[config.accuracies.length - 1]
      : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-5xl sm:text-6xl mb-2">
          {lastAcc >= 80 ? '✨' : lastAcc >= 50 ? '👍' : '💪'}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{resultMsg}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Round {round + 1} of {totalRounds} · Accuracy: {lastAcc}%
        </p>
        <Button size="lg" onClick={nextRound} className="w-full max-w-xs">Next Round</Button>
      </div>
    );
  }

  // ── Complete screen ────────────────────────────────────────────────────
  if (phase === 'complete') {
    const avgAcc = config.accuracies.length > 0
      ? Math.round(config.accuracies.reduce((a, b) => a + b, 0) / config.accuracies.length)
      : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">🎨</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">Complete!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">
          {getEncouragement(round, avgAcc)}
        </p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Avg Accuracy</p><p className="text-2xl font-bold">{avgAcc}%</p></div>
        </div>
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

  // ── Showing or Input (shared layout) ───────────────────────────────────
  const isShowing = phase === 'showing';
  const cellSize = Math.min(Math.floor(240 / gridSize), 60);
  // Derive palette directly from pattern — guaranteed to contain every color shown
  const paletteColors = Array.from(new Set(Array.from(pattern.values())));

  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto p-3 sm:p-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      {/* Top bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0">
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Round</p><p className="text-lg sm:text-xl font-bold">{round + 1}/{totalRounds}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-lg sm:text-xl font-bold">{config.score}</p></div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cells</p>
          <p className="text-lg sm:text-xl font-bold">{pattern.size}</p>
          {difficultyLocked && (
            <p className="text-[10px] text-amber-500 font-semibold mt-0.5 leading-tight">🔒 Locked — improve to unlock</p>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Level</p>
          <p className="text-lg sm:text-xl font-bold">{Math.min(9, Math.max(1, effectiveDiff))}</p>
        </div>
      </div>

      {/* Grid area */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 gap-3">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 text-center">
          {isShowing
            ? `Memorize — ${secondsLeft}s left`
            : 'Recreate the pattern — pick a color, then tap cells'}
        </p>
        <div
          className="grid gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)` }}
        >
          {Array.from({ length: gridSize }).map((_, r) =>
            Array.from({ length: gridSize }).map((_, c) => {
              const key = `${r}-${c}`;
              const patternColor = pattern.get(key) ?? null;
              const userColor = userGuess.get(key) ?? null;
              const isEmptySlot = patternColor !== null && userColor === null;
              const isCorrectMatch = userColor !== null && patternColor !== null && userColor === patternColor;
              const isWrongFill = userColor !== null && patternColor === null;

              return (
                <button
                  key={key}
                  onClick={() => !isShowing && handleCellTap(r, c)}
                  disabled={isShowing}
                  className={`rounded-lg transition-all duration-200 border-2 touch-manipulation ${
                    isShowing && patternColor
                      ? 'border-transparent scale-95'
                      : isCorrectMatch
                      ? 'border-emerald-400 scale-95 ring-2 ring-emerald-300'
                      : isWrongFill
                      ? 'border-red-400 scale-95 ring-2 ring-red-300'
                      : isEmptySlot
                      ? 'border-dashed border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: isShowing
                      ? (patternColor ?? 'transparent')
                      : (userColor ?? (isEmptySlot ? 'rgba(0,0,0,0.03)' : '#fafafa')),
                    boxShadow: isShowing && patternColor ? `0 0 10px ${patternColor}80` : 'none',
                  }}
                />
              );
            })
          )}
        </div>

        {/* Color palette — input phase only */}
        {!isShowing && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {paletteColors.map(color => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border-2 transition-all touch-manipulation ${
                  selectedColor === color
                    ? 'border-slate-800 dark:border-slate-100 scale-110 shadow-lg'
                    : 'border-slate-200 dark:border-slate-600 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
            <button
              onClick={() => setSelectedColor(EMPTY_COLOR)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border-2 transition-all touch-manipulation flex items-center justify-center text-sm font-bold ${
                selectedColor === EMPTY_COLOR
                  ? 'border-slate-800 dark:border-slate-100 scale-110 shadow-lg'
                  : 'border-slate-200 dark:border-slate-600 hover:scale-105'
              }`}
              style={{ backgroundColor: '#fafafa' }}
              aria-label="Eraser"
            >
              <span className="text-slate-400 text-xs">✕</span>
            </button>
          </div>
        )}
      </div>

      {/* Action buttons — input phase only */}
      {!isShowing && (
        <div className="flex gap-3 pb-2">
          <Button variant="secondary" onClick={() => setUserGuess(new Map())} className="flex-1">Clear</Button>
          <Button variant="primary" onClick={handleSubmitGuess} className="flex-1">Check</Button>
        </div>
      )}
    </div>
  );
}
