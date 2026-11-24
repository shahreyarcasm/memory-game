import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GAMES } from '../data/games';
import DigitSpanGame from '../games/DigitSpanGame';
import SpatialMatrixGame from '../games/SpatialMatrixGame';
import CardPairsGame from '../games/CardPairsGame';
import StroopGame from '../games/StroopGame';
import ObjectLocationGame from '../games/ObjectLocationGame';
import MentalMathGame from '../games/MentalMathGame';
import VisualSearchGame from '../games/VisualSearchGame';
import SustainedVigilanceGame from '../games/SustainedVigilanceGame';
import PatternBuilderGame from '../games/PatternBuilderGame';
import ClockFaceGame from '../games/ClockFaceGame';
import ArrowRushGame from '../games/ArrowRushGame';
import ChainReactionGame from '../games/ChainReactionGame';
import WordPairRecallGame from '../games/WordPairRecallGame';
import SequenceBuilderGame from '../games/SequenceBuilderGame';
import NumberStreamGame from '../games/NumberStreamGame';
import FlankerAttackGame from '../games/FlankerAttackGame';
import SequenceRecallGame from '../games/SequenceRecallGame';
import GridShuffleGame from '../games/GridShuffleGame';
import FlashRecallGame from '../games/FlashRecallGame';
import PatternFocusGame from '../games/PatternFocusGame';

interface GameComponentProps {
  gameId: string;
  howToPlay?: string;
}

const GAME_COMPONENTS: Record<string, React.FC<GameComponentProps>> = {
  'digit-span': DigitSpanGame,
  'spatial-matrix': SpatialMatrixGame,
  'mental-math': MentalMathGame,
  'sequence-recall': SequenceRecallGame,
  'card-pairs': CardPairsGame,
  'pattern-builder': PatternBuilderGame,
  'object-location': ObjectLocationGame,
  'grid-shuffle': GridShuffleGame,
  'stroop': StroopGame,
  'flanker-attack': FlankerAttackGame,
  'vigilance': SustainedVigilanceGame,
  'visual-search': VisualSearchGame,
  'number-stream': NumberStreamGame,
  'arrow-rush': ArrowRushGame,
  'clock-face': ClockFaceGame,
  'chain-reaction': ChainReactionGame,
  'word-pairs': WordPairRecallGame,
  'pattern-focus': PatternFocusGame,
  'sequence-builder': SequenceBuilderGame,
  'flash-recall': FlashRecallGame,
};
export default function GamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [showBackButton, setShowBackButton] = useState(false);
  const game = GAMES.find(g => g.slug === gameId);
  
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [gameId]);

  useEffect(() => {
    const handleScroll = () => {
      // Show back button after scrolling down 50px
      setShowBackButton(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <h1 className="text-2xl font-bold">Game Not Found</h1>
        <Link to="/games" className="text-primary-600 dark:text-primary-400 hover:underline">
          Back to Games
        </Link>
      </div>
    );
  }

  const GameComponent = GAME_COMPONENTS[game.id];

  return (
    <div className="animate-fade-in pb-safe">
      {/* Game container */}
      <div className="mx-2 sm:mx-3 mt-2">
        {GameComponent && <GameComponent gameId={game.id} howToPlay={game.howToPlay} />}
      </div>

      {/* Back button — hidden by default, appears on scroll */}
      <div className={`mt-8 mb-8 px-4 flex justify-center transition-opacity duration-300 ${showBackButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <Link
          to="/games"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors py-1 px-2 rounded-lg active:bg-slate-100 dark:active:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </Link>
      </div>
    </div>
  );
}
