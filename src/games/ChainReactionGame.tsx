import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Zap } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'preview' | 'showing' | 'input' | 'result' | 'complete';

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.9) return 'Chain Reaction master! Your sequential memory is lightning-fast and precise!';
  if (pct >= 0.7) return 'Excellent sequence recall! Each chain you complete strengthens your working memory links.';
  if (pct >= 0.5) return 'Good sequencing skills! Focus on the order — your chain memory will grow stronger.';
  return 'Sequential recall is like building neural bridges — each attempt makes them stronger!';
}

export default function ChainReactionGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const diff = (params.difficulty ?? 2) as number;

  const [phase, setPhase] = useState<Phase>('instruction');
  const [round, setRound] = useState(0);
  const [totalRounds] = useState(8 + Math.min(diff, 4));
  const [config, setConfig] = useState({ score: 0, correct: 0, total: 0 });
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Adaptive difficulty
  const [effectiveDiff, setEffectiveDiff] = useState(diff);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const accuracyStreakRef = useRef<boolean[]>([]);

  const generateSequence = useCallback(() => {
    const len = 2 + Math.floor(effectiveDiff * 0.6) + Math.floor(round * 0.4);
    const seq: number[] = [];
    while (seq.length < len) {
      const n = Math.floor(Math.random() * 9) + 1;
      seq.push(n);
    }
    return seq;
  }, [effectiveDiff, round]);

  const showNextRound = useCallback(() => {
    const seq = generateSequence();
    setSequence(seq);
    setPlayerInput([]);
    setFeedback('none');
    setPhase('showing');
  }, [generateSequence]);

  const finishGame = useCallback(() => {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: config.score, accuracy, difficultyLevel: effectiveDiff, metrics: {} },
      { highScore: Math.max(config.score, 0), bestAccuracy: accuracy, averageDifficulty: effectiveDiff },
    );
    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [gameId, config, diff, effectiveDiff, recordSession, soundEnabled]);

  const startGame = useCallback(() => {
    setConfig({ score: 0, correct: 0, total: 0 });
    setRound(0);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    accuracyStreakRef.current = [];
    showNextRound();
    setPhase('instruction');
  }, [showNextRound, diff]);

  const beginPlaying = useCallback(() => {
    setConfig({ score: 0, correct: 0, total: 0 });
    setRound(0);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    accuracyStreakRef.current = [];
    showNextRound();
  }, [showNextRound, diff]);

  // Auto-play sequence with intervals shrinking by difficulty
  useEffect(() => {
    if (phase !== 'showing') return;
    const intervalMs = Math.max(400, 900 - diff * 60);
    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i >= sequence.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPhase('input');
        return;
      }
      i++;
    }, intervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, sequence, effectiveDiff]);

  const handleNumberTap = useCallback((n: number) => {
    if (phase !== 'input' || feedback !== 'none') return;
    const nextIdx = playerInput.length;
    const expected = sequence[nextIdx];
    const updated = [...playerInput, n];
    setPlayerInput(updated);

    if (n !== expected) {
      soundEnabled && playSound('wrong');
      setFeedback('wrong');
      setConfig(prev => ({ ...prev, total: prev.total + 1 }));
      accuracyStreakRef.current = [...accuracyStreakRef.current, false].slice(-5);
      if (!difficultyLocked) {
        setDifficultyLocked(true);
        setEffectiveDiff(prev => Math.max(1, prev - 1));
      }
      setTimeout(() => {
        setRound(prev => {
          const next = prev + 1;
          if (next >= totalRounds) { finishGame(); return next; }
          showNextRound();
          return next;
        });
      }, 800);
      return;
    }

    soundEnabled && playSound('correct');

    if (updated.length === sequence.length) {
      setFeedback('correct');
      setConfig(prev => ({ ...prev, correct: prev.correct + 1, score: prev.score + 100 }));
      accuracyStreakRef.current = [...accuracyStreakRef.current, true].slice(-5);
      if (difficultyLocked) {
        const streak = accuracyStreakRef.current.filter(Boolean).length;
        if (streak >= 2) {
          setDifficultyLocked(false);
          setEffectiveDiff(prev => Math.min(prev + 1, diff + 2));
        }
      } else {
        const streak = accuracyStreakRef.current.filter(Boolean).length;
        if (streak >= 2) {
          setEffectiveDiff(prev => Math.min(prev + 1, diff + 2));
        }
      }
      setTimeout(() => {
        setRound(prev => {
          const next = prev + 1;
          if (next >= totalRounds) { finishGame(); return next; }
          showNextRound();
          return next;
        });
      }, 600);
    }
  }, [phase, feedback, playerInput, sequence, totalRounds, showNextRound, finishGame, soundEnabled, difficultyLocked, diff]);

  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-xl">
            <Zap className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-400 dark:to-red-400 bg-clip-text text-transparent">
            Chain Reaction
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Numbers flash in sequence — remember the order, then replay it exactly. Chains grow longer each round!
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

  if (phase === 'complete') {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">⚡</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-400 dark:to-red-400 bg-clip-text text-transparent">Complete!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{getEncouragement(config.correct, config.total)}</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p><p className="text-2xl font-bold">{Math.round(accuracy)}%</p></div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{config.correct} out of {config.total} rounds correct</p>
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

  if (phase === 'showing') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remember the sequence</p>
        <div className="flex gap-3 flex-wrap justify-center">
          {sequence.map((n, i) => (
            <div
              key={i}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-2xl sm:text-3xl font-black text-white shadow-lg animate-bounce"
              style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.6s', animationIterationCount: '1' }}
            >
              {n}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">Watch carefully...</p>
      </div>
    );
  }

  // Input phase
  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto p-3 sm:p-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0">
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Round</p><p className="text-lg sm:text-xl font-bold">{round + 1}/{totalRounds}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-lg sm:text-xl font-bold">{config.score}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Length</p><p className="text-lg sm:text-xl font-bold">{sequence.length}</p></div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Level</p>
          <p className="text-lg sm:text-xl font-bold">{effectiveDiff}</p>
          {difficultyLocked && <p className="text-[10px] text-amber-500 font-semibold leading-tight">🔒 Locked</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">Replay the sequence:</p>
        
        {/* Display player input */}
        <div className="flex gap-2 flex-wrap justify-center mb-4 min-h-[56px]">
          {playerInput.map((n, i) => (
            <div
              key={i}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                feedback === 'correct' ? 'bg-emerald-500 text-white' :
                feedback === 'wrong' && n !== sequence[i] ? 'bg-red-500 text-white' :
                'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {n}
            </div>
          ))}
          {Array.from({ length: sequence.length - playerInput.length }).map((_, i) => (
            <div key={`empty-${i}`} className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600" />
          ))}
        </div>

        {feedback === 'wrong' && (
          <p className="text-red-500 font-semibold text-sm mb-2">Wrong! Expected: {sequence[playerInput.length]}</p>
        )}
        {feedback === 'correct' && (
          <p className="text-emerald-500 font-semibold text-sm mb-2">✓ Correct!</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 pb-2 w-full max-w-[240px] mx-auto shrink-0">
        {Array.from({ length: 9 }).map((_, i) => (
          <button
            key={i + 1}
            onClick={() => handleNumberTap(i + 1)}
            disabled={feedback !== 'none'}
            className="py-4 rounded-xl font-black text-2xl text-white transition-transform hover:scale-105 active:scale-95 touch-manipulation shadow-lg bg-gradient-to-br from-rose-500 to-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
