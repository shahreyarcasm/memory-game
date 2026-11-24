import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Clock } from 'lucide-react';
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

interface TargetTime {
  hour: number;
  minute: number;
}

function randomTime(difficulty: number): TargetTime {
  const minuteStep = difficulty <= 2 ? 5 : difficulty <= 4 ? 3 : 1;
  return {
    hour: Math.floor(Math.random() * 12),
    minute: Math.floor(Math.random() * (60 / minuteStep)) * minuteStep,
  };
}

function getEncouragement(avgErrorMin: number, rounds: number): string {
  if (avgErrorMin < 3 && rounds >= 5) return 'Perfect clock face sense! Your internal time representation is incredibly precise!';
  if (avgErrorMin < 10) return 'Sharp temporal precision! You can read analog time like a pro — keep it up!';
  if (avgErrorMin < 20) return 'Solid progress! Analog clock estimation improves with practice. Focus on the angles!';
  return 'Each attempt calibrates your spatial-temporal mapping. Gradually refine your inner clock!';
}

export default function ClockFaceGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const diff = (params.difficulty ?? 2) as number;

  const [phase, setPhase] = useState<Phase>('instruction');
  const [round, setRound] = useState(0);
  const [totalRounds] = useState(8 + Math.min(diff, 4));
  const [config, setConfig] = useState({ score: 0, errors: [] as number[], totalCorrect: 0 });
  const [targetTime, setTargetTime] = useState<TargetTime>({ hour: 3, minute: 0 });
  const [playerAngle, setPlayerAngle] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  // Adaptive difficulty
  const [effectiveDiff, setEffectiveDiff] = useState(diff);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const correctStreakRef = useRef(0);

  const showNextTime = useCallback(() => {
    const t = randomTime(effectiveDiff);
    setTargetTime(t);
    setPlayerAngle(null);
    setResultMsg('');
    setPhase('showing');
  }, [effectiveDiff]);

  const startGame = useCallback(() => {
    setConfig({ score: 0, errors: [], totalCorrect: 0 });
    setRound(0);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    correctStreakRef.current = 0;
    showNextTime();
    setPhase('instruction');
  }, [showNextTime, diff]);

  const beginPlaying = useCallback(() => {
    setConfig({ score: 0, errors: [], totalCorrect: 0 });
    setRound(0);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    correctStreakRef.current = 0;
    showNextTime();
  }, [showNextTime, diff]);

  const finishGame = useCallback(() => {
    const avgError = config.errors.length > 0
      ? config.errors.reduce((a, b) => a + b, 0) / config.errors.length
      : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: config.score, accuracy: Math.max(0, 100 - avgError * 3), difficultyLevel: effectiveDiff, metrics: {} },
      { highScore: Math.max(config.score, 0), bestAccuracy: Math.max(0, 100 - avgError * 3), averageDifficulty: effectiveDiff },
    );
    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [gameId, config, diff, effectiveDiff, recordSession, soundEnabled]);

  // Auto transition from showing to input
  useEffect(() => {
    if (phase !== 'showing') return;
    const showDuration = Math.max(1000, 2500 - diff * 200);
    const timer = setTimeout(() => setPhase('input'), showDuration);
    return () => clearTimeout(timer);
  }, [phase, diff, effectiveDiff]);

  const handleClockTap = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (phase !== 'input' || playerAngle !== null) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const angle = Math.atan2(dx, -dy);
    setPlayerAngle(((angle * 180 / Math.PI) + 360) % 360);
  }, [phase, playerAngle]);

  const handleSubmit = useCallback(() => {
    if (playerAngle === null) return;
    
    const targetDeg = (targetTime.hour % 12) * 30 + targetTime.minute * 0.5;
    const absError = Math.abs(playerAngle - targetDeg);
    const errorMinutes = Math.round(absError / 6);
    const correctedError = Math.min(errorMinutes, 60 - errorMinutes);
    
    setConfig(prev => ({
      ...prev,
      errors: [...prev.errors, correctedError],
      score: prev.score + Math.max(0, 100 - correctedError * 2),
    }));

    if (correctedError <= 5) {
      soundEnabled && playSound('correct');
      setResultMsg('Spot on!');
      correctStreakRef.current += 1;
      if (correctStreakRef.current >= 2) {
        setDifficultyLocked(false);
        setEffectiveDiff(prev => Math.min(prev + 1, diff + 2));
      }
    } else if (correctedError <= 15) {
      setResultMsg('Close enough!');
      correctStreakRef.current = 0;
    } else {
      soundEnabled && playSound('wrong');
      setResultMsg('Off mark — keep trying!');
      setDifficultyLocked(true);
      setEffectiveDiff(prev => Math.max(1, prev - 1));
      correctStreakRef.current = 0;
    }

    setPhase('result');
  }, [playerAngle, targetTime, soundEnabled, diff, difficultyLocked]);

  const nextRound = useCallback(() => {
    setRound(prev => {
      const next = prev + 1;
      if (next >= totalRounds) { finishGame(); return next; }
      showNextTime();
      return next;
    });
    setPhase('input');
  }, [totalRounds, showNextTime, finishGame]);

  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-xl">
            <Clock className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 dark:from-rose-400 dark:to-pink-400 bg-clip-text text-transparent">
            Clock Face
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            An analog clock shows a time briefly, then vanishes. Tap where the hand should point!
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

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-5xl sm:text-6xl mb-2">{resultMsg.includes('Spot on') ? '⏰' : resultMsg.includes('Close') ? '👌' : '🔄'}</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{resultMsg}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Round {round + 1} of {totalRounds}</p>
        <Button size="lg" onClick={nextRound} className="w-full max-w-xs">Next Round</Button>
      </div>
    );
  }

  if (phase === 'complete') {
    const avgError = config.errors.length > 0
      ? config.errors.reduce((a, b) => a + b, 0) / config.errors.length
      : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">🕐</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 dark:from-rose-400 dark:to-pink-400 bg-clip-text text-transparent">Done!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{getEncouragement(avgError, round)}</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Avg Error</p><p className="text-2xl font-bold">{Math.round(avgError)}min</p></div>
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

  // Showing phase
  if (phase === 'showing') {
    const targetRad = ((targetTime.hour % 12) * 30 + targetTime.minute * 0.5) * Math.PI / 180;
    const handLen = 60;
    const hx = 75 + handLen * Math.sin(targetRad);
    const hy = 75 - handLen * Math.cos(targetRad);
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">Memorize the time</p>
          <p className="text-3xl font-black text-slate-800 dark:text-slate-100">
            {targetTime.hour === 0 ? 12 : targetTime.hour}:{String(targetTime.minute).padStart(2, '0')}
          </p>
        </div>
        <svg width="150" height="150" viewBox="0 0 150 150" className="drop-shadow-lg">
          <circle cx="75" cy="75" r="70" fill="white" stroke="#e2e8f0" strokeWidth="3" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
            const angle = (i * 30) * Math.PI / 180;
            const x1 = 75 + 58 * Math.sin(angle);
            const y1 = 75 - 58 * Math.cos(angle);
            const x2 = 75 + 65 * Math.sin(angle);
            const y2 = 75 - 65 * Math.cos(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={i % 3 === 0 ? 3 : 1.5} strokeLinecap="round" />;
          })}
          <line x1="75" y1="75" x2={hx} y2={hy} stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" />
          <circle cx="75" cy="75" r="4" fill="#f43f5e" />
        </svg>
        <p className="text-xs text-slate-400 dark:text-slate-500">Watch carefully...</p>
      </div>
    );
  }

  // Input phase
  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto p-3 sm:p-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0">
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Round</p><p className="text-lg sm:text-xl font-bold">{round + 1}/{totalRounds}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-lg sm:text-xl font-bold">{config.score}</p></div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Level</p>
          <p className="text-lg sm:text-xl font-bold">{effectiveDiff}</p>
          {difficultyLocked && <p className="text-[10px] text-amber-500 font-semibold leading-tight">🔒 Locked</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">Where does the minute hand point?</p>
        <svg ref={svgRef} width="200" height="200" viewBox="0 0 150 150" className="cursor-pointer drop-shadow-lg" onClick={handleClockTap}>
          <circle cx="75" cy="75" r="70" fill="white" stroke="#e2e8f0" strokeWidth="3" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
            const angle = (i * 30) * Math.PI / 180;
            const x1 = 75 + 58 * Math.sin(angle);
            const y1 = 75 - 58 * Math.cos(angle);
            const x2 = 75 + 65 * Math.sin(angle);
            const y2 = 75 - 65 * Math.cos(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={i % 3 === 0 ? 3 : 1.5} strokeLinecap="round" />;
          })}
          {playerAngle !== null && (() => {
            const rad = playerAngle * Math.PI / 180;
            const hx = 75 + 60 * Math.sin(rad);
            const hy = 75 - 60 * Math.cos(rad);
            return <line x1="75" y1="75" x2={hx} y2={hy} stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" />;
          })()}
          <circle cx="75" cy="75" r="4" fill="#f43f5e" />
        </svg>
        {playerAngle !== null && (
          <p className="text-xs text-slate-400 mt-2">Tap again to adjust, then submit</p>
        )}
      </div>

      <div className="flex gap-3 pb-2">
        {playerAngle !== null && (
          <Button variant="secondary" onClick={() => setPlayerAngle(null)} className="flex-1">Reset</Button>
        )}
        <Button variant="primary" onClick={handleSubmit} disabled={playerAngle === null} className="flex-1">
          {playerAngle === null ? 'Tap the clock' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
