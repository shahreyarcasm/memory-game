import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Shuffle } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'preview' | 'playing' | 'complete';
type Direction = 'up' | 'down' | 'left' | 'right';

const DIR_ARROWS: Record<Direction, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.9) return 'Lightning reflexes with perfect inversion! Your brain processes opposites at elite speed!';
  if (pct >= 0.7) return 'Impressive mental agility! Reversing directions on the fly takes serious cognitive flexibility.';
  if (pct >= 0.5) return 'Solid reaction control! The opposite-direction rule is tricky — you\'re getting better!';
  return 'Your inverse thinking is building new neural pathways. Every wrong answer is a lesson learned!';
}

export default function ArrowRushGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const diff = (params.difficulty ?? 2) as number;

  const [phase, setPhase] = useState<Phase>('instruction');
  const [config, setConfig] = useState({ score: 0, correct: 0, total: 0 });
  const [timeLeft, setTimeLeft] = useState(45);
  const [hasStartedTimer, setHasStartedTimer] = useState(false);
  const [currentDir, setCurrentDir] = useState<Direction>('up');
  // Adaptive
  const [effectiveDiff, setEffectiveDiff] = useState(diff);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const recentResultsRef = useRef<boolean[]>([]);
  const lastSpawnRef = useRef(Date.now());

  const spawnArrow = useCallback(() => {
    const dirs: Direction[] = ['up', 'down', 'left', 'right'];
    setCurrentDir(dirs[Math.floor(Math.random() * dirs.length)]);
    lastSpawnRef.current = Date.now();
  }, []);

  const startGame = useCallback(() => {
    setConfig({ score: 0, correct: 0, total: 0 });
    setTimeLeft(45);
    setHasStartedTimer(false);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    recentResultsRef.current = [];
    spawnArrow();
    setPhase('instruction');
  }, [spawnArrow, diff]);

  const beginPlaying = useCallback(() => {
    setPhase('playing');
    setHasStartedTimer(false);
    setTimeLeft(45);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    recentResultsRef.current = [];
    lastSpawnRef.current = Date.now();
  }, [diff]);

  const finishGame = useCallback(() => {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: config.score, accuracy, difficultyLevel: effectiveDiff, metrics: {} },
      { highScore: Math.max(config.score, 0), bestAccuracy: accuracy, averageDifficulty: effectiveDiff },
    );
    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [gameId, config, diff, effectiveDiff, recordSession, soundEnabled]);

  useEffect(() => {
    if (phase !== 'playing' || !hasStartedTimer) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { finishGame(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, hasStartedTimer, finishGame]);

  const handleTap = useCallback((dir: Direction) => {
    if (!hasStartedTimer) setHasStartedTimer(true);
    const isCorrect = OPPOSITE[dir] === currentDir;
    const reactionTime = Date.now() - lastSpawnRef.current;

    if (isCorrect) {
      soundEnabled && playSound('correct');
      const timeBonus = Math.max(0, Math.floor(500 / Math.max(reactionTime, 100)));
      setConfig(prev => ({ ...prev, score: prev.score + 10 + timeBonus, correct: prev.correct + 1, total: prev.total + 1 }));
      recentResultsRef.current = [...recentResultsRef.current, true].slice(-3);
    } else {
      soundEnabled && playSound('wrong');
      setConfig(prev => ({ ...prev, total: prev.total + 1 }));
      recentResultsRef.current = [...recentResultsRef.current, false].slice(-3);
    }

    // Adaptive difficulty — adjust spawn interval based on effectiveDiff
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

    spawnArrow();
  }, [currentDir, hasStartedTimer, spawnArrow, soundEnabled, difficultyLocked, diff]);

  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-xl">
            <Shuffle className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-400 dark:to-red-400 bg-clip-text text-transparent">
            Arrow Rush
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            An arrow flashes — tap the OPPOSITE direction! Tests your speed plus mental inversion under pressure.
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>
        <Button size="lg" onClick={() => setPhase('preview')} className="w-full max-w-xs">Start (45s)</Button>
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
        <div className="text-4xl sm:text-5xl mb-1">↔️</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-400 dark:to-red-400 bg-clip-text text-transparent">Time's Up!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{getEncouragement(config.correct, config.total)}</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p><p className="text-2xl font-bold">{Math.round(accuracy)}%</p></div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{config.correct} out of {config.total} correct</p>
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

  // Playing
  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto p-3 sm:p-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0">
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-lg sm:text-xl font-bold">{config.score}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Time</p><p className={`text-lg sm:text-xl font-bold ${timeLeft <= 10 && hasStartedTimer ? 'text-red-500 animate-pulse' : ''}`}>{timeLeft}s</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Round</p><p className="text-lg sm:text-xl font-bold">{config.total + 1}</p></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <p className="text-sm font-semibold text-rose-500 dark:text-rose-400 mb-3 uppercase tracking-wider">Tap OPPOSITE</p>
        <div className="text-7xl sm:text-8xl font-black text-slate-800 dark:text-slate-100 select-none animate-pulse">
          {DIR_ARROWS[currentDir]}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 pb-2 w-full max-w-[240px] mx-auto shrink-0">
        {[
          { dir: 'up' as Direction, label: '↑' },
          { dir: 'left' as Direction, label: '←' },
          { dir: 'right' as Direction, label: '→' },
          { dir: 'down' as Direction, label: '↓' },
        ].map(({ dir, label }) => (
          <button
            key={dir}
            onClick={() => handleTap(dir)}
            className="py-4 rounded-xl font-black text-3xl text-white transition-transform hover:scale-105 active:scale-95 touch-manipulation shadow-lg bg-gradient-to-br from-rose-500 to-red-600"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
