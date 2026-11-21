import { useMemo } from 'react';
import { GAMES } from '../data/games';
import { useAppStore } from '../store/app';
import { ArrowLeft, Award, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Stats() {
  const userStats = useAppStore((s) => s.userStats);
  const sessionHistory = useAppStore((s) => s.sessionHistory);

  const overview = useMemo(() => {
    const entries = Object.entries(userStats);
    return {
      totalSessions: entries.reduce((sum, [, s]) => sum + s.totalPlays, 0),
      averageAccuracy: entries.length > 0
        ? Math.round(entries.reduce((sum, [, s]) => sum + s.bestAccuracy, 0) / entries.length)
        : 0,
      totalHighScore: entries.reduce((sum, [, s]) => sum + s.highScore, 0),
      gamesPlayed: entries.length,
    };
  }, [userStats]);

  const recentSessions = sessionHistory.slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div>
        <h1 className="text-3xl font-bold mb-2">Your Progress</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your cognitive improvement over time
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <OverviewCard
          icon={<Award className="w-5 h-5" />}
          label="Total Sessions"
          value={overview.totalSessions.toString()}
        />
        <OverviewCard
          icon={<Target className="w-5 h-5" />}
          label="Avg Accuracy"
          value={`${overview.averageAccuracy}%`}
        />
        <OverviewCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Games Trained"
          value={overview.gamesPlayed.toString()}
        />
        <OverviewCard
          icon={<Award className="w-5 h-5" />}
          label="Peak Score"
          value={overview.totalHighScore.toString()}
        />
      </div>

      {/* Per-Game Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Skill Breakdown</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Game</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">High Score</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Accuracy</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plays</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {GAMES.map(game => {
                const stats = userStats[game.id];
                if (!stats) return null;
                return (
                  <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-6 py-4 font-medium">{game.title}</td>
                    <td className="px-6 py-4 text-right">{stats.highScore}</td>
                    <td className="px-6 py-4 text-right">{Math.round(stats.bestAccuracy)}%</td>
                    <td className="px-6 py-4 text-right">{stats.totalPlays}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                        L{Math.round(stats.averageDifficulty)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {Object.keys(userStats).length === 0 && (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No stats yet. Start playing games to see your progress!
            </div>
          )}
        </div>
      </div>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentSessions.map((session) => {
              const game = GAMES.find(g => g.id === session.gameId);
              return (
                <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xl">
                      {game?.icon}
                    </div>
                    <div>
                      <p className="font-medium">{game?.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(session.playedAt).toLocaleDateString()} at {new Date(session.playedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{session.score} pts</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round(session.accuracy)}% accuracy
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="text-primary-600 dark:text-primary-400 mb-2">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
