import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';

interface RapidFlashGameProps {
  gameId: string;
}

type Phase = 'instruction' | 'countdown' | 'playing' | 'complete';

interface TargetState {
  x: number;
  y: number;
  spawnTime: number;
}

export default function RapidFlashGame({ gameId }: RapidFlashGameProps) {
  const addSession = useAppStore(s => s.addSession);
  const updateStats = useAppStore(s => s.updateStats);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>();
  
  const [phase, setPhase] = useState<Phase>('instruction');
  const [target, setTarget] = useState<TargetState | null>(null);
  const [score, setScore] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [gameTime, setGameTime] = useState(30);
  const [missed, setMissed] = useState(0);

  const spawnTarget = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 60;
    const x = padding + Math.random() * (rect.width - padding * 2);
    const y = padding + Math.random() * (rect.height - padding * 2);
    
    setTarget({ x, y, spawnTime: Date.now() });
  }, []);

  const handleClick = useCallback(() => {
    if (!target) return;
    
    const reactionTime = Date.now() - target.spawnTime;
    setReactionTimes(prev => [...prev, reactionTime]);
    setScore(prev => prev + Math.max(10, 100 - Math.floor(reactionTime / 10)));
    setTarget(null);
    setRound(prev => prev + 1);
    
    // Spawn next target with slight delay
    setTimeout(spawnTarget, 200 + Math.random() * 300);
  }, [target, spawnTarget]);

  const missClick = useCallback(() => {
    setMissed(prev => prev + 1);
    setScore(prev => Math.max(0, prev - 5));
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setReactionTimes([]);
    setRound(0);
    setGameTime(30);
    setMissed(0);
    setPhase('countdown');
    
    setTimeout(() => {
      setPhase('playing');
      spawnTarget();
      
      timerRef.current = window.setInterval(() => {
        setGameTime(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            finishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 1500);
  }, [spawnTarget]);

  const finishGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    const avgReaction = reactionTimes.length > 0 
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    const accuracy = round > 0 
      ? Math.round((reactionTimes.length / (reactionTimes.length + missed)) * 100) 
      : 0;

    addSession({
      id: crypto.randomUUID(),
      userId: null,
      gameId,
      score,
      accuracy,
      difficultyLevel: 1,
      metrics: { avgReaction, rounds: round, misses: missed },
      playedAt: new Date().toISOString(),
    });
    updateStats(gameId, {
      highScore: Math.max(score, 0),
      bestAccuracy: accuracy,
      totalPlays: 1,
      averageDifficulty: 1,
    });
    setPhase('complete');
  }, [gameId, score, reactionTimes, round, missed, addSession, updateStats]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (phase === 'instruction') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <h2 className="text-2xl font-bold mb-4">Rapid Flash</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Click the targets as fast as you can! Test your reaction time and processing speed.
        </p>
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <p>⏱️ 30 second rounds</p>
          <p>✓ Faster reactions = higher scores</p>
          <p>✗ Missing targets reduces your score</p>
        </div>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl transition-all"
        >
          Start Test
        </button>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-6xl font-bold text-primary-600 animate-pulse">Get Ready...</p>
      </div>
    );
  }

  if (phase === 'complete') {
    const avgReaction = reactionTimes.length > 0 
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    const accuracy = round > 0 
      ? Math.round((reactionTimes.length / (reactionTimes.length + missed)) * 100) 
      : 0;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <div className="text-6xl mb-4">⚡</div>
        <h2 className="text-3xl font-bold mb-2">Time's Up!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You hit {reactionTimes.length} targets in {round} attempts
        </p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Score</p>
            <p className="text-2xl font-bold">{score}</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Reaction</p>
            <p className="text-2xl font-bold">{avgReaction}ms</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Accuracy</p>
            <p className="text-2xl font-bold">{accuracy}%</p>
          </div>
        </div>
        {reactionTimes.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Recent Reactions</p>
            <div className="flex justify-center gap-1 flex-wrap">
              {reactionTimes.slice(-10).map((t, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 rounded text-xs ${
                    t < 300 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                    t < 500 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}
                >
                  {t}ms
                </span>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={startGame}
          className="px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 flex justify-around">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Score</p>
          <p className="text-xl font-bold">{score}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Time</p>
          <p className={`text-xl font-bold ${gameTime <= 10 ? 'text-red-500' : ''}`}>{gameTime}s</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Hits</p>
          <p className="text-xl font-bold">{reactionTimes.length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Misses</p>
          <p className="text-xl font-bold text-red-500">{missed}</p>
        </div>
      </div>

      {/* Game Area */}
      <div
        ref={containerRef}
        onClick={missClick}
        className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-crosshair"
        style={{ height: '400px' }}
      >
        {target && (
          <button
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold shadow-lg transform transition-transform hover:scale-110 active:scale-95"
            style={{ left: target.x - 24, top: target.y - 24 }}
          >
            ⚡
          </button>
        )}
        
        {!target && phase === 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <p className="animate-pulse">Waiting for next target...</p>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Click anywhere on empty areas to avoid misses
      </p>
    </div>
  );
}
