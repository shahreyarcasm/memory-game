import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Layers } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

const ICONS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍑', '🥝'];

function getEncouragement(matches: number, pairCount: number, moves: number): string {
  const efficiency = moves / pairCount;
  if (matches === pairCount && efficiency <= 1.3) return 'Brilliant! You found every pair with minimal moves — your visual memory is sharp!';
  if (matches === pairCount) return 'All pairs found! Practice makes perfect — fewer moves next time!';
  if (matches >= pairCount * 0.7) return `You found ${matches}/${pairCount} pairs — you're getting the hang of this positioning!`;
  if (matches > 0) return 'Every card you flip teaches your brain where to look next. Keep going!';
  return 'Even blank slates are a chance to learn patterns. Try again and watch for clues!';
}

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'playing' | 'complete';

interface Card {
  id: number;
  icon: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function CardPairsGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);
  const difficultyPairCount = (params.pairCount as number) ?? 8;

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [phase, setPhase] = useState<Phase>('instruction');
  const [startTime, setStartTime] = useState<number>(0);
  const [pairCount, setPairCount] = useState(6);
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startTime]);

  const initializeGame = useCallback((pairs: number) => {
    const selectedIcons = ICONS.slice(0, pairs);
    const cardPairs = [...selectedIcons, ...selectedIcons];
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }
    
    setCards(cardPairs.map((icon, idx) => ({
      id: idx,
      icon,
      isFlipped: false,
      isMatched: false,
    })));
    setFlippedIds([]);
    setMoves(0);
    setMatches(0);
    setPairCount(pairs);
    setScore(0);
    setStartTime(Date.now());
    setElapsed(0);
    setPhase('playing');
  }, []);

  const startGame = useCallback(() => {
    initializeGame(difficultyPairCount);
  }, [initializeGame, difficultyPairCount]);

  const handleCardClick = useCallback((id: number) => {
    if (flippedIds.length >= 2) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.isFlipped || card.isMatched) return;

    const newFlipped = [...flippedIds, id];
    setCards(prev => prev.map(c => c.id === id ? { ...c, isFlipped: true } : c));
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = newFlipped;
      const firstCard = cards.find(c => c.id === first)!;
      const secondCard = cards.find(c => c.id === second)!;

      if (firstCard.icon === secondCard.icon) {
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === first || c.id === second ? { ...c, isMatched: true } : c
          ));
          setFlippedIds([]);
          setMatches(m => m + 1);
          setScore(s => s + 10);
          soundEnabled && playSound('correct');
        }, 500);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === first || c.id === second ? { ...c, isFlipped: false } : c
          ));
          setFlippedIds([]);
          playSound('wrong');
        }, 1000);
      }
    }
  }, [cards, flippedIds]);

  useEffect(() => {
    if (phase === 'playing' && matches === pairCount && moves > 0) {
      const finalScore = Math.max(0, Math.round(pairCount * 100 - moves * 2 - elapsed * 0.5));
      const acc = Math.max(0, 100 - (moves - pairCount) * 10);
      
      recordSession(
        { id: _uuid(), userId: null, gameId, score: finalScore, accuracy: acc, difficultyLevel: pairCount, metrics: { moves, time: elapsed } },
        { highScore: finalScore, bestAccuracy: acc, averageDifficulty: pairCount },
      );
      
      soundEnabled && playSound('complete');
      setPhase('complete');
    }
  }, [phase, matches, pairCount, moves, elapsed, gameId, recordSession]);

  // Instruction
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return (
        <DifficultyPreview
          tier={tier}
          masteryScore={masteryScore}
          message={message}
          howToPlay={howToPlay}
          onStart={startGame}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-6 animate-fade-in px-6" style={{ minHeight: 'calc(100dvh - 64px)' }}>
        <div className="text-center space-y-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl">
            <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
            Card Pairs
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm">
            Find all matching pairs by flipping two cards at a time. Fewer moves = higher score!
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>

        <div className="grid gap-3 w-full max-w-xs px-6">
          {[6, 8, 10].map(pairs => (
            <Button key={pairs} size="lg" onClick={() => initializeGame(pairs)} variant="secondary" className="w-full">
              {pairs} Pairs
            </Button>
          ))}
        </div>
        
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Classic visual recognition memory challenge</p>
      </div>
    );
  }

  // Complete
  if (phase === 'complete') {
    const finalScore = Math.max(0, Math.round(pairCount * 100 - moves * 2 - elapsed * 0.5));
    const acc = Math.max(0, 100 - (moves - pairCount) * 10);
    const msg = getEncouragement(matches, pairCount, moves);
    
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-6 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">🎉</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
          Game Over
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{msg}</p>
        
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Completed <span className="font-bold text-emerald-600 dark:text-emerald-400">{matches}</span> of <span className="font-bold">{pairCount}</span> pairs in <span className="font-bold">{moves}</span> moves ({elapsed}s)
        </p>
        
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">{finalScore}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Pairs Found</p>
            <p className="text-xl sm:text-2xl font-bold">{matches}/{pairCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
            <p className="text-xl sm:text-2xl font-bold">{acc}%</p>
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

        <Button size="lg" onClick={() => initializeGame(pairCount)} className="w-full max-w-xs mt-2">
          Play Again
        </Button>
      </div>
    );
  }

  // Playing
  const cols = pairCount <= 6 ? 4 : pairCount <= 8 ? 4 : 5;
  
  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 64px)' }}>
      {/* Compact stats bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl mx-3 mt-3 p-2 sm:p-3 border border-slate-200 dark:border-slate-700 flex justify-around shrink-0">
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
          <p className="text-lg sm:text-xl font-bold">{score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Moves</p>
          <p className="text-lg sm:text-xl font-bold">{moves}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Pairs</p>
          <p className="text-lg sm:text-xl font-bold">{matches}/{pairCount}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Time</p>
          <p className="text-lg sm:text-xl font-bold">{elapsed}s</p>
        </div>
      </div>
      
      {/* Card grid — fills remaining space */}
      <div className="flex-1 flex items-center justify-center px-3 py-2">
        <div
          className="grid gap-1.5 sm:gap-2 w-full max-w-sm"
          style={{ 
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={`aspect-square rounded-xl text-xl sm:text-2xl md:text-3xl flex items-center justify-center transition-all duration-200 touch-manipulation ${
                card.isFlipped || card.isMatched
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 transform rotate-0 shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer'
              } ${card.isMatched ? 'opacity-40 scale-95' : ''}`}
            >
              {card.isFlipped || card.isMatched ? card.icon : '?'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
