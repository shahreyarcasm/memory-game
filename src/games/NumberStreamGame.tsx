import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';
import { Target } from 'lucide-react';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'countdown' | 'playing' | 'complete' | 'preview';

const TARGET_DIGIT    = 7;   // the only digit the player should tap
const MAX_LIVES       = 3;
const TOTAL_TRIALS    = 30;  // number of digit presentations per run

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(hits: number, accuracy: number): string {
  if (hits >= 25 && accuracy >= 90) return 'Incredible processing speed! Your brain is firing on all cylinders.';
  if (hits >= 20 && accuracy >= 80) return 'Sharp reflexes and great inhibition — you handle pressure like a pro.';
  if (hits >= 12) return 'Solid response time! Keep training your neural pathways.';
  if (accuracy >= 70) return 'Good instinct control — focus on tapping faster on the next run.';
  return 'Every session sharpens your speed. You\'ll beat your last record soon!';
}

export default function NumberStreamGame({ gameId, howToPlay: _howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled  = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const ti = ['novice','explorer','master','grandmaster','legend'].indexOf(tier);
  const roundTime = (params.roundTime as number) ?? Math.max(4000, 8000 - ti * 600);

  const phaseRef        = useRef<Phase>('instruction');
  const [phase,         setPhase]        = useState<Phase>('instruction');
  const [currentDigit,  setCurrentDigit] = useState<number | null>(null);
  const [score,         setScore]        = useState(0);
  const [lives,         setLives]        = useState(MAX_LIVES);
  const [trialNum,      setTrialNum]     = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);

  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundStartRef   = useRef(0);
  const finishedRef     = useRef(false);
  const totalTrialsRef  = useRef(0);
  const hitsRef         = useRef(0);
  const scoreRef        = useRef(0);
  const falseAlarmsRef  = useRef(0);
  const livesRef        = useRef(MAX_LIVES);
  const phaseTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimeLeftRef = useRef(roundTime);

  // ── helpers ────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = null;
  }, []);

  // Show next digit after a short gap
  const showNextDigit = useCallback(() => {
    if (finishedRef.current || phaseRef.current !== 'playing') return;
    stopAll();

    // Decide this trial: ~30 % chance it's a 7, rest are random 0–9 excluding 7
    const isTarget = Math.random() < 0.30;
    let digit: number;
    if (isTarget) {
      digit = TARGET_DIGIT;
    } else {
      const others = [0,1,2,3,4,5,6,8,9];
      digit = others[Math.floor(Math.random() * others.length)];
    }

    totalTrialsRef.current += 1;
    setTrialNum(totalTrialsRef.current);
    setCurrentDigit(digit);
    roundStartRef.current = Date.now();

    // Auto-advance if player didn't respond in time
    const displayMs = Math.max(800, 1400 - totalTrialsRef.current * 15); // gets shorter
    timerRef.current = window.setTimeout(() => {
      if (finishedRef.current) return;
      setCurrentDigit(null);
      if (totalTrialsRef.current >= TOTAL_TRIALS) {
        finishGame();
      } else {
        // Small pause before next
        const gap = 250 + Math.random() * 200;
        timerRef.current = window.setTimeout(showNextDigit, gap);
      }
    }, displayMs);
  }, [stopAll]);

  // ── Tap handler ────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (currentDigit == null || phaseRef.current !== 'playing' || finishedRef.current) return;

    const rt = Date.now() - roundStartRef.current;
    stopAll();

    if (currentDigit === TARGET_DIGIT) {
      // Hit
      hitsRef.current += 1;
      scoreRef.current += Math.max(10, Math.round(120 - rt / 4));
      setScore(scoreRef.current);
      setReactionTimes(prev => [...prev, rt]);
      soundEnabled && playSound('correct');
    } else {
      // False alarm
      falseAlarmsRef.current += 1;
      livesRef.current -= 1;
      setLives(livesRef.current);
      soundEnabled && playSound('wrong');
      if (livesRef.current <= 0) {
        finishedRef.current = true;
        setPhase('complete');
        finishGame();
        return;
      }
    }

    setCurrentDigit(null);
    if (totalTrialsRef.current >= TOTAL_TRIALS) {
      finishGame();
    } else {
      const gap = 250 + Math.random() * 200;
      timerRef.current = window.setTimeout(showNextDigit, gap);
    }
  }, [currentDigit, showNextDigit, soundEnabled, stopAll]);

  // Miss click (tap empty area when no digit shown)
  const handleMissClick = useCallback(() => {
    if (currentDigit != null || phaseRef.current !== 'playing' || finishedRef.current) return;
    livesRef.current -= 1;
    setLives(livesRef.current);
    falseAlarmsRef.current += 1;
    soundEnabled && playSound('wrong');
    if (livesRef.current <= 0) {
      finishedRef.current = true;
      setPhase('complete');
      finishGame();
    }
  }, [currentDigit, soundEnabled]);

  // ── Start game ─────────────────────────────────────────────────
  const startGame = useCallback(() => {
    finishedRef.current = false;
    totalTrialsRef.current = 0;
    hitsRef.current = 0;
    falseAlarmsRef.current = 0;
    scoreRef.current = 0;
    phaseTimeLeftRef.current = roundTime;
    stopAll();
    setCurrentDigit(null);
    setScore(0);
    setLives(MAX_LIVES);
    setTrialNum(0);
    setReactionTimes([]);
    setPhase('countdown');

    setTimeout(() => {
      setPhase('playing');
      phaseRef.current = 'playing';
      showNextDigit();
    }, 1200);
  }, [roundTime, showNextDigit, stopAll]);

  // ── Finish ─────────────────────────────────────────────────────
  const finishGame = useCallback(() => {
    stopAll();
    finishedRef.current = true;
    setPhase('complete');

    const avgRT = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    const totalGo = Math.round(TOTAL_TRIALS * 0.30);
    const accuracy = hitsRef.current + falseAlarmsRef.current > 0
      ? (hitsRef.current / (hitsRef.current + falseAlarmsRef.current)) * 100
      : 0;

    recordSession(
      {
        id: _uuid(),
        userId: null,
        gameId,
        score: scoreRef.current,
        accuracy,
        difficultyLevel: 1,
        metrics: { avgReaction: avgRT, hits: hitsRef.current, misses: falseAlarmsRef.current, totalAttempts: totalGo },
      },
      { highScore: Math.max(scoreRef.current, 0), bestAccuracy: accuracy, averageDifficulty: 1 },
    );
    soundEnabled && playSound('complete');
  }, [gameId, reactionTimes, recordSession, soundEnabled, stopAll]);

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Cleanup
  useEffect(() => {
    return () => stopAll();
  }, [stopAll]);

  // Scroll to top on complete/instruction
  useEffect(() => {
    if (phase === 'complete' || phase === 'instruction') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [phase]);

  // Instruction
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return (
        <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={() => setPhase('playing')} />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-xl">
            <Target className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-orange-600 dark:from-rose-400 dark:to-orange-400 bg-clip-text text-transparent">
            Number Stream
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Digits stream past one by one. Tap ONLY when you see a <span className="font-black text-rose-500">7</span>. Fast processing speed under pressure.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 w-full max-w-xs text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">How it works:</p>
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p><span className="font-black text-rose-500">7</span> appears → TAP immediately!</p>
            <p>Any other digit → DO NOT tap</p>
            <p>⚡ Faster taps earn more points</p>
            <p>❌ False alarms cost a life</p>
            <p>{TOTAL_TRIALS} digits per round · {MAX_LIVES} lives</p>
          </div>
        </div>

        <Button size="lg" onClick={startGame} className="w-full max-w-xs">
          Start Test
        </Button>
      </div>
    );
  }

  // Countdown
  if (phase === 'countdown') {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-center space-y-4 animate-fade-in">
          <p className="text-7xl font-black text-rose-500 animate-pulse">Go!</p>
          <p className="text-slate-500 dark:text-slate-400 text-lg">Tap only when you see a <span className="font-black text-rose-500">7</span>!</p>
        </div>
      </div>
    );
  }

  // Complete screen
  if (phase === 'complete') {
    const avgRT = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    const hits = hitsRef.current;
    const totalAttempts = hits + falseAlarmsRef.current;
    const accuracy = totalAttempts > 0 ? (hits / totalAttempts) * 100 : 0;
    const msg = getEncouragement(hits, accuracy);

    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-4xl sm:text-5xl mb-1">✦</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-orange-600 dark:from-rose-400 dark:to-orange-400 bg-clip-text text-transparent">
          Game Over
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{msg}</p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Avg Reaction</p>
            <p className="text-sm sm:text-2xl font-bold">{avgRT} ms</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
            <p className="text-xl sm:text-2xl font-bold">{Math.round(accuracy)}%</p>
          </div>
        </div>

        <div className="text-center space-y-1 px-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Hits: <span className="font-bold text-emerald-600 dark:text-emerald-400">{hits}</span>
            {' '}· False Alarms: <span className="font-bold text-red-500">{falseAlarmsRef.current}</span>
          </p>
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
          Try Again
        </Button>
      </div>
    );
  }

  // Playing phase
  return (
    <div className="flex flex-col" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl mx-2 sm:mx-3 mt-2 p-2 sm:p-3 border border-slate-200 dark:border-slate-700 flex justify-around items-center shrink-0">
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
          <p className="text-lg sm:text-xl font-bold">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Trial</p>
          <p className="text-lg sm:text-xl font-bold">{trialNum}<span className="text-slate-400 dark:text-slate-500 text-sm">/{TOTAL_TRIALS}</span></p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Lives</p>
          <p className="text-base sm:text-lg font-bold text-rose-500">{'❤️'.repeat(lives)}{'🖤'.repeat(MAX_LIVES - lives)}</p>
        </div>
      </div>

      {/* Target hint */}
      <div className="text-center mt-2 pb-1 shrink-0">
        <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
          Tap when you see <span className="font-black ml-0.5">{TARGET_DIGIT}</span>
        </span>
      </div>

      {/* Digit display area */}
      <div
        onClick={handleMissClick}
        className="relative flex-1 mx-2 sm:mx-3 mt-2 bg-slate-100 dark:bg-slate-900 rounded-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden cursor-pointer select-none touch-none flex items-center justify-center"
      >
        {currentDigit != null && (
          <button
            onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
            onMouseDown={handleTap}
            className="flex flex-col items-center justify-center w-full h-full active:scale-95 transition-transform touch-manipulation"
          >
            <span className={`text-8xl sm:text-9xl font-black tabular-nums select-none ${
              currentDigit === TARGET_DIGIT
                ? 'text-rose-500 drop-shadow-lg'
                : 'text-slate-700 dark:text-slate-300'
            }`}>
              {currentDigit}
            </span>
            {currentDigit === TARGET_DIGIT && (
              <span className="mt-2 text-sm font-semibold text-rose-500/70 uppercase tracking-widest">TAP!</span>
            )}
          </button>
        )}
        {currentDigit == null && (
          <span className="text-slate-300 dark:text-slate-700 text-lg font-medium">Waiting…</span>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500 px-4 pb-3 shrink-0 mt-1">
        Tap any number ≠ {TARGET_DIGIT} carefully — false alarms cost lives
      </p>
    </div>
  );
}
