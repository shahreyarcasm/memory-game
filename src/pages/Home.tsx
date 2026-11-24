import { Link } from 'react-router-dom';
import { Brain, Zap, Trophy, TrendingUp } from 'lucide-react';
import { GAMES, CATEGORY_LABELS } from '../data/games';
import type { CognitiveCategory } from '../types/game';
import { useAppStore } from '../store/app';

const FACTS = [
  '🧠 Your brain uses about 20% of your total energy — that\'s a lot for an organ the size of a fist!',
  '⚡ Neuroplasticity means your brain physically changes every time you learn something new.',
  '🎯 The average human can hold about 7 items in their working memory at once (plus or minus 2).',
  '💤 Sleep is when your brain consolidates memories — that\'s why rest matters for learning!',
  '🏃 Exercise increases blood flow to the hippocampus, boosting memory and learning capacity.',
  '🎵 Learning to play an instrument strengthens connectivity between both brain hemispheres.',
  '🍫 Dark chocolate contains flavonoids that may improve cognitive function and blood flow to the brain.',
  '🔥 A 10-minute brain training session daily can lead to measurable improvements over time.',
  '📱 Screen breaks help prevent cognitive fatigue — try the 20-20-20 rule (every 20 min, look 20 ft away for 20 sec).',
  '🧘 Meditation has been shown to increase gray matter density in areas linked to memory and learning.',
  '🌊 Ocean waves at ~7 Hz (theta rhythm) may enhance creativity and memory recall — nature helps!',
  '😊 Positive emotions broaden your thought-action repertoire and enhance cognitive flexibility.',
  '💡 You\'re playing this game right now — your prefrontal cortex is getting a workout!',
  '🗣️ Talking through problems activates different neural pathways than silent thinking.',
  '🦠 Your gut microbiome communicates with your brain via the vagus nerve — eat well for sharp thinking!',
];

export default function Home() {
  const userStats = useAppStore((s) => s.userStats);

  // Get recent activity
  const totalGamesPlayed = Object.values(userStats).reduce((sum, stat) => sum + stat.totalPlays, 0);
  const avgAccuracy = Object.values(userStats).length > 0
    ? Math.round(Object.values(userStats).reduce((sum, s) => sum + s.bestAccuracy, 0) / Object.values(userStats).length)
    : 0;
  const highestScore = Object.values(userStats).reduce((max, s) => Math.max(max, s.highScore), 0);

  // Pick a random fact on each mount/session
  const randomFact = FACTS[Math.floor(Math.random() * FACTS.length)];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in px-3 sm:px-4 pb-4">
      {/* Hero Section */}
      <section className="text-center pt-4 sm:pt-8 pb-2">
        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4 sm:mb-6 shadow-lg">
          <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 dark:from-primary-400 dark:to-accent-400 bg-clip-text text-transparent mb-3 sm:mb-4 px-2">
          Train Your Brain
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto px-4 leading-relaxed">
          Scientifically-designed cognitive games to boost memory, attention, and processing speed.
          Just 10 minutes a day makes a difference.
        </p>
      </section>

      {/* Stats Overview */}
      {totalGamesPlayed > 0 && (
        <section className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 mx-auto mb-1 sm:mb-2" />
            <p className="text-xl sm:text-2xl font-bold">{highestScore}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">High Score</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <TargetIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mx-auto mb-1 sm:mb-2" />
            <p className="text-xl sm:text-2xl font-bold">{avgAccuracy}%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Avg Accuracy</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-violet-500 mx-auto mb-1 sm:mb-2" />
            <p className="text-xl sm:text-2xl font-bold">{totalGamesPlayed}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sessions</p>
          </div>
        </section>
      )}

      {/* Did you know? Fact */}
      <section className="mx-1 sm:mx-2">
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-2xl p-4 sm:p-5 border border-violet-200 dark:border-violet-800">
          <div className="flex items-start gap-3">
            <span className="text-xl sm:text-2xl flex-shrink-0 mt-0.5">💡</span>
            <div>
              <p className="font-semibold text-violet-700 dark:text-violet-300 mb-1 text-sm sm:text-base">Did you know?</p>
              <p className="text-xs sm:text-sm text-violet-600 dark:text-violet-400 leading-relaxed">{randomFact}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Game Categories & Grid */}
      <section className="space-y-6 sm:space-y-8 pb-6">
        {(['working-memory', 'attention', 'spatial', 'reaction', 'recall'] as CognitiveCategory[]).map(category => {
          const categoryGames = GAMES.filter(g => g.category === category);
          if (categoryGames.length === 0) return null;

          return (
            <div key={category}>
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                  {CATEGORY_LABELS[category]}
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {categoryGames.map(game => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function GameCard({ game }: { game: typeof GAMES[number] }) {
  const stats = useAppStore(s => s.userStats[game.slug]);

  return (
    <Link
      to={`/game/${game.slug}`}
      className="group block bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] min-h-[120px] sm:min-h-[130px]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform"
          style={{ background: `linear-gradient(135deg, ${game.color}20, ${game.color}40)` }}
        >
          <game.lucideIcon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: game.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm sm:text-base line-clamp-1">
            {game.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-snug">
            {game.description}
          </p>
          {stats && stats.totalPlays > 0 && (
            <div className="flex items-center gap-3 mt-2 sm:mt-3 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1 shrink-0">
                <TrendingUp className="w-3 h-3 shrink-0" />
                Best: {stats.highScore}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <Zap className="w-3 h-3 shrink-0" />
                {stats.totalPlays} played
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
