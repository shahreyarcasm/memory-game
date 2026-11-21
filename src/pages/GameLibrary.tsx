import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GAMES, CATEGORY_LABELS, CATEGORY_COLORS } from '../data/games';
import type { CognitiveCategory } from '../types/game';
import { useAppStore } from '../store/app';

export default function GameLibrary() {
  const userStats = useAppStore((s) => s.userStats);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(GAMES.map(g => g.category))];
  
  const filteredGames = selectedCategory === 'all' 
    ? GAMES 
    : GAMES.filter(g => g.category === selectedCategory);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Game Library</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Choose a game to train your cognitive skills
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary-300'
            }`}
          >
            {cat === 'all' ? 'All Games' : CATEGORY_LABELS[cat as CognitiveCategory]}
          </button>
        ))}
      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => {
          const stats = userStats[game.id];
          const colorMap: Record<string, string> = {
            'working-memory': 'blue',
            attention: 'amber',
            spatial: 'emerald',
            reaction: 'rose',
            recall: 'violet',
          };
          const color = colorMap[game.category] || 'gray';
          
          return (
            <Link
              key={game.id}
              to={`/game/${game.slug}`}
              className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg"
            >
              <div className={`h-32 bg-gradient-to-br ${CATEGORY_COLORS[game.category]} flex items-center justify-center`}>
                <span className="text-5xl group-hover:scale-110 transition-transform">{game.icon}</span>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-semibold">{game.title}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-300`}>
                    {CATEGORY_LABELS[game.category]}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{game.description}</p>
                {stats && (
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>Best: {stats.highScore}</span>
                    <span>Acc: {Math.round(stats.bestAccuracy)}%</span>
                    <span>Plays: {stats.totalPlays}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
