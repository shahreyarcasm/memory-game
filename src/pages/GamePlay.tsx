import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Target, Zap } from 'lucide-react';
import { GAMES } from '../data/games';
import { useAppStore } from '../store/app';
import DigitSpanGame from '../games/DigitSpanGame';
import SpatialMatrixGame from '../games/SpatialMatrixGame';
import CardPairsGame from '../games/CardPairsGame';
import StroopGame from '../games/StroopGame';
import ObjectLocationGame from '../games/ObjectLocationGame';
import RapidFlashGame from '../games/RapidFlashGame';

interface GameComponentProps {
  gameId: string;
}

const GAME_COMPONENTS: Record<string, React.FC<GameComponentProps>> = {
  'digit-span': DigitSpanGame,
  'spatial-matrix': SpatialMatrixGame,
  'card-pairs': CardPairsGame,
  'stroop': StroopGame,
  'object-location': ObjectLocationGame,
  'rapid-flash': RapidFlashGame,
};

export default function GamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const game = GAMES.find(g => g.slug === gameId);
  const userStats = useAppStore(s => s.userStats);
  
  if (!game) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4">Game Not Found</h1>
        <Link to="/games" className="text-primary-600 dark:text-primary-400 hover:underline">
          Back to Games
        </Link>
      </div>
    );
  }

  const stats = userStats[game.id];
  const GameComponent = GAME_COMPONENTS[game.id];

  return (
    <div className="animate-fade-in">
      <Link to="/games" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Games
      </Link>

      {/* Game Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-3xl">
              {game.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{game.title}</h1>
              <p className="text-gray-600 dark:text-gray-400">{game.description}</p>
            </div>
          </div>
          {stats && (
            <div className="text-right hidden sm:block">
              <p className="text-sm text-gray-500 dark:text-gray-400">Personal Best</p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.highScore}</p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="flex gap-6 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <StatItem icon={<Trophy className="w-4 h-4" />} label="High Score" value={stats.highScore.toString()} />
            <StatItem icon={<Target className="w-4 h-4" />} label="Best Accuracy" value={`${Math.round(stats.bestAccuracy)}%`} />
            <StatItem icon={<Zap className="w-4 h-4" />} label="Total Plays" value={stats.totalPlays.toString()} />
          </div>
        )}
      </div>

      {/* Game Component */}
      {GameComponent && <GameComponent gameId={game.id} />}
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-primary-600 dark:text-primary-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
