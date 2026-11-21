import { Link } from 'react-router-dom';
import { Brain, Zap, Trophy, TrendingUp } from 'lucide-react';
import { GAMES, CATEGORY_LABELS } from '../data/games';
import type { CognitiveCategory } from '../types/game';
import { useAppStore } from '../store/app';

export default function Home() {
  const userStats = useAppStore((s) => s.userStats);

  // Get recent activity
  const totalGamesPlayed = Object.values(userStats).reduce((sum, stat) => sum + stat.totalPlays, 0);
  const avgAccuracy = Object.values(userStats).length > 0
    ? Math.round(Object.values(userStats).reduce((sum, s) => sum + s.bestAccuracy, 0) / Object.values(userStats).length)
    : 0;
  const highestScore = Object.values(userStats).reduce((max, s) => Math.max(max, s.highScore), 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <section className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-6 shadow-lg">
          <Brain className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-primary-600 via-purple-600 to-accent-600 dark:from-primary-400 dark:via-purple-400 dark:to-accent-400 bg-clip-text text-transparent">
          Train Your Brain
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          Science-based memory games designed to improve your cognitive abilities. 
          Play daily, track progress, and challenge yourself.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/games"
            className="px-8 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
          >
            Start Playing
          </Link>
          <Link
            to="/stats"
            className="px-8 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
          >
            View Progress
          </Link>
        </div>
      </section>

      {/* Stats Cards */}
      {totalGamesPlayed > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Games Played"
            value={totalGamesPlayed.toString()}
            color="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            icon={<Trophy className="w-5 h-5" />}
            label="Best Score"
            value={highestScore.toString()}
            color="text-amber-600 dark:text-amber-400"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Avg Accuracy"
            value={`${avgAccuracy}%`}
            color="text-emerald-600 dark:text-emerald-400"
          />
        </section>
      )}

      {/* Featured Games */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recommended Games</h2>
          <Link to="/games" className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMES.slice(0, 3).map((game) => (
            <Link
              key={game.id}
              to={`/game/${game.slug}`}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${CATEGORY_LABELS[game.category as CognitiveCategory].includes('Memory') ? 'from-blue-500 to-cyan-500' : CATEGORY_LABELS[game.category as CognitiveCategory].includes('Attention') ? 'from-amber-500 to-orange-500' : CATEGORY_LABELS[game.category as CognitiveCategory].includes('Spatial') ? 'from-emerald-500 to-teal-500' : CATEGORY_LABELS[game.category as CognitiveCategory].includes('Reaction') ? 'from-rose-500 to-pink-500' : 'from-violet-500 to-purple-500'} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <span className="text-2xl">{game.icon}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{game.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">{game.description}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary-600 dark:text-primary-400">
                Play Now →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-gray-800 dark:to-gray-800 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Step number="1" title="Choose a Game" description="Select from our collection of science-backed cognitive training games." />
          <Step number="2" title="Play Daily" description="Complete quick sessions to exercise different brain functions." />
          <Step number="3" title="Track Progress" description="Watch your skills improve over time with detailed analytics." />
        </div>
      </section>

      {/* Learning Insights */}
      <section className="border-l-4 border-accent-500 pl-6 py-2">
        <h3 className="text-lg font-semibold mb-2">Did You Know?</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Research shows that consistent practice with working memory tasks can improve your ability to focus, 
          follow instructions, and retain information in daily life. Try playing for just 10 minutes a day!
        </p>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <div className={`flex items-center gap-3 mb-2 ${color}`}>
        {icon}
        <span className="text-sm font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white font-bold flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
    </div>
  );
}
