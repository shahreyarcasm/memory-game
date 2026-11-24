import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Calendar } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'preview' | 'showing' | 'input' | 'result' | 'complete';

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Sentence templates for progressive difficulty
const SENTENCE_TEMPLATES = {
  easy: [
    'the cat sat on mat',
    'a bird flew over tree',
    'she ran to the store',
    'he read a good book',
    'we walked in the park',
    'the dog chased a ball',
    'sun shines in sky',
    'fish swim in sea',
  ],
  medium: [
    'the quick brown fox jumped over lazy dog',
    'she carefully placed the cup on table',
    'they were playing outside since morning',
    'he quickly opened the old wooden door',
    'we finished our work before dinner time',
    'the teacher explained the lesson clearly',
    'birds sing beautiful songs every morning',
    'rain fell gently on the green grass',
  ],
  hard: [
    'the remarkable scientist published groundbreaking research yesterday afternoon',
    'children love to explore ancient forests full of mysterious creatures',
    'the magnificent castle stood proudly atop the rocky hill overlooking village',
    'brave explorers discovered hidden treasure beneath the old oak tree',
    'the talented musician played extraordinary melody on grand piano',
    'students studied diligently throughout the entire semester for exam',
    'beautiful butterflies flutter gracefully among colorful garden flowers',
    'the wise old owl watched silently from branch during stormy night',
  ],
};

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.9) return 'Exceptional sequential memory! You reconstruct sentences with impressive accuracy!';
  if (pct >= 0.7) return 'Strong word-order recall! Your linguistic sequencing is rapidly improving.';
  if (pct >= 0.5) return 'Good progress! Remembering word sequences strengthens your syntactic processing.';
  return 'Each attempt builds your verbal working memory. Practice makes the pathway stronger!';
}

export default function SequenceBuilderGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const diff = (params.difficulty ?? 2) as number;

  const [phase, setPhase] = useState<Phase>('instruction');
  const [round, setRound] = useState(0);
  const [totalRounds] = useState(6 + Math.min(diff, 4));
  const [config, setConfig] = useState({ score: 0, correct: 0, total: 0 });
  const [words, setWords] = useState<string[]>([]);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [flashIndex, setFlashIndex] = useState(0);
  const flashRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Adaptive
  const [effectiveDiff, setEffectiveDiff] = useState(diff);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const recentResultsRef = useRef<boolean[]>([]);

  const generateRound = useCallback(() => {
    const pool = effectiveDiff <= 2 ? SENTENCE_TEMPLATES.easy : effectiveDiff <= 4 ? SENTENCE_TEMPLATES.medium : SENTENCE_TEMPLATES.hard;
    const selected = pool[Math.floor(Math.random() * pool.length)];
    setWords(selected.split(' '));
    setPlayerOrder([]);
    setFeedback('none');
    setFlashIndex(0);
    setPhase('showing');
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
      generateRound();
      return next;
    });
  }, [totalRounds, generateRound, finishGame]);

  const beginPlaying = useCallback(() => {
    setConfig({ score: 0, correct: 0, total: 0 });
    setRound(0);
    setEffectiveDiff(diff);
    setDifficultyLocked(false);
    recentResultsRef.current = [];
    generateRound();
  }, [generateRound, diff]);

    // Flash words one by one
  useEffect(() => {
    if (phase !== 'showing' || words.length === 0) return;
    const flashMs = Math.max(300, 700 - effectiveDiff * 50);
    let idx = 0;
    flashRef.current = setInterval(() => {
      idx++;
      setFlashIndex(idx);
      if (idx >= words.length) {
        if (flashRef.current) clearInterval(flashRef.current);
        setTimeout(() => setPhase('input'), 200);
      }
    }, flashMs);
    return () => { if (flashRef.current) clearInterval(flashRef.current); };
  }, [phase, words, effectiveDiff]);

  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl">
            <Calendar className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
            Sequence Builder
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            A sentence flashes word by word. Remember the order, then tap the words to recreate it!
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

  if (phase === 'result') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-5xl sm:text-6xl mb-2">{feedback === 'correct' ? '✨' : '📝'}</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{feedback === 'correct' ? 'Perfect!' : 'Watch carefully next time!'}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Round {round + 1} of {totalRounds}</p>
        <Button size="lg" onClick={showNextRound} className="w-full max-w-xs">Next Round</Button>
      </div>
    );
  }

  if (phase === 'complete') {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">🧩</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">Complete!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{getEncouragement(config.correct, config.total)}</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p><p className="text-2xl font-bold">{Math.round(accuracy)}%</p></div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{config.correct} out of {config.total} sentences correct</p>
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

  // Showing phase - flash words one by one
  if (phase === 'showing') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remember this sentence</p>
        <div className="flex gap-2 flex-wrap justify-center px-4">
          {words.map((word, i) => (
            <span
              key={i}
              className={`text-xl sm:text-2xl font-bold transition-all duration-200 ${
                i === flashIndex
                  ? 'text-primary-600 dark:text-primary-400 scale-125'
                  : i < flashIndex
                  ? 'text-emerald-500 opacity-60'
                  : 'text-slate-300 dark:text-slate-600 opacity-40'
              }`}
            >
              {word}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-400">Watching...</p>
      </div>
    );
  }

  // Input phase
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
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Placed</p><p className="text-lg sm:text-xl font-bold">{playerOrder.length}/{words.length}</p></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4 gap-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Tap words in the correct order:</p>
        
        {/* Player's constructed sentence */}
        <div className="flex flex-wrap gap-2 justify-center min-h-[48px] p-3 bg-slate-100 dark:bg-slate-800 rounded-xl w-full max-w-sm">
          {playerOrder.map((word, i) => (
            <button
              key={`${word}-${i}`}
              onClick={() => {
                if (feedback !== 'none') return;
                setPlayerOrder(prev => prev.filter((_, idx) => idx !== i));
              }}
              className="px-3 py-2 rounded-lg bg-primary-500 text-white font-bold text-sm shadow-sm hover:bg-primary-600 active:scale-95 transition-transform"
            >
              {word}
            </button>
          ))}
          {playerOrder.length === 0 && (
            <span className="text-slate-400 text-sm italic">Tap words below to build the sentence...</span>
          )}
        </div>
      </div>

      <div className="pb-2">
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-2">Word bank — tap to place in order:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {words.map((word, i) => {
            const used = playerOrder.includes(word);
            const usedIdx = playerOrder.indexOf(word);
            const isHighlighted = feedback === 'wrong' && usedIdx !== -1 && playerOrder[usedIdx] !== word;
            return (
              <button
                key={`${word}-${i}`}
                onClick={() => {
                  if (feedback !== 'none' || used) return;
                  const updated = [...playerOrder, word];
                  setPlayerOrder(updated);
                  if (updated.length === words.length) {
                    const checkCorrect = JSON.stringify(updated) === JSON.stringify(words);
                    setFeedback(checkCorrect ? 'correct' : 'wrong');
                    if (checkCorrect) {
                      soundEnabled && playSound('correct');
                      setConfig(prev => ({ ...prev, correct: prev.correct + 1, score: prev.score + 100, total: prev.total + 1 }));
                    } else {
                      soundEnabled && playSound('wrong');
                      setConfig(prev => ({ ...prev, total: prev.total + 1 }));
                    }

                    // Adaptive difficulty
                    recentResultsRef.current = [...recentResultsRef.current, checkCorrect].slice(-3);
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

                    setTimeout(() => setPhase('result'), 800);
                  }
                }}
                disabled={used || feedback !== 'none'}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all touch-manipulation shadow-md ${
                  used
                    ? feedback === 'correct'
                      ? 'bg-emerald-500 text-white'
                      : feedback === 'wrong' && isHighlighted
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95'
                }`}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
