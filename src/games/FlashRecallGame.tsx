import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Binary } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props { gameId: string; howToPlay?: string; }
type Phase = 'instruction' | 'showing' | 'hiding' | 'input' | 'complete' | 'preview';

const ICONS = ['🌟','⚡','🔥','💎','🎯','🌙','🍀','❄️','🦋','🌺'];

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(hits: number, total: number): string {
  const pct = total > 0 ? hits / total : 0;
  if (pct >= 0.9) return 'Photographic recall! You captured every icon like a camera — your visual memory is razor-sharp.';
  if (pct >= 0.7) return 'Strong recall! Most icons stayed locked in your mind even after they vanished.';
  if (pct >= 0.5) return 'Solid effort — your brain is learning to retain more per glance. Keep training!';
  return 'Every round builds a sharper mental snapshot. Try focusing harder on positions next time!';
}

export default function FlashRecallGame({ gameId }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled  = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message } = usePredictedDifficulty(gameId);
  const ti = ['novice','explorer','master','grandmaster','legend'].indexOf(tier);

  const phaseRef      = useRef<Phase>('instruction');
  const gridSizeRef   = useRef(3);
  const shownCellsRef = useRef<number[]>([]);
  const hiddenCellsRef= useRef<boolean[]>([]);
  const scoreRef      = useRef(0);
  const hitsRef       = useRef(0);
  const totalRef      = useRef(0);
  const livesRef      = useRef(3);
  const finishedRef   = useRef(false);
  const tapCountRef   = useRef(0);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase,      setPhase]      = useState<Phase>('instruction');
  const [score,      setScore]      = useState(0);
  const [hits,       setHits]       = useState(0);
  const [total,      setTotal]      = useState(0);
  const [lives,      setLives]      = useState(3);
  const [feedback,   setFeedback]   = useState<'none' | 'ok' | 'miss'>('none');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (phase === 'complete' || phase === 'instruction') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase]);

  const CELL_COUNTS = [9, 16, 25]; // 3×3, 4×4, 5×5

  const startRound = useCallback(() => {
    if (finishedRef.current) return;

    const sizeIdx = Math.min(Math.floor((totalRef.current) / 5), CELL_COUNTS.length - 1);
    const size = CELL_COUNTS[sizeIdx];
    const gridN = Math.sqrt(size);
    gridSizeRef.current = gridN;

    const cellCount = gridN * gridN;
    const nShow = Math.min(3 + sizeIdx + Math.floor(totalRef.current / 5), Math.floor(cellCount * 0.5));

    const indices = Array.from({ length: cellCount }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const chosen = indices.slice(0, nShow);
    shownCellsRef.current = chosen;

    const hidden = Array(cellCount).fill(false);
    chosen.forEach(i => hidden[i] = true);
    hiddenCellsRef.current = hidden;

    tapCountRef.current = 0;
    setFeedback('none');

    // Show duration scales up slightly with size but down with tier
    const showMs = Math.max(800, 1500 - nShow * 60 - ti * 50 + gridN * 100);

    timerRef.current = setTimeout(() => {
      if (finishedRef.current) return;
      shownCellsRef.current = [];
      setPhase('input');
    }, showMs);
  }, [ti]);

  const finishGame = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    finishedRef.current = true;
    setPhase('complete');
    const acc = totalRef.current > 0 ? (hitsRef.current / totalRef.current) * 100 : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: scoreRef.current, accuracy: acc, difficultyLevel: 1, metrics: {} },
      { highScore: Math.max(scoreRef.current, 0), bestAccuracy: acc, averageDifficulty: 1 },
    );
    soundEnabled && playSound('complete');
  }, [gameId, recordSession, soundEnabled]);

  const handleCellTap = useCallback((idx: number) => {
    if (phaseRef.current !== 'input' || finishedRef.current || feedback !== 'none') return;
    const hidden = hiddenCellsRef.current;
    const tapCount = tapCountRef.current + 1;
    tapCountRef.current = tapCount;

    if (hidden[idx]) {
      // Correct tap
      hitsRef.current += 1;
      scoreRef.current += 10;
      setHits(hitsRef.current);
      setScore(scoreRef.current);
      setFeedback('ok');
      soundEnabled && playSound('correct');
    } else {
      // Wrong tap
      livesRef.current -= 1;
      setLives(livesRef.current);
      setFeedback('miss');
      soundEnabled && playSound('wrong');
      if (livesRef.current <= 0) { finishedRef.current = true; setPhase('complete'); finishGame(); return; }
    }

    // After brief feedback, check if all taps done or move on
    setTimeout(() => {
      if (finishedRef.current) return;
      setFeedback('none');
      // Check completion: either all cells tapped, or we move to next round
      const remaining = hidden.filter(Boolean).length - hitsRef.current;
      if (remaining <= 0 || tapCount >= hidden.filter(Boolean).length + (hitsRef.current - tapCount)) {
        // Round complete
        totalRef.current += 1;
        setTotal(totalRef.current);
        setTimeout(startRound, 400);
        return;
      }
      setTimeout(startRound, 400);
    }, 300);
  }, [soundEnabled, startRound]);

  const startGame = useCallback(() => {
    finishedRef.current = false;
    scoreRef.current = 0; hitsRef.current = 0; totalRef.current = 0;
    livesRef.current = 3; tapCountRef.current = 0;
    setScore(0); setHits(0); setTotal(0); setLives(3);
    setPhase('showing');
    setTimeout(() => startRound(), 300);
  }, [startRound]);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  // Instruction
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={() => setPhase('showing')} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-xl">
            <Binary className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
            Flash Recall
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Icons flash briefly on a grid, then vanish. Remember where they were and tap every one!
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 w-full max-w-xs text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">How it works:</p>
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p>👁️ Icons flash on the grid</p>
            <p>💨 They vanish quickly</p>
            <p>👆 Tap every icon you saw</p>
            <p>📈 Grid grows bigger each round</p>
            <p>❌ Wrong taps cost a life</p>
            <p>❤️ {3} lives</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Start Test</Button>
      </div>
    );
  }

  // Showing phase
  if (phase === 'showing') {
    const sz = gridSizeRef.current;
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <p className="text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">Memorize the icon positions</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${sz}, minmax(0, 1fr))`, width: sz * 64 }}>
          {Array(sz * sz).fill(null).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg flex items-center justify-center text-2xl"
              style={{ background: shownCellsRef.current.includes(i) ? '#ede9fe' : '#f1f5f9', borderColor: shownCellsRef.current.includes(i) ? '#a78bfa' : '#e2e8f0', borderWidth: shownCellsRef.current.includes(i) ? 2 : 1 }}
            >
              {shownCellsRef.current.includes(i) && ICONS[i % ICONS.length]}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">Watch carefully — they will disappear!</p>
      </div>
    );
  }

  // Input phase
  if (phase === 'input') {
    const sz = gridSizeRef.current;
    const hidden = hiddenCellsRef.current;
    const correctRemaining = hidden.filter(Boolean).length - hitsRef.current;
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="flex justify-between w-full max-w-xs px-2 text-sm text-slate-500">
          <span>Score: <b className="text-violet-600">{score}</b></span>
          <span>Still needed: <b>{correctRemaining}</b></span>
          <span>{'❤️'.repeat(lives)}{'🖤'.repeat(3-lives)}</span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Where were the icons? Tap them!</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${sz}, minmax(0, 1fr))`, width: sz * 64 }}>
          {Array(sz * sz).fill(null).map((_, i) => (
            <button key={i} type="button" onClick={() => handleCellTap(i)} disabled={feedback !== 'none'}
              className="aspect-square rounded-lg flex items-center justify-center text-2xl transition-all active:scale-90 disabled:cursor-not-allowed touch-manipulation"
              style={{
                background: feedback === 'ok' && hidden[i] ? '#d1fae5' : feedback === 'miss' && !hidden[i] ? '#fee2e2' : '#f8fafc',
                border: feedback === 'ok' && hidden[i] ? '2px solid #34d399' : feedback === 'miss' && !hidden[i] ? '2px solid #f87171' : '2px solid #e2e8f0',
              }}
            >
              {hidden[i] && feedback === 'ok' && ICONS[i % ICONS.length]}
            </button>
          ))}
        </div>
        {feedback !== 'none' && (
          <p className={`text-lg font-bold ${feedback === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
            {feedback === 'ok' ? '✓ Found!' : '✗ Not there!'}
          </p>
        )}
      </div>
    );
  }

  // Complete
  if (phase === 'complete') {
    const acc = total > 0 ? (hits / total) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-4xl mb-1">🧠</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">Game Over</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 italic">{getEncouragement(hits, total)}</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Score</p><p className="text-xl font-bold text-primary-600">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Rounds</p><p className="text-xl font-bold">{total}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Accuracy</p><p className="text-xl font-bold">{Math.round(acc)}%</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Try Again</Button>
      </div>
    );
  }

  return null;
}
