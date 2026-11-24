import { useState, useCallback } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
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

export default function PatternFocusGame({ gameId }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier } = usePredictedDifficulty(gameId);
  const ti = ['novice','explorer','master','grandmaster','legend'].indexOf(tier);

  const [phase, setPhase] = useState<Phase>('instruction');
  const [grid, setGrid] = useState<boolean[]>([]);
  const [targetIdx, setTargetIdx] = useState<number>(-1);
  const [score, setScore] = useState(0);
  const gridSize = 4; // 4x4

  const generatePattern = useCallback(() => {
    const arr = Array(gridSize * gridSize).fill(false);
    const count = 5 + ti;
    for(let i=0; i<count; i++) arr[Math.floor(Math.random()*arr.length)] = true;
    return arr;
  }, [ti]);

  const startGame = useCallback(() => {
    setPhase('showing');
    const p = generatePattern();
    setGrid(p);
    setTimeout(() => {
        const next = [...p];
        // find a cell that is currently true, OR find one that is false, to flip.
        // let's flip a random one to be safe.
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = !next[idx];
        setGrid(next);
        setTargetIdx(idx);
        setPhase('input');
    }, 1500 + ti * 200);
  }, [generatePattern, ti]);

  const handleTap = (idx: number) => {
    if (idx === targetIdx) {
        setScore(s => s + 10);
        soundEnabled && playSound('correct');
        startGame();
    } else {
        soundEnabled && playSound('wrong');
        setPhase('complete');
        recordSession({id:_uuid(), userId: null, gameId, score: score, accuracy: 1, difficultyLevel: 1, metrics: {}}, {highScore: score, bestAccuracy: 1, averageDifficulty: 1});
    }
  };

  if (phase === 'instruction') return (
    <div className="flex flex-col items-center justify-center gap-5 p-6 min-h-[400px]">
        <h1 className="text-2xl font-bold">Pattern Focus</h1>
        <p className="text-center text-slate-600">Watch the pattern, then spot the change!</p>
        <Button onClick={startGame}>Start Test</Button>
        <p className="text-xs text-slate-400 mt-2">Match score: {score}</p>
    </div>
  );
  if (phase === 'showing') return (
    <div className="grid grid-cols-4 gap-2 p-4">
        {grid.map((on, i) => <div key={i} className={`h-16 w-16 rounded ${on ? 'bg-orange-500' : 'bg-slate-200'}`} />)}
    </div>
  );
  if (phase === 'input') return (
    <div className="grid grid-cols-4 gap-2 p-4">
        {grid.map((on, i) => <button key={i} className={`h-16 w-16 rounded ${on ? 'bg-orange-500' : 'bg-slate-200'}`} onClick={() => handleTap(i)} />)}
    </div>
  );
  return (
    <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Game Over! Score: {score}</h1>
        <Button onClick={startGame}>Try Again</Button>
    </div>
  );
}
