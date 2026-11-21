import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/app';

const COLORS = [
  { name: 'RED', value: '#ef4444' },
  { name: 'BLUE', value: '#3b82f6' },
  { name: 'GREEN', value: '#22c55e' },
  { name: 'YELLOW', value: '#eab308' },
  { name: 'PURPLE', value: '#a855f7' },
];

interface StroopGameProps {
  gameId: string;
}

type Phase = 'instruction' | 'playing' | 'complete';

interface GameConfig {
  roundDuration: number;
  words: Array<{ text: string; color: string }>;
  score: number;
  correct: number;
  total: number;
}

export default function StroopGame({ gameId }: StroopGameProps) {
  const addSession = useAppStore(s => s.addSession);
  const updateStats = useAppStore(s => s.updateStats);
  
  const [config, setConfig] = useState<GameConfig>({
    roundDuration: 60,
    words: [],
    score: 0,
    correct: 0,
    total: 0,
  });
  const [timeLeft, setTimeLeft] = useState(60);
  const [phase, setPhase] = useState<Phase>('instruction');
  const [currentWord, setCurrentWord] = useState<{ text: string; color: string }>({ text: '', color: '' });

  const generateWord = useCallback(() => {
    const textColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const inkColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    return { text: textColor.name, color: inkColor.value };
  }, []);

  const startGame = useCallback(() => {
    setConfig(prev => ({ ...prev, score: 0, correct: 0, total: 0 }));
    setTimeLeft(60);
    setCurrentWord(generateWord());
    setPhase('playing');
  }, [generateWord]);

  useEffect(() => {
    if (phase !== 'playing') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const handleSubmit = useCallback((userColorName: string) => {
    const isCorrect = userColorName === currentWord.text;
    if (isCorrect) {
      setConfig(prev => ({ ...prev, score: prev.score + 10, correct: prev.correct + 1 }));
    }
    setConfig(prev => ({ ...prev, total: prev.total + 1 }));
    setCurrentWord(generateWord());
  }, [currentWord, generateWord]);

  const finishGame = useCallback(() => {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    addSession({
      id: crypto.randomUUID(),
      userId: null,
      gameId,
      score: config.score,
      accuracy,
      difficultyLevel: 1,
      metrics: { correct: config.correct, total: config.total },
      playedAt: new Date().toISOString(),
    });
    updateStats(gameId, {
      highScore: Math.max(config.score, 0),
      bestAccuracy: accuracy,
      totalPlays: 1,
      averageDifficulty: 1,
    });
    setPhase('complete');
  }, [gameId, config, addSession, updateStats]);

  if (phase === 'instruction') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <h2 className="text-2xl font-bold mb-4">Stroop Challenge</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          A word will appear in a colored ink. Click the button that matches the <strong>ink color</strong>, not the word!
        </p>
        <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl inline-block">
          <p className="text-4xl font-bold" style={{ color: '#ef4444' }}>
            BLUE
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            The word says "BLUE" but is printed in RED. Click <strong>RED</strong>.
          </p>
        </div>
        <br />
        <button
          onClick={startGame}
          className="px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl transition-all"
        >
          Start (60 seconds)
        </button>
      </div>
    );
  }

  if (phase === 'complete') {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <div className="text-6xl mb-4">🧠</div>
        <h2 className="text-3xl font-bold mb-2">Time's Up!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {config.correct} out of {config.total} correct
        </p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Score</p>
            <p className="text-2xl font-bold">{config.score}</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Accuracy</p>
            <p className="text-2xl font-bold">{Math.round(accuracy)}%</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Correct</p>
            <p className="text-2xl font-bold">{config.correct}</p>
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl transition-all"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Score</p>
          <p className="text-2xl font-bold">{config.score}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Time</p>
          <p className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : ''}`}>{timeLeft}s</p>
        </div>
      </div>

      <div className="text-center mb-8">
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">What color is the TEXT?</p>
        <p 
          className="text-6xl font-black uppercase tracking-wider"
          style={{ color: currentWord.color }}
        >
          {currentWord.text}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {COLORS.map(color => (
          <button
            key={color.name}
            onClick={() => handleSubmit(color.name)}
            className="py-4 px-6 rounded-xl font-bold text-white transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: color.value }}
          >
            {color.name}
          </button>
        ))}
      </div>
    </div>
  );
}
