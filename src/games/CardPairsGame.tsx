import { useState, useCallback } from 'react';
import { useAppStore } from '../store/app';

const ICONS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍑', '🥝'];

interface CardPairsGameProps {
  gameId: string;
}

type Phase = 'instruction' | 'playing' | 'complete';

interface Card {
  id: number;
  icon: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function CardPairsGame({ gameId }: CardPairsGameProps) {
  const addSession = useAppStore(s => s.addSession);
  const updateStats = useAppStore(s => s.updateStats);
  
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [phase, setPhase] = useState<Phase>('instruction');
  const [startTime, setStartTime] = useState<number>(0);
  const [pairCount, setPairCount] = useState(6);

  const initializeGame = useCallback((pairs: number) => {
    const selectedIcons = ICONS.slice(0, pairs);
    const cardPairs = [...selectedIcons, ...selectedIcons];
    const shuffled = cardPairs.sort(() => Math.random() - 0.5);
    
    setCards(shuffled.map((icon, idx) => ({
      id: idx,
      icon,
      isFlipped: false,
      isMatched: false,
    })));
    setFlippedIds([]);
    setMoves(0);
    setMatches(0);
    setPairCount(pairs);
    setStartTime(Date.now());
    setPhase('playing');
  }, []);

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
        }, 500);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.id === first || c.id === second ? { ...c, isFlipped: false } : c
          ));
          setFlippedIds([]);
        }, 1000);
      }
    }
  }, [cards, flippedIds]);

  // Check win condition
  const checkWinCondition = useCallback(() => {
    if (phase === 'playing' && matches === pairCount && moves > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const accuracy = Math.max(0, 100 - (moves - pairCount) * 10);
      const score = Math.max(0, Math.round(pairCount * 100 - moves * 2 + elapsed));
      
      addSession({
        id: crypto.randomUUID(),
        userId: null,
        gameId,
        score,
        accuracy,
        difficultyLevel: pairCount,
        metrics: { moves, time: elapsed },
        playedAt: new Date().toISOString(),
      });
      updateStats(gameId, {
        highScore: score,
        bestAccuracy: accuracy,
        totalPlays: 1,
        averageDifficulty: pairCount,
      });
      setPhase('complete');
    }
  }, [phase, matches, pairCount, moves, startTime, gameId, addSession, updateStats]);

  // Run check when relevant state changes
  useState(() => {
    checkWinCondition();
  });

  if (phase === 'instruction') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <h2 className="text-2xl font-bold mb-4">Card Pairs</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Find all matching pairs by flipping two cards at a time. Fewer moves = better score!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {[6, 8, 10].map(pairs => (
            <button
              key={pairs}
              onClick={() => initializeGame(pairs)}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
            >
              {pairs} Pairs
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    const score = Math.max(0, Math.round(pairCount * 100 - moves * 2));
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold mb-2">You Won!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Completed in <span className="font-bold text-primary-600 dark:text-primary-400">{moves}</span> moves
        </p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Score</p>
            <p className="text-2xl font-bold">{score}</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Pairs</p>
            <p className="text-2xl font-bold">{pairCount}</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Moves</p>
            <p className="text-2xl font-bold">{moves}</p>
          </div>
        </div>
        <button
          onClick={() => initializeGame(pairCount)}
          className="px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl transition-all"
        >
          Play Again
        </button>
      </div>
    );
  }

  const cols = pairCount <= 6 ? 4 : pairCount <= 8 ? 4 : 5;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Moves</p>
          <p className="text-2xl font-bold">{moves}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pairs</p>
          <p className="text-2xl font-bold">{matches}/{pairCount}</p>
        </div>
      </div>
      
      <div
        className="grid gap-3 mx-auto"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: '500px' }}
      >
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            className={`aspect-square rounded-xl text-3xl flex items-center justify-center transition-all duration-200 ${
              card.isFlipped || card.isMatched
                ? 'bg-gradient-to-br from-primary-500 to-accent-500 transform rotate-0'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer'
            } ${card.isMatched ? 'opacity-50' : ''}`}
          >
            {card.isFlipped || card.isMatched ? card.icon : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}
