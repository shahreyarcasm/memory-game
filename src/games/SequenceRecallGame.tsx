import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Binary } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props { gameId: string; howToPlay?: string; }
type Phase = 'instruction' | 'showing' | 'input' | 'complete' | 'preview';

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.85) return 'Exceptional sequence recall! Your working memory buffer is expanding rapidly.';
  if (pct >= 0.65) return 'Strong performance! Each sequence trains your mental scratchpad to hold more information.';
  if (pct >= 0.45) return 'Solid effort — every round stretches your memory capacity a little further.';
  return 'Your brain is adapting even when you miss. Keep practicing and the sequences will click!';
}

export default function SequenceRecallGame({ gameId }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message } = usePredictedDifficulty(gameId);
  const ti = ['novice','explorer','master','grandmaster','legend'].indexOf(tier);

  // Game state refs
  const phaseRef      = useRef<Phase>('instruction');
  const sequenceRef   = useRef<number[]>([]);
  const userTapRef    = useRef<number[]>([]);
  const scoreRef      = useRef(0);
  const correctRef    = useRef(0);
  const totalRef      = useRef(0);
  const livesRef      = useRef(3);
  const finishedRef   = useRef(false);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render state
  const [phase,       setPhase]        = useState<Phase>('instruction');
  const [sequence,    setSequence]     = useState<number[]>([]);
  const [userTap,     setUserTap]      = useState<number[]>([]);
  const [score,       setScore]        = useState(0);
  const [correct,     setCorrect]      = useState(0);
  const [total,       setTotal]        = useState(0);
  const [lives,       setLives]        = useState(3);
  const [level,       setLevel]        = useState(1);
  const [feedback,    setFeedback]     = useState<'none' | 'ok' | 'miss'>('none');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (phase === 'complete' || phase === 'instruction') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase]);

  // ── Expected length calculator ───────────────────────────────
  const expectedLength = useCallback((lvl: number) => {
    return Math.min(3 + lvl + Math.floor(lvl / 3), 9);
  }, []);

  // ── Finish ────────────────────────────────────────────────────
  const finishGame = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    finishedRef.current = true;
    setPhase('complete');
    const acc = totalRef.current > 0 ? (correctRef.current / totalRef.current) * 100 : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: scoreRef.current, accuracy: acc, difficultyLevel: 1, metrics: {} },
      { highScore: Math.max(scoreRef.current, 0), bestAccuracy: acc, averageDifficulty: 1 },
    );
    soundEnabled && playSound('complete');
  }, [gameId, recordSession, soundEnabled]);

  // ── Generate next sequence ────────────────────────────────────
  const genSeq = useCallback((len: number): number[] => {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 9) + 1);
  }, []);

  // ── Show sequence, then ask for input ────────────────────────
  const startRound = useCallback((seqLen: number) => {
    const seq = genSeq(seqLen);
    sequenceRef.current = seq;
    userTapRef.current = [];
    setSequence(seq);
    setUserTap([]);
    setPhase('showing');
    setFeedback('none');

    // Show duration scales down with difficulty
    const showMs = Math.max(900, 1800 - seqLen * 100 - ti * 80);
    timerRef.current = setTimeout(() => {
      if (finishedRef.current) return;
      setSequence([]);
      setPhase('input');
    }, showMs);
  }, [genSeq, ti]);

  // ── Start game ────────────────────────────────────────────────
  const startGame = useCallback(() => {
    finishedRef.current = false;
    scoreRef.current = 0;
    correctRef.current = 0;
    totalRef.current = 0;
    livesRef.current = 3;
    setScore(0); setCorrect(0); setTotal(0);
    setLives(3); setLevel(1);
    setPhase('showing');
    setTimeout(() => startRound(expectedLength(1)), 300);
  }, [startRound, expectedLength]);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  // ── Handle digit tap during input phase ───────────────────────
  const handleDigitTap = useCallback((d: number) => {
    if (phaseRef.current !== 'input' || finishedRef.current) return;
    const seq = sequenceRef.current;
    const taps = userTapRef.current;
    const nextTap = [...taps, d];
    userTapRef.current = nextTap;
    setUserTap(nextTap);

    // Check if wrong so far
    const idx = nextTap.length - 1;
    if (nextTap[idx] !== seq[idx]) {
      setFeedback('miss');
      livesRef.current -= 1;
      setLives(livesRef.current);
      soundEnabled && playSound('wrong');
      totalRef.current += 1;
      setTotal(totalRef.current);
      if (livesRef.current <= 0) { finishGame(); return; }
      setTimeout(() => { setFeedback('none'); startRound(expectedLength(level)); }, 800);
      return;
    }

    if (nextTap.length === seq.length) {
      // Sequence completed correctly
      setFeedback('ok');
      correctRef.current += 1;
      scoreRef.current += 10 * seq.length;
      setCorrect(correctRef.current);
      setScore(scoreRef.current);
      totalRef.current += 1;
      setTotal(totalRef.current);
      soundEnabled && playSound('correct');
      const newLevel = level + 1;
      setLevel(newLevel);
      setTimeout(() => { setFeedback('none'); startRound(expectedLength(newLevel)); }, 800);
    }
  }, [soundEnabled, level, expectedLength, startRound, finishGame]);

  // Instruction
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={() => setPhase('showing')} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-xl">
            <Binary className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-sky-600 dark:from-indigo-400 dark:to-sky-400 bg-clip-text text-transparent">
            Sequence Recall
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Watch the digits flash, then tap them back in the EXACT same order. Sequences grow longer each round.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 w-full max-w-xs text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">How it works:</p>
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p>👁️ Digits flash briefly</p>
            <p>🔢 Replay them in the SAME order</p>
            <p>📈 Length grows every few rounds</p>
            <p>❌ Wrong order = lose a life</p>
            <p>❤️ {3} lives — don't run out!</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Start Test</Button>
      </div>
    );
  }

  // Complete
  if (phase === 'complete') {
    const acc = total > 0 ? (correct / total) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-4xl mb-1">🧠</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-sky-600 dark:from-indigo-400 dark:to-sky-400 bg-clip-text text-transparent">Game Over</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 italic">{getEncouragement(correct, total)}</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Score</p><p className="text-xl font-bold text-primary-600">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Correct</p><p className="text-xl font-bold">{correct}/{total}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Accuracy</p><p className="text-xl font-bold">{Math.round(acc)}%</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Try Again</Button>
      </div>
    );
  }

  // Showing phase
  if (phase === 'showing') {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <p className="text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">Memorize this sequence</p>
        <div className="flex gap-2 sm:gap-3">
          {sequence.map((d, i) => (
            <span key={i} className="text-4xl sm:text-6xl font-black text-indigo-600 dark:text-indigo-400 animate-pulse">{d}</span>
          ))}
        </div>
        <p className="text-xs text-slate-400">Length: {sequence.length} · Level {level}</p>
      </div>
    );
  }

  // Input phase
  return (
    <div className="flex flex-col items-center justify-center gap-5" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
      <div className="flex justify-between w-full max-w-sm px-2 text-sm text-slate-500">
        <span>Score: <b className="text-primary-600">{score}</b></span>
        <span>Round {level} · Lives: {'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</span>
      </div>

      {/* Feedback */}
      {feedback !== 'none' && (
        <p className={`text-lg font-bold ${feedback === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
          {feedback === 'ok' ? '✓ Correct!' : '✗ Wrong order!'}
        </p>
      )}

      {/* User's taps so far */}
      <div className="flex gap-2 min-h-[3rem]">
        {userTap.map((d, i) => (
          <span key={i} className={`text-2xl sm:text-3xl font-bold w-10 h-10 rounded-full flex items-center justify-center ${
            feedback === 'none'
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
              : feedback === 'ok'
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
              : 'bg-red-100 dark:bg-red-900/40 text-red-500'
          }`}>{d}</span>
        ))}
        {userTap.length === 0 && (
          <span className="text-slate-400 text-sm self-center">Tap the digits in order…</span>
        )}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[1,2,3,4,5,6,7,8,9].map(d => (
          <button
            key={d}
            onClick={() => handleDigitTap(d)}
            disabled={feedback !== 'none'}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl text-xl sm:text-2xl font-bold bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 active:scale-95 transition-transform disabled:opacity-50 touch-manipulation"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
