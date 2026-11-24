import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Eye } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props { gameId: string; howToPlay?: string; }
type Phase = 'instruction' | 'countdown' | 'playing' | 'complete' | 'preview';
type Dir = 'up' | 'down' | 'left' | 'right';

const ARROWS: Record<Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' };
const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.85) return 'Fierce focus! You ignored every distraction and hit the target every time.';
  if (pct >= 0.65) return 'Great selective attention! Most trials were spot-on — keep filtering out the noise.';
  if (pct >= 0.45) return 'Solid effort! The distractors are tricky — practice helps your brain tune them out.';
  return 'Every miss is data for your brain. Focus stays sharpens with repetition!';
}

export default function FlankerAttackGame({ gameId }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message } = usePredictedDifficulty(gameId);
  const ti = ['novice','explorer','master','grandmaster','legend'].indexOf(tier);

  const phaseRef        = useRef<Phase>('instruction');
  const centerRef       = useRef<Dir>('up');
  const scoreRef        = useRef(0);
  const correctRef      = useRef(0);
  const totalRef        = useRef(0);
  const livesRef        = useRef(3);
  const finishedRef     = useRef(false);
  const rtRef           = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase,          setPhase]           = useState<Phase>('instruction');
  const [center,         setCenter]          = useState<Dir>('up');
  const [flankers,       setFlankers]        = useState<Record<string, Dir>>({});
  const [score,          setScore]           = useState(0);
  const [correct,        setCorrect]         = useState(0);
  const [total,          setTotal]           = useState(0);
  const [lives,          setLives]           = useState(3);
  const [feedback,       setFeedback]        = useState<'none' | 'ok' | 'miss'>('none');
  const [trialNum,       setTrialNum]        = useState(0);
  const [reactionTime,   setReactionTime]    = useState<number | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (phase === 'complete' || phase === 'instruction') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase]);

  // ── Finish ────────────────────────────────────────────────────
  const finishGame = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    finishedRef.current = true;
    setPhase('complete');
    const acc = totalRef.current > 0 ? (correctRef.current / totalRef.current) * 100 : 0;
    const avgRt = reactionTimesRef.current.length > 0
      ? Math.round(reactionTimesRef.current.reduce((a, b) => a + b, 0) / reactionTimesRef.current.length)
      : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: scoreRef.current, accuracy: acc, difficultyLevel: 1, metrics: { avgReaction: avgRt } },
      { highScore: Math.max(scoreRef.current, 0), bestAccuracy: acc, averageDifficulty: 1 },
    );
    soundEnabled && playSound('complete');
  }, [gameId, recordSession, soundEnabled]);

  // ── Spawn a trial ────────────────────────────────────────────
  const spawnTrial = useCallback(() => {
    if (finishedRef.current || phaseRef.current !== 'playing') return;

    const ctr = DIRS[Math.floor(Math.random() * 4)];
    centerRef.current = ctr;
    rtRef.current = Date.now();

    // Generate flankers — more deceptive at higher tiers
    const newFlankers: Record<string, Dir> = {};
    for (let i = 0; i < 8; i++) {
      // ~30% chance of a misleading flanker (points opposite or perpendicular)
      const isMisleading = Math.random() < 0.30;
      newFlankers[String(i)] = isMisleading
        ? DIRS[(DIRS.indexOf(ctr) + 1 + Math.floor(Math.random() * 3)) % 4]
        : ctr;
    }
    // Replace some non-misleading ones to make the center stand out visually
    setFlankers(newFlankers);
    setCenter(ctr);
    setTrialNum(n => n + 1);
    setFeedback('none');
    setReactionTime(null);

    // Timeout: if player doesn't respond within limit
    const maxMs = Math.max(1200, 2500 - ti * 200);
    timerRef.current = setTimeout(() => {
      if (finishedRef.current) return;
      totalRef.current += 1;
      setTotal(totalRef.current);
      livesRef.current -= 1;
      setLives(livesRef.current);
      setFeedback('miss');
      soundEnabled && playSound('wrong');
      if (livesRef.current <= 0) { finishedRef.current = true; setPhase('complete'); finishGame(); return; }
      setTimeout(spawnTrial, 500);
    }, maxMs);
  }, [ti, soundEnabled]);

  // ── Handle button tap ────────────────────────────────────────
  const handleDirTap = useCallback((d: Dir) => {
    if (phaseRef.current !== 'playing' || finishedRef.current || feedback !== 'none') return;
    if (timerRef.current) clearTimeout(timerRef.current);

    const rt = Date.now() - rtRef.current;
    reactionTimesRef.current = [...reactionTimesRef.current, rt];

    totalRef.current += 1;
    setTotal(totalRef.current);

    if (d === centerRef.current) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
      scoreRef.current += Math.max(5, 50 - Math.floor(rt / 20));
      setScore(scoreRef.current);
      setFeedback('ok');
      setReactionTime(rt);
      soundEnabled && playSound('correct');
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);
      setFeedback('miss');
      setReactionTime(rt);
      soundEnabled && playSound('wrong');
      if (livesRef.current <= 0) { finishedRef.current = true; setPhase('complete'); finishGame(); return; }
    }
    setTimeout(spawnTrial, 450);
  }, [soundEnabled, spawnTrial]);

  const startGame = useCallback(() => {
    finishedRef.current = false;
    scoreRef.current = 0; correctRef.current = 0; totalRef.current = 0;
    livesRef.current = 3; reactionTimesRef.current = [];
    setScore(0); setCorrect(0); setTotal(0); setLives(3);
    setTrialNum(0); setFeedback('none'); setReactionTime(null);
    setPhase('countdown');
    setTimeout(() => { setPhase('playing'); phaseRef.current = 'playing'; spawnTrial(); }, 1000);
  }, [spawnTrial]);

  // Instruction
  if (phase === 'instruction') {
    if (masteryScore > 0) return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={() => setPhase('playing')} />;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-xl">
            <Eye className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">Flanker Attack</h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Arrows surround a center arrow. Tap ONLY the direction of the <b>center</b> arrow — ignore the decoys!
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 w-full max-w-xs text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">How it works:</p>
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p>🎯 Tap the CENTER arrow's direction</p>
            <p>🚫 Decoy arrows point elsewhere — ignore them!</p>
            <p>⏱️ Respond before time runs out</p>
            <p>❌ Wrong answer costs a life</p>
            <p>❤️ {3} lives — stay focused!</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Start Test</Button>
      </div>
    );
  }

  // Countdown
  if (phase === 'countdown') {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-center space-y-4 animate-fade-in">
          <p className="text-7xl font-black text-amber-500 animate-pulse">Go!</p>
          <p className="text-slate-500 text-lg">Focus on the center arrow!</p>
        </div>
      </div>
    );
  }

  // Complete
  if (phase === 'complete') {
    const acc = total > 0 ? (correct / total) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-4xl mb-1">🎯</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">Game Over</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 italic">{getEncouragement(correct, total)}</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Score</p><p className="text-xl font-bold text-primary-600">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Accuracy</p><p className="text-xl font-bold">{Math.round(acc)}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Trials</p><p className="text-xl font-bold">{total}</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Try Again</Button>
      </div>
    );
  }

  // Playing
  return (
    <div className="flex flex-col" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl mx-2 sm:mx-3 mt-2 p-2 sm:p-3 border border-slate-200 dark:border-slate-700 flex justify-around items-center shrink-0">
        <div className="text-center"><p className="text-xs text-slate-500">Score</p><p className="text-lg font-bold">{score}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500">Trial</p><p className="text-lg font-bold">{trialNum}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500">Lives</p><p className="text-base font-bold text-rose-500">{'❤️'.repeat(lives)}{'🖤'.repeat(3-lives)}</p></div>
      </div>

      {/* Arrow display */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="relative w-48 h-48 sm:w-56 sm:h-56">
          {/* Center arrow — bigger, highlighted */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl sm:text-8xl font-black text-indigo-600 dark:text-indigo-400 drop-shadow-lg select-none">
              {ARROWS[center]}
            </span>
          </div>
          {/* Flankers around edges */}
          {Object.entries(flankers).map(([k, d]) => {
            const pos: Record<string, React.CSSProperties> = {
              '0': { top: 4,   left: '50%', transform: 'translateX(-50%)' },
              '1': { bottom: 4, left: '50%', transform: 'translateX(-50%)' },
              '2': { left: 4,  top: '50%',  transform: 'translateY(-50%)' },
              '3': { right: 4, top: '50%',  transform: 'translateY(-50%)' },
              '4': { top: 8,   left: 8,    },
              '5': { top: 8,   right: 8,   },
              '6': { bottom: 8,left: 8,    },
              '7': { bottom: 8,right: 8,   },
            };
            return (
              <span key={k} className="absolute text-2xl text-slate-400 dark:text-slate-500 select-none" style={pos[k] ?? {}}>
                {ARROWS[d]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Direction buttons */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 px-4 pb-4 shrink-0">
        <div />
        <button onClick={() => handleDirTap('up')} className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-2xl font-bold border border-slate-300 dark:border-slate-600 active:scale-95 transition-transform touch-manipulation">↑</button>
        <div />
        <button onClick={() => handleDirTap('left')} className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-2xl font-bold border border-slate-300 dark:border-slate-600 active:scale-95 transition-transform touch-manipulation">←</button>
        {feedback !== 'none' && (
          <span className={`text-lg font-bold self-center ${feedback === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
            {feedback === 'ok' ? '✓' : '✗'}{reactionTime != null ? ` ${reactionTime}ms` : ''}
          </span>
        )}
        <button onClick={() => handleDirTap('right')} className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-2xl font-bold border border-slate-300 dark:border-slate-600 active:scale-95 transition-transform touch-manipulation">→</button>
        <div />
        <button onClick={() => handleDirTap('down')} className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-2xl font-bold border border-slate-300 dark:border-slate-600 active:scale-95 transition-transform touch-manipulation">↓</button>
        <div />
      </div>

      <p className="text-center text-xs text-slate-400 px-4 pb-2 shrink-0">Tap the direction of the CENTER arrow only!</p>
    </div>
  );
}
