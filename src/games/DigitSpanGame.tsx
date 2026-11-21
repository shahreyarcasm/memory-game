import { useState, useCallback } from 'react';
import { useAppStore } from '../store/app';

interface DigitSpanGameProps {
  gameId: string;
}

type Phase = 'instruction' | 'countdown' | 'showing' | 'input' | 'result';

interface GameState {
  phase: Phase;
  sequence: number[];
  userInput: string;
  currentRound: number;
  score: number;
  accuracy: number;
  reversals: number;
  isReverse: boolean;
}

export default function DigitSpanGame({ gameId }: DigitSpanGameProps) {
  const addSession = useAppStore(s => s.addSession);
  const updateStats = useAppStore(s => s.updateStats);
  
  const [state, setState] = useState<GameState>({
    phase: 'instruction',
    sequence: [],
    userInput: '',
    currentRound: 1,
    score: 0,
    accuracy: 100,
    reversals: 0,
    isReverse: false,
  });

  const startGame = (reverse = false) => {
    setState(prev => ({
      ...prev,
      phase: 'countdown',
      isReverse: reverse,
      currentRound: 1,
      score: 0,
      accuracy: 100,
    }));
    
    setTimeout(() => generateSequence(3), 1500);
  };

  const generateSequence = useCallback((length: number) => {
    const seq = Array.from({ length }, () => Math.floor(Math.random() * 10));
    setState(prev => ({
      ...prev,
      phase: 'showing',
      sequence: seq,
      userInput: '',
    }));
    
    // Show sequence then move to input
    setTimeout(() => {
      setState(prev => ({ ...prev, phase: prev.isReverse ? 'result' : 'input' }));
    }, length * 800 + 500);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userSeq = state.userInput.split('').map(Number);
    
    if (state.isReverse) {
      userSeq.reverse();
    }
    
    const correct = JSON.stringify(userSeq) === JSON.stringify(state.sequence);
    const newAccuracy = ((state.accuracy * (state.currentRound - 1)) + (correct ? 100 : 0)) / state.currentRound;
    const newScore = state.score + (correct ? state.sequence.length * 10 : 0);
    
    setState(prev => ({
      ...prev,
      phase: 'result',
      accuracy: newAccuracy,
      score: newScore,
    }));
    
    if (correct) {
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentRound: prev.currentRound + 1,
        }));
        generateSequence(state.sequence.length + (Math.random() > 0.5 ? 1 : 0));
      }, 1500);
    } else {
      setTimeout(() => {
        if (state.currentRound >= 5) {
          finishGame(newAccuracy, newScore, state.isReverse ? 'reverse' : 'forward');
        } else {
          setState(prev => ({ ...prev, currentRound: prev.currentRound + 1 }));
          generateSequence(state.sequence.length);
        }
      }, 2000);
    }
  };

  const finishGame = (finalAccuracy: number, finalScore: number, mode: string) => {
    addSession({
      id: crypto.randomUUID(),
      userId: null,
      gameId,
      score: finalScore,
      accuracy: finalAccuracy,
      difficultyLevel: state.currentRound,
      metrics: { mode, roundsCompleted: state.currentRound },
      playedAt: new Date().toISOString(),
    });
    updateStats(gameId, {
      highScore: Math.max(finalScore, 0),
      bestAccuracy: finalAccuracy,
      totalPlays: 1,
      averageDifficulty: state.currentRound,
    });
    setState(prev => ({ ...prev, phase: 'instruction' }));
  };

  const handleNumberClick = (num: number) => {
    setState(prev => ({
      ...prev,
      userInput: prev.userInput + num.toString(),
    }));
  };

  const handleBackspace = () => {
    setState(prev => ({
      ...prev,
      userInput: prev.userInput.slice(0, -1),
    }));
  };

  if (state.phase === 'instruction') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <h2 className="text-2xl font-bold mb-4">Digit Span</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Remember the sequence of numbers shown, then enter them in order (or reverse order for the challenge mode).
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => startGame(false)}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
          >
            Forward Mode
          </button>
          <button
            onClick={() => startGame(true)}
            className="px-6 py-3 bg-accent-600 hover:bg-accent-700 text-white font-semibold rounded-xl transition-colors"
          >
            Reverse Mode (Harder)
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'countdown') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-6xl font-bold text-primary-600 animate-pulse">Get Ready...</p>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          {state.isReverse ? 'Remember to enter numbers in REVERSE!' : 'Enter numbers in the order shown.'}
        </p>
      </div>
    );
  }

  if (state.phase === 'showing') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">Remember this sequence:</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {state.sequence.map((num, i) => (
            <div
              key={i}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-2xl font-bold text-white animate-slide-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {num}
            </div>
          ))}
        </div>
        <p className="mt-6 text-gray-400 dark:text-gray-500">Focus and memorize...</p>
      </div>
    );
  }

  if (state.phase === 'input') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Round {state.currentRound}</p>
          <p className="text-lg font-medium">
            {state.isReverse ? 'Enter in REVERSE order:' : 'Enter the sequence:'}
          </p>
          <div className="flex justify-center gap-2 mt-4 min-h-[3rem]">
            {state.userInput.split('').map((digit, i) => (
              <div key={i} className="w-10 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xl font-bold text-primary-600 dark:text-primary-400">
                {digit}
              </div>
            ))}
            {Array.from({ length: Math.max(0, state.sequence.length - state.userInput.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="w-10 h-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600" />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num)}
                className="h-14 rounded-xl bg-gray-100 dark:bg-gray-700 text-xl font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => handleNumberClick(0)}
              className="h-14 rounded-xl bg-gray-100 dark:bg-gray-700 text-xl font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              0
            </button>
            <button
              type="submit"
              disabled={state.userInput.length !== state.sequence.length}
              className="h-14 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ✓
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (state.phase === 'result') {
    const userSeq = state.userInput.split('').map(Number);
    const correct = state.isReverse 
      ? JSON.stringify([...userSeq].reverse()) === JSON.stringify(state.sequence)
      : JSON.stringify(userSeq) === JSON.stringify(state.sequence);

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-2xl p-8 border ${correct ? 'border-emerald-500' : 'border-red-500'} text-center`}>
        <div className={`text-6xl mb-4 ${correct ? 'text-emerald-500' : 'text-red-500'}`}>
          {correct ? '✓' : '✗'}
        </div>
        <h3 className="text-2xl font-bold mb-2">
          {correct ? 'Correct!' : 'Wrong!'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          The sequence was: <span className="font-mono font-bold">{state.sequence.join(' ')}</span>
        </p>
        {!correct && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            You entered: <span className="font-mono">{state.userInput}</span>
          </p>
        )}
      </div>
    );
  }

  return null;
}
