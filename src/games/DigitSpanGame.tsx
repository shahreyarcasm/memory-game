import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Binary } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'showing' | 'input' | 'result' | 'complete' | 'preview';

interface RoundResult {
  correct: boolean;
  responseTime?: number;
}

// Cross-browser safe UUID — avoids crypto.randomUUID which isn't available in all mobile browsers
function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const ENCOURAGEMENTS = [
  'Your working memory is like a muscle — every session makes it stronger!',
  'Even missed sequences teach your brain new patterns. Keep training!',
  'Great focus! Your ability to hold information is improving with each round.',
  'Every attempt builds neural pathways. You\'re getting better without knowing it!',
  'Working memory training is one of the best things you can do for your brain. Keep going!',
];

export default function DigitSpanGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const baseLength = (params.sequenceLength as number) ?? 3;

  const userInputRef = useRef<string>('');
  const sequenceRef = useRef<number[]>([]);
  const roundRef = useRef(1);
  const isReverseRef = useRef(false);
  const startedAtRef = useRef(0);
  const scoreRef = useRef(0);
  const accuracyRef = useRef(100);
  const roundResultsRef = useRef<RoundResult[]>([]);
  const livesRef = useRef(3);
  const difficultyLockedRef = useRef(false);
  const consecutiveCorrectRef = useRef(0);
  
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const resultTimerRef = useRef<ReturnType<typeof setTimeout>>();
  
  const [phase, setPhase] = useState<Phase>('instruction');
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [lives, setLives] = useState(3);

  const finishGameRef = useRef<() => void>();

  const startGame = useCallback((reverse: boolean) => {
    isReverseRef.current = reverse;
    userInputRef.current = '';
    sequenceRef.current = [];
    roundRef.current = 1;
    scoreRef.current = 0;
    accuracyRef.current = 100;
    roundResultsRef.current = [];
    livesRef.current = 3;
    startedAtRef.current = 0;
    difficultyLockedRef.current = false;
    consecutiveCorrectRef.current = 0;

    setPhase('showing');
    setRound(1);
    setScore(0);
    setAccuracy(100);
    setRoundResults([]);
    setLives(3);

    setTimeout(() => generateNextRound(baseLength), 1200);
  }, [baseLength]);

  const generateNextRound = useCallback((length: number) => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    
    const seq = Array.from({ length }, () => Math.floor(Math.random() * 10));
    const now = Date.now();
    
    sequenceRef.current = seq;
    userInputRef.current = '';
    startedAtRef.current = now;
    
    setSequence(seq);
    setUserInput('');
    setPhase('showing');
    
    showTimerRef.current = setTimeout(() => {
      setPhase('input');
    }, Math.max(1500, length * 600 + 400));
  }, []);

  const validateAndRecord = useCallback(() => {
    const userSeq = userInputRef.current.split('').map(Number);
    const seq = sequenceRef.current;
    const isReverse = isReverseRef.current;
    const startedAt = startedAtRef.current;
    const currentRound = roundRef.current;
    
    const correct = isReverse
      ? JSON.stringify([...userSeq].reverse()) === JSON.stringify(seq)
      : JSON.stringify(userSeq) === JSON.stringify(seq);
    
    const responseTime = Date.now() - startedAt;
    
    const newResults = [...roundResultsRef.current, { correct, responseTime }];
    roundResultsRef.current = newResults;
    setRoundResults(newResults);
    
    if (correct) {
      const speedBonus = Math.max(0, Math.min(15, Math.floor((2000 - responseTime) / 100)));
      const points = seq.length * 10 + speedBonus;
      scoreRef.current += points;
      setScore(scoreRef.current);
      soundEnabled && playSound('correct');
    } else {
      livesRef.current -= 1;
      setLives(livesRef.current);
      soundEnabled && playSound('wrong');
      if (livesRef.current <= 0) {
        finishGameRef.current?.();
        return;
      }
    }
    
    accuracyRef.current = ((accuracyRef.current * (currentRound - 1)) + (correct ? 100 : 0)) / currentRound;
    setAccuracy(accuracyRef.current);
    
    return correct;
  }, []);

  const finishGame = useCallback(() => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);

    const avgResponseTime = roundResultsRef.current.length > 0
      ? Math.round(roundResultsRef.current.reduce((sum, r) => sum + (r.responseTime || 0), 0) / roundResultsRef.current.length)
      : null;

    const avgDifficulty = roundRef.current;
    recordSession(
      {
        id: _uuid(),
        userId: null,
        gameId,
        score: scoreRef.current,
        accuracy: accuracyRef.current,
        difficultyLevel: avgDifficulty,
        metrics: { mode: isReverseRef.current ? 'reverse' : 'forward', roundsCompleted: roundRef.current, avgResponseTime },
      },
      { highScore: Math.max(scoreRef.current, 0), bestAccuracy: accuracyRef.current, averageDifficulty: avgDifficulty },
    );

    setPhase('complete');
  }, [gameId, recordSession]);

  const handleNumberClick = useCallback((num: number) => {
    if (phase !== 'input') return;
    
    const newInput = userInputRef.current + num.toString();
    userInputRef.current = newInput;
    setUserInput(newInput);
    
    if (newInput.length === sequenceRef.current.length) {
      setTimeout(() => {
        validateAndRecord();
        setPhase('result');
      }, 250);
    }
  }, [phase, validateAndRecord]);

  const handleBackspace = useCallback(() => {
    if (phase !== 'input') return;
    const newInput = userInputRef.current.slice(0, -1);
    userInputRef.current = newInput;
    setUserInput(newInput);
  }, [phase]);

  useEffect(() => {
    finishGameRef.current = finishGame;
  }, [finishGame]);

  useEffect(() => {
    if (phase !== 'result') return;

    const lastResult = roundResultsRef.current[roundResultsRef.current.length - 1];
    const wasCorrect = lastResult?.correct ?? false;

    // Adaptive difficulty using refs
    if (wasCorrect) {
      consecutiveCorrectRef.current += 1;
      if (difficultyLockedRef.current && consecutiveCorrectRef.current >= 2) {
        difficultyLockedRef.current = false;
      }
    } else {
      difficultyLockedRef.current = true;
      consecutiveCorrectRef.current = 0;
    }

    resultTimerRef.current = setTimeout(() => {
      if (!wasCorrect && livesRef.current <= 0) {
         finishGameRef.current?.();
        return;
      }

      const nextLength = wasCorrect && !difficultyLockedRef.current
        ? sequenceRef.current.length + 1
        : sequenceRef.current.length;

      roundRef.current += 1;
      setRound(roundRef.current);

      setTimeout(() => generateNextRound(nextLength), 600);
    }, 1400);

    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, [phase, finishGame, generateNextRound]);

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  // Instruction with tier preview
  if (phase === 'instruction' || phase === 'preview') {
    if (masteryScore > 0) {
      return (
        <DifficultyPreview
          tier={tier}
          masteryScore={masteryScore}
          message={message}
          howToPlay={howToPlay}
          onStart={() => {
            setPhase('showing');
            setTimeout(() => generateNextRound(baseLength), 100);
          }}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-6 animate-fade-in" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-center space-y-4 px-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
            <Binary className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            Digit Span
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Remember digit sequences and enter them in order (or reverse for challenge mode). Wrong answers cost lives!
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>

        <div className="grid gap-3 w-full max-w-xs px-6">
          <Button size="lg" onClick={() => startGame(false)} className="w-full">
            Forward Mode
          </Button>
          <Button size="lg" variant="secondary" onClick={() => startGame(true)} className="w-full">
            Reverse Mode (Harder)
          </Button>
        </div>
      </div>
    );
  }

  // Showing phase
  if (phase === 'showing') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 animate-fade-in" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-center space-y-1 px-4">
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Memorize This Sequence
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {isReverseRef.current ? 'You\'ll enter it in REVERSE order' : 'Enter in the order shown'}
          </p>
        </div>
        
        <div className="flex gap-2 sm:gap-3 flex-wrap justify-center px-4">
          {sequence.map((digit, i) => (
            <div
              key={i}
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-bold text-white shadow-xl animate-reveal"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {digit}
            </div>
          ))}
        </div>
        
        <p className="text-slate-400 dark:text-slate-500 text-sm animate-pulse">Watch carefully...</p>
      </div>
    );
  }

  // Input phase
  if (phase === 'input') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 animate-fade-in" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        {/* Stats */}
        <div className="flex items-center justify-between w-full px-6 max-w-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Round {round}</span>
          <div className="flex items-center gap-2">
            {isReverseRef.current && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">REVERSE</span>
            )}
            <span className="text-rose-500 text-sm">{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</span>
          </div>
        </div>
        
        <p className="text-base sm:text-lg font-semibold text-slate-700 dark:text-slate-200 px-4">
          {isReverseRef.current ? 'Enter in REVERSE:' : 'Enter the sequence:'}
        </p>
        
        {/* Answer slots */}
        <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center px-4">
          {Array.from({ length: sequence.length }).map((_, i) => {
            const digit = userInput[i];
            return (
              <div
                key={i}
                className="w-10 h-12 sm:w-12 sm:h-14 md:w-14 md:h-16 rounded-xl flex items-center justify-center text-base sm:text-xl md:text-2xl font-bold transition-all ${digit ? 'bg-indigo-500 text-white shadow-lg scale-105' : 'bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600'}"
              >
                {digit || <span className="text-slate-300 dark:text-slate-600">{i + 1}</span>}
              </div>
            );
          })}
        </div>
        
        {/* Number pad */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-xs px-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="aspect-square rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg sm:text-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-95 transition-all shadow-sm touch-manipulation"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="aspect-square rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/30 active:scale-95 transition-all touch-manipulation"
          >
            ←
          </button>
          <button
            onClick={() => handleNumberClick(0)}
            className="aspect-square rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg sm:text-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-95 transition-all shadow-sm touch-manipulation"
          >
            0
          </button>
        </div>
        
        <p className="text-xs text-slate-400 dark:text-slate-500 px-4">
          {userInput.length}/{sequence.length} entered — auto-submits when complete
        </p>
      </div>
    );
  }

  // Result feedback
  if (phase === 'result') {
    const lastResult = roundResults[roundResults.length - 1];
    const correct = lastResult?.correct ?? false;
    
    return (
      <div className={`flex flex-col items-center justify-center gap-4 sm:gap-6 animate-pop ${
        correct ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-rose-50/50 dark:bg-rose-900/10'
      }`} style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center ${
          correct ? 'bg-emerald-500' : 'bg-rose-500'
        } shadow-2xl`}>
          <span className="text-3xl sm:text-4xl text-white font-bold">{correct ? '✓' : '✗'}</span>
        </div>
        
        <div className="text-center space-y-2 px-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
            {correct ? 'Correct!' : 'Not Quite'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Sequence: <span className="font-mono font-bold">{sequence.join(' ')}</span>
          </p>
          {!correct && userInput.length > 0 && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              You entered: <span className="font-mono">{userInput}</span>
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs px-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-2 sm:p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-base sm:text-xl font-bold text-primary-600 dark:text-primary-400">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-2 sm:p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
            <p className="text-base sm:text-xl font-bold">{Math.round(accuracy)}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-2 sm:p-3 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Round</p>
            <p className="text-base sm:text-xl font-bold">{round}</p>
          </div>
        </div>
      </div>
    );
  }

  // Complete — game over
  if (phase === 'complete') {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-6" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-4xl sm:text-5xl mb-1">🧠</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          Game Over
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center">{msg}</p>
        
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">{score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
            <p className="text-xl sm:text-2xl font-bold">{Math.round(accuracy)}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Rounds</p>
            <p className="text-xl sm:text-2xl font-bold">{round - 1}</p>
          </div>
        </div>
        
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-lg font-black px-3 py-1 rounded-full text-white ${
              tier === 'novice' ? 'bg-emerald-500' :
              tier === 'explorer' ? 'bg-blue-500' :
              tier === 'master' ? 'bg-violet-500' :
              tier === 'grandmaster' ? 'bg-amber-500' :
              'bg-rose-500'
            }`}>{tier.toUpperCase()}</span>
            <div className="flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Mastery Score</p>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${masteryScore}%`,
                    background: tier === 'novice' ? '#10b981' :
                                tier === 'explorer' ? '#3b82f6' :
                                tier === 'master' ? '#8b5cf6' :
                                tier === 'grandmaster' ? '#f59e0b' : '#f43f5e',
                  }}
                />
              </div>
              <p className="text-right text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{masteryScore}/100</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>

        <Button size="lg" onClick={() => startGame(isReverseRef.current)} className="w-full max-w-xs mt-2">
          Play Again
        </Button>
      </div>
    );
  }

  return null;
}
