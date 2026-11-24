import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Layers } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props { gameId: string; howToPlay?: string; }
type Phase = 'instruction' | 'showing' | 'rotated' | 'input' | 'complete' | 'preview';

// Rotation mappings: which cell index maps where
const GRID_SIZES = [3, 4, 5]; // increasing grid sizes with tier
const ROT_KEYS = ['cw-90', 'cw-180', 'ccw-90'] as const;

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(hits: number, total: number): string {
  const pct = total > 0 ? hits / total : 0;
  if (pct >= 0.85) return 'Outstanding spatial reasoning! Your mental rotation skills are razor-sharp.';
  if (pct >= 0.65) return 'Impressive transformations! You\'re navigating rotations with growing confidence.';
  if (pct >= 0.45) return 'Good progress! Mental rotation improves with every attempt — trust the process.';
  return 'Each try rewires your spatial processor. Tomorrow will feel more natural!';
}

export default function GridShuffleGame({ gameId }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message } = usePredictedDifficulty(gameId);
  const ti = ['novice','explorer','master','grandmaster','legend'].indexOf(tier);

  const phaseRef      = useRef<Phase>('instruction');
  const gridSizeRef   = useRef(3);
  const patternRef    = useRef<boolean[]>([]);
  const rotatedRef    = useRef<boolean[]>([]);
  const rotTypeRef    = useRef<string>('');
  const scoreRef      = useRef(0);
  const hitsRef       = useRef(0);
  const totalRef      = useRef(0);
  const livesRef      = useRef(3);
  const finishedRef   = useRef(false);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase,      setPhase]      = useState<Phase>('instruction');
  const [rotLabel,   setRotLabel]   = useState('');
  const [score,      setScore]      = useState(0);
  const [hits,       setHits]       = useState(0);
  const [total,      setTotal]      = useState(0);
  const [lives,      setLives]      = useState(3);
  const [nTaps,      setNTaps]      = useState(0);
  const [feedback,   setFeedback]   = useState<'none' | 'ok' | 'miss'>('none');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (phase === 'complete' || phase === 'instruction') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase]);

  // ── Finish ────────────────────────────────────────────────────
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

  // Generate a random pattern
  const genPattern = useCallback((size: number): boolean[] => {
    const cells = size * size;
    // Number of filled cells scales with size
    const fillCount = Math.max(3, Math.round(cells * 0.35) + Math.floor(Math.random() * 3));
    const arr = Array(cells).fill(false);
    while (arr.filter(Boolean).length < fillCount) {
      arr[Math.floor(Math.random() * cells)] = true;
    }
    return arr;
  }, []);

  // Apply rotation mapping to pattern
  const applyRotation = useCallback((pat: boolean[], rotKey: string, size: number): boolean[] => {
    // Build on-the-fly for this size
    const cells = size * size;
    const map = Array.from({ length: cells }, (_, i) => {
      const row = Math.floor(i / size);
      const col = i % size;
      if (rotKey === 'cw-90') return row * size + (size - 1 - col);
      if (rotKey === 'cw-180') return (size - 1 - row) * size + (size - 1 - col);
      if (rotKey === 'ccw-90') return (size - 1 - col) * size + row;
      return i;
    });
    return map.map(i => pat[i]);
  }, []);

  // Start a round
  const startRound = useCallback(() => {
    if (finishedRef.current) return;

    // Grid size escalates with tier
    const size = GRID_SIZES[Math.min(ti, GRID_SIZES.length - 1)];
    gridSizeRef.current = size;

    const pat = genPattern(size);
    patternRef.current = pat;

    const rotKey = ROT_KEYS[Math.floor(Math.random() * ROT_KEYS.length)];
    rotTypeRef.current = rotKey;
    const rot = applyRotation(pat, rotKey, size);
    rotatedRef.current = rot;

    const labelMap: Record<string, string> = { 'cw-90': '↻ 90° CW', 'cw-180': '↺ 180°', 'ccw-90': '↺ 90° CCW' };
    setRotLabel(labelMap[rotKey] ?? rotKey);

    setNTaps(0);
    setFeedback('none');
    setPhase('rotated');
    setTimeout(() => {
        setPhase('input');
    }, 1500);
  }, [ti, genPattern, applyRotation]);

  // Handle cell tap
  const handleCellTap = useCallback((idx: number) => {
    if (phaseRef.current !== 'input' || finishedRef.current || feedback !== 'none') return;

    const n = nTaps + 1;
    setNTaps(n);

    // Check if this tap matches the rotated pattern
    const isHit = rotatedRef.current[idx];
    if (!isHit) {
      // Tapped a wrong cell (empty one)
      livesRef.current -= 1;
      setLives(livesRef.current);
      setFeedback('miss');
      soundEnabled && playSound('wrong');
      if (livesRef.current <= 0) { finishedRef.current = true; setPhase('complete'); finishGame(); return; }
      setTimeout(startRound, 500);
      return;
    }

    if (n >= patternRef.current.filter(Boolean).length) {
      // All correct cells tapped
      hitsRef.current += 1;
      totalRef.current += 1;
      scoreRef.current += Math.max(5, 30 - n * 2);
      setHits(hitsRef.current);
      setTotal(totalRef.current);
      setScore(scoreRef.current);
      setFeedback('ok');
      soundEnabled && playSound('correct');
      setTimeout(startRound, 500);
    }
  }, [nTaps, soundEnabled, startRound]);

  const startGame = useCallback(() => {
    finishedRef.current = false;
    scoreRef.current = 0; hitsRef.current = 0; totalRef.current = 0;
    livesRef.current = 3;
    setScore(0); setHits(0); setTotal(0); setLives(3);
    setPhase('showing');
    setTimeout(() => startRound(), 400);
  }, [startRound]);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  // Instruction
  if (phase === 'instruction') {
    if (masteryScore > 0) return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={() => setPhase('instruction')} />;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl">
            <Layers className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Grid Shuffle</h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            A pattern appears on a grid, then the grid rotates. Tap every lit cell in its NEW position after rotation!
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 w-full max-w-xs text-center space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">How it works:</p>
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p>👁️ Study the original pattern</p>
            <p>🔄 The grid rotates — find the new positions</p>
            <p>👆 Tap every formerly-lit cell once</p>
            <p>❌ Extra taps cost a life</p>
            <p>❤️ {3} lives</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Start Test</Button>
      </div>
    );
  }

  // Showing (memorize) phase
  if (phase === 'showing') {
    const sz = gridSizeRef.current;
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <p className="text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">Memorize this pattern</p>
        <GridDisplay size={sz} pattern={patternRef.current} rotating={false} />
        <p className="text-xs text-slate-400">Watch carefully — it will rotate!</p>
      </div>
    );
  }

  // Rotated preview phase (brief)
  if (phase === 'rotated') {
    const sz = gridSizeRef.current;
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <p className="text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
          Rotated {rotTypeRef.current.replace('-', '·')} — remember the layout!
        </p>
        <GridDisplay size={sz} pattern={rotatedRef.current} rotating={true} />
        <p className="text-xs text-slate-400 animate-pulse">Tap the cells that ARE now filled!</p>
      </div>
    );
  }

  // Input phase (same as rotated visually — player taps)
  if (phase === 'input') {
    const sz = gridSizeRef.current;
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: `${Math.max(window.innerHeight - 56, 400)}px` }}>
        <div className="flex justify-between w-full max-w-sm px-2 text-sm text-slate-500">
          <span>Score: <b className="text-emerald-600">{score}</b></span>
          <span>Tap: {nTaps}/{patternRef.current.filter(Boolean).length}</span>
          <span>{'❤️'.repeat(lives)}{'🖤'.repeat(3-lives)}</span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Tap the cells that are NOW lit (after {rotLabel} rotation)</p>
        <GridCellGrid
          size={sz}
          pattern={rotatedRef.current}
          onTap={handleCellTap}
          feedback={feedback}
        />
        {feedback !== 'none' && (
          <p className={`text-lg font-bold ${feedback === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
            {feedback === 'ok' ? '✓ Correct!' : '✗ Wrong tap!'}
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
        <div className="text-4xl mb-1">🔄</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">Game Over</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 italic">{getEncouragement(hits, total)}</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Score</p><p className="text-xl font-bold text-primary-600">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Accuracy</p><p className="text-xl font-bold">{Math.round(acc)}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Completed</p><p className="text-xl font-bold">{hits}/{total}</p>
          </div>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Try Again</Button>
      </div>
    );
  }

  return null;
}

// ── Sub-components ─────────────────────────────────────────────

function GridDisplay({ size, pattern, rotating }: { size: number; pattern: boolean[]; rotating: boolean }) {
  const sz = size * 60;
  return (
    <div
      className={`transition-transform duration-500 ${rotating ? 'animate-spin' : ''}`}
      style={{ width: sz, height: sz }}
    >
      <svg width={sz} height={sz} className="drop-shadow-md">
        {pattern.map((on, i) => {
          const col = i % size;
          const row = Math.floor(i / size);
          const cellW = sz / size;
          const cellH = sz / size;
          const pad = 4;
          return (
            <rect
              key={i}
              x={col * cellW + pad}
              y={row * cellH + pad}
              width={cellW - pad * 2}
              height={cellH - pad * 2}
              rx={4}
              fill={on ? '#10b981' : '#e2e8f0'}
              stroke={on ? '#059669' : '#cbd5e1'}
              strokeWidth={on ? 2 : 1}
            />
          );
        })}
      </svg>
    </div>
  );
}

function GridCellGrid({ size, pattern, onTap, feedback }: {
  size: number; pattern: boolean[]; onTap: (i: number) => void; feedback: string;
}) {
  const sz = size * 72;
  return (
    <div className="flex justify-center">
      <svg width={sz} height={sz} className="drop-shadow-md cursor-pointer select-none">
        {pattern.map((on, i) => {
          const col = i % size;
          const row = Math.floor(i / size);
          const cellW = sz / size;
          const cellH = sz / size;
          const pad = 3;
          const baseFill = on ? '#3b82f6' : '#e2e8f0';
          const fill = feedback === 'miss' && !on ? '#fca5a5' :
                       feedback === 'ok' && on ? '#34d399' : baseFill;
          return (
            <g key={i} onClick={() => onTap(i)} style={{ cursor: 'pointer' }}>
              <rect
                x={col * cellW + pad} y={row * cellH + pad}
                width={cellW - pad * 2} height={cellH - pad * 2}
                rx={4} fill={fill}
                stroke={on ? '#2563eb' : '#cbd5e1'} strokeWidth={on ? 2 : 1}
              />
              {on && <text x={col * cellW + cellW/2} y={row * cellH + cellH/2 + 5}
                textAnchor="middle" fontSize={cellW * 0.5} fill="white" fontWeight="bold">●</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
