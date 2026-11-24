import { useState, useCallback, useRef } from 'react';
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

type Phase = 'instruction' | 'preview' | 'showing' | 'input' | 'result' | 'complete' | 'showing-pairs' | 'matching';

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Predefined sentences grouped by length for progressive difficulty
const SENTENCES: Record<string, string[]> = {
  short: [
    'The cat sat down',
    'Birds fly south',
    'Fish swim deep',
    'Dogs bark loud',
    'Sun rises east',
    'Rain falls soft',
    'Trees grow tall',
    'Wind blows cold',
  ],
  medium: [
    'She reads books daily',
    'He runs fast every morning',
    'They played in the park today',
    'We studied hard for the test',
    'The river flows to the sea',
    'Stars shine bright at night',
    'Clouds drift across the sky',
    'Leaves fall in autumn wind',
  ],
  long: [
    'The quick brown fox jumps over the lazy dog',
    'A journey of a thousand miles begins with one step',
    'Knowledge is power and wisdom is its guide',
    'Every sunset brings the promise of a new dawn',
    'Music fills the silence between words',
    'Time flies when you are having fun',
    'The best way to predict the future is to create it',
    'Learning never exhausts the mind',
  ],
};

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.9) return 'Linguistic memory at peak performance! Your word ordering is impeccable!';
  if (pct >= 0.7) return 'Strong recall ability! You captured most of the original sentence structure beautifully.';
  if (pct >= 0.5) return 'Good sequencing skills! Your verbal memory is developing well — keep practicing!';
  return 'Every scramble you solve rewires your language circuits. Trust the pattern recognition!';
}

export default function WordPairRecallGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const diff = (params.difficulty ?? 2) as number;

  const [phase, setPhase] = useState<Phase>('instruction');
  const [round, setRound] = useState(0);
  const [totalRounds] = useState(6 + Math.min(diff, 4));
  const [config, setConfig] = useState({ score: 0, correct: 0, total: 0 });
  const [currentSentence, setCurrentSentence] = useState('');
  const [scrambledWords, setScrambledWords] = useState<string[]>([]);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [pairWords, setPairWords] = useState<{ left: string; right: string }[]>([]);
  const [pairPrompt, setPairPrompt] = useState<{ word: string; options: string[]; correct: string } | null>(null);
  // Adaptive
  const [effectiveDiff, setEffectiveDiff] = useState(diff);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const recentResultsRef = useRef<boolean[]>([]);

  const generateChallenge = useCallback(() => {
    const pool = effectiveDiff <= 2 ? SENTENCES.short : effectiveDiff <= 4 ? SENTENCES.medium : SENTENCES.long;
    const sentence = pool[Math.floor(Math.random() * pool.length)];
    const words = sentence.split(' ');
    
    if (words.length >= 4) {
      const pairSize = Math.min(3, Math.floor(words.length / 2));
      const selectedWords = words.slice(0, pairSize * 2);
      const pairs: { left: string; right: string }[] = [];
      for (let i = 0; i < pairSize; i++) {
        pairs.push({ left: selectedWords[i], right: selectedWords[pairSize + i] });
      }
      setPairWords(pairs);
      setScrambledWords([]);
      setPhase('showing-pairs');
    } else {
      setCurrentSentence(sentence);
      setScrambledWords(shuffleArray(words));
      setPairWords([]);
      setPhase('showing');
    }
    setPlayerOrder([]);
    setFeedback('none');
  }, [diff]);

  const startGame = useCallback(() => {
    setConfig({ score: 0, correct: 0, total: 0 });
    setRound(0);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    recentResultsRef.current = [];
    setPhase('instruction');
  }, [diff]);

  const finishGame = useCallback(() => {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    recordSession(
      { id: _uuid(), userId: null, gameId, score: config.score, accuracy, difficultyLevel: effectiveDiff, metrics: {} },
      { highScore: Math.max(config.score, 0), bestAccuracy: accuracy, averageDifficulty: effectiveDiff },
    );
    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [gameId, config, diff, effectiveDiff, recordSession, soundEnabled]);

  const showNextRound = useCallback(() => {
    setRound(prev => {
      const next = prev + 1;
      if (next >= totalRounds) { finishGame(); return next; }
      generateChallenge();
      return next;
    });
  }, [totalRounds, generateChallenge, finishGame]);

  const beginPlaying = useCallback(() => {
    setConfig({ score: 0, correct: 0, total: 0 });
    setRound(0);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    recentResultsRef.current = [];
    generateChallenge();
  }, [generateChallenge, diff]);

  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl">
            <Binary className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
            Word Pair Recall
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            Memorize word pairs or reconstruct sentences from scrambled words. Tap to match and rebuild!
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>
        <Button size="lg" onClick={() => setPhase('preview')} className="w-full max-w-xs">Start</Button>
      </div>
    );
  }

  if (phase === 'preview') {
    return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={beginPlaying} />;
  }

  // Showing pairs phase - memorize word pairs
  if (phase === 'showing-pairs') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Memorize these pairs</p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          {pairWords.map((pair, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{pair.left}</span>
              <span className="text-slate-400">↕</span>
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{pair.right}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">When ready, tap Continue</p>
        <Button size="lg" onClick={() => {
          const firstPair = pairWords[0];
          const allRights = pairWords.map(p => p.right);
          const shuffledRights = shuffleArray(allRights);
          setPairPrompt({ word: firstPair.left, options: shuffledRights, correct: firstPair.right });
          setPhase('matching');
        }} className="mt-4">Continue</Button>
      </div>
    );
  }

  // Matching phase - match words to partners
  if (phase === 'matching') {
    if (!pairPrompt) return null;
    const isAnswered = playerOrder.length > 0;
    const userChoice = playerOrder[0];

    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Match the partner</p>
        <div className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-2">{pairPrompt.word}</div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          {pairPrompt.options.map(opt => (
            <button
              key={opt}
              onClick={() => {
                if (isAnswered) return;
                setPlayerOrder([opt]);
                if (opt === pairPrompt.correct) {
                  soundEnabled && playSound('correct');
                  setFeedback('correct');
                  setConfig(prev => ({ ...prev, correct: prev.correct + 1, score: prev.score + 50, total: prev.total + 1 }));
                  recentResultsRef.current = [...recentResultsRef.current, true].slice(-3);
                } else {
                  soundEnabled && playSound('wrong');
                  setFeedback('wrong');
                  setConfig(prev => ({ ...prev, total: prev.total + 1 }));
                  recentResultsRef.current = [...recentResultsRef.current, false].slice(-3);
                }
                
                // Adaptive
                const accuracy = recentResultsRef.current.filter(Boolean).length / recentResultsRef.current.length;
                if (recentResultsRef.current.length === 3) {
                  if (!difficultyLocked && accuracy < 0.4) {
                    setDifficultyLocked(true);
                    setEffectiveDiff(prev => Math.max(1, prev - 1));
                  } else if (accuracy >= 0.8) {
                    setDifficultyLocked(false);
                    setEffectiveDiff(prev => Math.min(prev + 1, diff + 2));
                  }
                }
                setTimeout(() => showNextRound(), 700);
              }}
              disabled={isAnswered}
              className={`py-4 rounded-xl font-bold text-base transition-all touch-manipulation shadow-md ${
                isAnswered
                  ? opt === pairPrompt.correct
                    ? 'bg-emerald-500 text-white'
                    : opt === userChoice
                    ? 'bg-red-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {feedback === 'correct' && <p className="text-emerald-500 font-semibold">✓ Correct!</p>}
        {feedback === 'wrong' && <p className="text-red-500 font-semibold">✗ Wrong — was "{pairPrompt.correct}"</p>}
      </div>
    );
  }

  // Showing sentence phase (for short sentences)
  if (phase === 'showing') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Read this sentence</p>
        <p className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 text-center px-4">{currentSentence}</p>
        <p className="text-xs text-slate-400">When ready, tap Continue to reorder</p>
        <Button size="lg" onClick={() => setPhase('input')} className="mt-4">Continue</Button>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-5xl sm:text-6xl mb-2">{feedback === 'correct' ? '✨' : '📝'}</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{feedback === 'correct' ? 'Perfect!' : 'Keep trying!'}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Round {round + 1} of {totalRounds}</p>
        <Button size="lg" onClick={showNextRound} className="w-full max-w-xs">Next Round</Button>
      </div>
    );
  }

  if (phase === 'complete') {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">📖</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">Complete!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{getEncouragement(config.correct, config.total)}</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p><p className="text-2xl font-bold">{Math.round(accuracy)}%</p></div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{config.correct} out of {config.total} matches correct</p>
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-lg font-black px-3 py-1 rounded-full text-white ${tier === 'novice' ? 'bg-emerald-500' : tier === 'explorer' ? 'bg-blue-500' : tier === 'master' ? 'bg-violet-500' : tier === 'grandmaster' ? 'bg-amber-500' : 'bg-rose-500'}`}>{tier.toUpperCase()}</span>
            <div className="flex-1"><p className="text-xs text-slate-500 dark:text-slate-400">Mastery Score</p><div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${masteryScore}%`, background: tier === 'novice' ? '#10b981' : tier === 'explorer' ? '#3b82f6' : tier === 'master' ? '#8b5cf6' : tier === 'grandmaster' ? '#f59e0b' : '#f43f5e' }} /></div><p className="text-right text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{masteryScore}/100</p></div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Try Again</Button>
      </div>
    );
  }

  // Input phase - reorder words
  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto p-3 sm:p-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0">
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Round</p><p className="text-lg sm:text-xl font-bold">{round + 1}/{totalRounds}</p></div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-lg sm:text-xl font-bold">{config.score}</p></div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Level</p>
          <p className="text-lg sm:text-xl font-bold">{effectiveDiff}</p>
          {difficultyLocked && <p className="text-[10px] text-amber-500 font-semibold leading-tight">🔒 Locked</p>}
        </div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Words</p><p className="text-lg sm:text-xl font-bold">{scrambledWords.length}</p></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4 gap-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Tap words in the correct order:</p>
        
        {/* Player's constructed sentence */}
        <div className="flex flex-wrap gap-2 justify-center min-h-[48px] p-3 bg-slate-100 dark:bg-slate-800 rounded-xl w-full max-w-sm">
          {playerOrder.map((word, i) => (
            <button
              key={i}
              onClick={() => {
                if (feedback !== 'none') return;
                setPlayerOrder(prev => prev.filter((_, idx) => idx !== i));
              }}
              className="px-3 py-2 rounded-lg bg-primary-500 text-white font-bold text-sm shadow-sm hover:bg-primary-600 active:scale-95 transition-transform"
            >
              {word}
            </button>
          ))}
        </div>

        {/* Scrambled word bank */}
        <div className="flex flex-wrap gap-2 justify-center">
          {scrambledWords.map((word, i) => {
            const alreadyUsed = playerOrder.includes(word) && playerOrder.indexOf(word) === i;
            return (
              <button
                key={`${word}-${i}`}
                onClick={() => {
                  if (feedback !== 'none' || alreadyUsed) return;
                  const updated = [...playerOrder, word];
                  setPlayerOrder(updated);
                  if (updated.length === scrambledWords.length) {
                    const checkCorrect = JSON.stringify(updated) === JSON.stringify(scrambledWords);
                    setFeedback(checkCorrect ? 'correct' : 'wrong');
                    if (checkCorrect) {
                      soundEnabled && playSound('correct');
                      setConfig(prev => ({ ...prev, correct: prev.correct + 1, score: prev.score + 100, total: prev.total + 1 }));
                    } else {
                      soundEnabled && playSound('wrong');
                      setConfig(prev => ({ ...prev, total: prev.total + 1 }));
                    }
                    setTimeout(() => setPhase('result'), 800);
                  }
                }}
                disabled={alreadyUsed || feedback !== 'none'}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all touch-manipulation shadow-md ${
                  alreadyUsed
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 opacity-50'
                    : feedback === 'correct' && playerOrder[i] === word
                    ? 'bg-emerald-500 text-white'
                    : feedback === 'wrong'
                    ? 'bg-red-500 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95'
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pb-2">
        <Button variant="secondary" onClick={() => { setPlayerOrder([]); setFeedback('none'); }} className="flex-1">Clear</Button>
        {playerOrder.length === scrambledWords.length && feedback === 'none' && (
          <Button variant="primary" onClick={() => {
            const checkCorrect = JSON.stringify(playerOrder) === JSON.stringify(scrambledWords);
            setFeedback(checkCorrect ? 'correct' : 'wrong');
            if (checkCorrect) {
              soundEnabled && playSound('correct');
              setConfig(prev => ({ ...prev, correct: prev.correct + 1, score: prev.score + 100, total: prev.total + 1 }));
            } else {
              soundEnabled && playSound('wrong');
              setConfig(prev => ({ ...prev, total: prev.total + 1 }));
            }
            setTimeout(() => setPhase('result'), 800);
          }} className="flex-1">Submit</Button>
        )}
      </div>
    </div>
  );
}
