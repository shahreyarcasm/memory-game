import { useEffect } from 'react';
import { useState, useCallback } from 'react';
import { useAppStore } from '../store/app';

interface SpatialMatrixGameProps {
  gameId: string;
}

type Phase = 'instruction' | 'countdown' | 'showing' | 'input' | 'result';

interface GameState {
  phase: Phase;
  gridSize: number;
  highlights: number[];
  userSelection: number[];
  round: number;
  score: number;
  accuracy: number;
}

export default function SpatialMatrixGame({ gameId }: SpatialMatrixGameProps) {
  const addSession = useAppStore(s => s.addSession);
  const updateStats = useAppStore(s => s.updateStats);
  
  const [state, setState] = useState<GameState>({
    phase: 'instruction',
    gridSize: 3,
    highlights: [],
    userSelection: [],
    round: 1,
    score: 0,
    accuracy: 100,
  });

  const startGame = () => {
    setState(prev => ({ ...prev, phase: 'countdown', score: 0, accuracy: 100, round: 1 }));
    setTimeout(() => nextRound(3, 2), 1500);
  };

  const nextRound = useCallback((gridSize: number, numHighlights: number) => {
    const cells = gridSize * gridSize;
    const highlights = [...new Set(Array.from({ length: numHighlights }, () => Math.floor(Math.random() * cells)))];
    
    setState(prev => ({
      ...prev,
      gridSize,
      highlights,
      userSelection: [],
      phase: 'showing',
    }));

    setTimeout(() => {
      setState(prev => ({ ...prev, phase: 'input' }));
    }, gridSize * 500 + 300);
  }, []);

  const handleCellClick = (index: number) => {
    setState(prev => ({
      ...prev,
      userSelection: prev.userSelection.includes(index)
        ? prev.userSelection.filter(i => i !== index)
        : [...prev.userSelection, index],
    }));
  };

  const handleSubmit = () => {
    const correct = state.userSelection.length === state.highlights.length &&
      state.highlights.every(h => state.userSelection.includes(h));
    
    const newAccuracy = ((state.accuracy * (state.round - 1)) + (correct ? 100 : 0)) / state.round;
    const newScore = state.score + (correct ? state.highlights.length * 15 : 0);
    
    setState(prev => ({
      ...prev,
      phase: 'result',
      accuracy: newAccuracy,
      score: newScore,
      round: prev.round + 1,
    }));

    if (correct) {
      setTimeout(() => {
        const nextGridSize = state.round <= 3 ? state.gridSize : Math.min(6, state.gridSize + (Math.random() > 0.5 ? 1 : 0));
        const nextHighlights = Math.min(state.highlights.length + 1, nextGridSize * nextGridSize - 1);
        nextRound(nextGridSize, nextHighlights);
      }, 1500);
    } else {
      setTimeout(() => {
        finishGame(newAccuracy, newScore);
      }, 2500);
    }
  };

  const finishGame = (finalAccuracy: number, finalScore: number) => {
    addSession({
      id: crypto.randomUUID(),
      userId: null,
      gameId,
      score: finalScore,
      accuracy: finalAccuracy,
      difficultyLevel: state.gridSize,
      metrics: { gridSize: state.gridSize, roundsCompleted: state.round },
      playedAt: new Date().toISOString(),
    });
    updateStats(gameId, {
      highScore: Math.max(finalScore, 0),
      bestAccuracy: finalAccuracy,
      totalPlays: 1,
      averageDifficulty: state.gridSize,
    });
    setState(prev => ({ ...prev, phase: 'instruction' }));
  };

  // Check win condition when state changes
  useEffect(() => {
    if (state.phase === 'result' && !state.phase.includes('showing')) {
      // Results are handled automatically
    }
  }, [state.phase]);

  if (state.phase === 'instruction') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <h2 className="text-2xl font-bold mb-4">Spatial Matrix</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Watch the highlighted squares and remember their positions. Then click the same squares.
        </p>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  if (state.phase === 'countdown') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-6xl font-bold text-primary-600 animate-pulse">Get Ready...</p>
      </div>
    );
  }

  if (state.phase === 'showing') {
    const size = state.gridSize;
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">Memorize these positions!</p>
        <div
          className="inline-grid gap-2 mx-auto"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: size * size }).map((_, i) => (
            <div
              key={i}
              className={`w-16 h-16 rounded-lg transition-all duration-300 ${
                state.highlights.includes(i)
                  ? 'bg-gradient-to-br from-primary-500 to-accent-500 scale-105 shadow-lg'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (state.phase === 'input') {
    const size = state.gridSize;
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">Round {state.round}</p>
        <p className="text-lg font-medium mb-6">Click the squares you remember!</p>
        <div
          className="inline-grid gap-2 mx-auto mb-6"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: size * size }).map((_, i) => {
            const isSelected = state.userSelection.includes(i);
            return (
              <button
                key={i}
                onClick={() => handleCellClick(i)}
                className={`w-16 h-16 rounded-lg transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary-500 text-white scale-105'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {isSelected && '✓'}
              </button>
            );
          })}
        </div>
        <button
          onClick={handleSubmit}
          disabled={state.userSelection.length === 0}
          className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
        >
          Check Answer
        </button>
      </div>
    );
  }

  if (state.phase === 'result') {
    const correct = state.userSelection.length === state.highlights.length &&
      state.highlights.every(h => state.userSelection.includes(h));

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-2xl p-8 border ${correct ? 'border-emerald-500' : 'border-red-500'} text-center`}>
        <div className={`text-6xl mb-4 ${correct ? 'text-emerald-500' : 'text-red-500'}`}>
          {correct ? '✓' : '✗'}
        </div>
        <h3 className="text-2xl font-bold mb-2">
          {correct ? 'Perfect!' : 'Not Quite!'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Grid: {state.gridSize}×{state.gridSize} | Targets: {state.highlights.length}
        </p>
      </div>
    );
  }

  return null;
}
