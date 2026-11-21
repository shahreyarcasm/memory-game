import { useState, useCallback } from 'react';
import { useAppStore } from '../store/app';

const OBJECTS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁'];

interface ObjectLocationGameProps {
  gameId: string;
}

type Phase = 'instruction' | 'showing' | 'placing' | 'result';

interface ItemState {
  id: number;
  object: string;
  targetPosition: number;
  currentPosition: number | null;
}

interface GameState {
  gridSize: number;
  numItems: number;
  items: ItemState[];
  phase: Phase;
  score: number;
  accuracy: number;
  round: number;
}

export default function ObjectLocationGame({ gameId }: ObjectLocationGameProps) {
  const addSession = useAppStore(s => s.addSession);
  const updateStats = useAppStore(s => s.updateStats);
  
  const [state, setState] = useState<GameState>({
    gridSize: 3,
    numItems: 3,
    items: [],
    phase: 'instruction',
    score: 0,
    accuracy: 100,
    round: 1,
  });

  const startGame = useCallback(() => {
    initializeRound(3, 3, true);
  }, []);

  const finishGame = useCallback((finalScore: number, finalAccuracy: number) => {
    addSession({
      id: crypto.randomUUID(),
      userId: null,
      gameId,
      score: finalScore,
      accuracy: finalAccuracy,
      difficultyLevel: state.gridSize,
      metrics: { roundsCompleted: state.round, gridSize: state.gridSize },
      playedAt: new Date().toISOString(),
    });
    updateStats(gameId, {
      highScore: Math.max(finalScore, 0),
      bestAccuracy: finalAccuracy,
      totalPlays: 1,
      averageDifficulty: state.gridSize,
    });
    setState(prev => ({ ...prev, phase: 'instruction' }));
  }, [gameId, state.gridSize, state.round, addSession, updateStats]);

  const initializeRound = useCallback((gridSize: number, numItems: number, showPhase = false) => {
    const positions = Array.from({ length: gridSize * gridSize }, (_, i) => i);
    const shuffled = positions.sort(() => Math.random() - 0.5);
    const selectedPositions = shuffled.slice(0, numItems);
    const objects = [...OBJECTS].sort(() => Math.random() - 0.5).slice(0, numItems);
    
    const items: ItemState[] = selectedPositions.map((pos, idx) => ({
      id: idx,
      object: objects[idx],
      targetPosition: pos,
      currentPosition: null,
    }));

    setState(prev => ({
      ...prev,
      gridSize,
      numItems,
      items,
      phase: showPhase ? 'showing' : 'instruction',
      round: prev.round,
    }));

    if (showPhase) {
      setTimeout(() => {
        setState(prev => ({ ...prev, phase: 'placing' }));
      }, gridSize * 400 + 500);
    }
  }, []);

  const handlePlaceItem = useCallback((itemId: number, position: number | null) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, currentPosition: position } : item
      ),
    }));
  }, []);

  const checkAnswer = useCallback(() => {
    const correct = state.items.filter(item => item.currentPosition === item.targetPosition).length;
    const accuracy = (correct / state.numItems) * 100;
    const score = correct * 20;

    // Check if player should continue or finish
    const nextRound = state.round + 1;
    const increaseGrid = nextRound % 3 === 0 && state.gridSize < 5;
    const nextGridSize = increaseGrid ? state.gridSize + 1 : state.gridSize;
    const nextNumItems = state.numItems + (nextRound % 2 === 0 ? 1 : 0);

    setState(prev => ({
      ...prev,
      phase: 'result',
      score: prev.score + score,
      accuracy,
      round: nextRound,
    }));

    setTimeout(() => {
      if (accuracy >= 70 && nextRound <= 10) {
        initializeRound(nextGridSize, Math.min(nextNumItems, nextGridSize * nextGridSize - 1), true);
      } else {
        finishGame(state.score + score, accuracy);
      }
    }, 2000);
  }, [state, initializeRound, finishGame]);

  if (state.phase === 'instruction') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <h2 className="text-2xl font-bold mb-4">Object Grid</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Remember where each object was placed, then click to place them back.
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

  if (state.phase === 'showing') {
    const size = state.gridSize;
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">Memorize these positions!</p>
        <div
          className="inline-grid gap-2 mx-auto"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: size * size }).map((_, i) => {
            const item = state.items.find(item => item.targetPosition === i);
            return (
              <div
                key={i}
                className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl ${
                  item ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                {item?.object}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (state.phase === 'placing') {
    const size = state.gridSize;
    const placedItems = state.items.filter(item => item.currentPosition !== null);
    const allPlaced = placedItems.length === state.numItems;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <p className="font-medium">Round {state.round}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {placedItems.length}/{state.numItems} placed
          </p>
        </div>

        {/* Drop zones */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Click a cell to place an object:</p>
          <div
            className="inline-grid gap-2 mx-auto"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: size * size }, (_, i: number) => {
              const item = state.items.find(item => item.currentPosition === i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!item) {
                      // Find unplaced item and place it
                      const unplaced = state.items.find(placed => placed.currentPosition === null);
                      if (unplaced) handlePlaceItem(unplaced.id, i);
                    } else {
                      // Remove item from this position
                      handlePlaceItem(item.id, null);
                    }
                  }}
                  className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl border-2 transition-colors ${
                    item
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500'
                      : 'border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-300'
                  }`}
                >
                  {item?.object}
                </button>
              );
            })}
          </div>
        </div>

        {!allPlaced && (
          <div className="flex justify-center gap-3 mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 self-center mr-2">Remaining:</p>
            {state.items.filter(item => item.currentPosition === null).map(item => (
              <button
                key={item.id}
                onClick={() => handlePlaceItem(item.id, -1)}
                className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-700 text-2xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
              >
                {item.object}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={checkAnswer}
          disabled={!allPlaced}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
        >
          Check Answer
        </button>
      </div>
    );
  }

  if (state.phase === 'result') {
    const correct = state.items.filter(item => item.currentPosition === item.targetPosition).length;
    const isCorrect = correct === state.numItems;

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-2xl p-8 border ${isCorrect ? 'border-emerald-500' : 'border-amber-500'} text-center`}>
        <div className={`text-6xl mb-4 ${isCorrect ? 'text-emerald-500' : 'text-amber-500'}`}>
          {isCorrect ? '✓' : '≈'}
        </div>
        <h3 className="text-2xl font-bold mb-2">
          {isCorrect ? 'Perfect!' : `${correct}/${state.numItems} Correct`}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Grid: {state.gridSize}×{state.gridSize} | Score: +{correct * 20}
        </p>
      </div>
    );
  }

  return null;
}
