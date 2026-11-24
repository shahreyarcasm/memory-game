import { useMemo } from 'react';
import { GAMES } from '../data/games';
import { useAppStore } from '../store/app';
import { ArrowLeft, Award, Target, TrendingUp, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Derive a single player-level number (1–10) from aggregate skill data.
 *
 * High standards: mastery dominates the calculation.
 * - Each ~10% mastery bump = +1 level (skill is the main driver)
 * - Sessions contribute minimally: 50+ sessions = +1, 100+ = +2
 * - This means even marathon players stay at lower levels without strong accuracy
 */
function computeGlobalLevel(totalPlays: number, avgMastery: number): number {
  const masteryLevel = Math.floor(avgMastery / 10);              // 0–10 from mastery alone
  const playBonus    = totalPlays >= 100 ? 2 : totalPlays >= 50 ? 1 : 0; // max +2 extra
  return Math.min(10, Math.max(1, masteryLevel + playBonus));
}

function getLevelStyle(level: number) {
  if (level <= 2) return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', label: 'Novice' };
  if (level <= 4) return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Explorer' };
  if (level <= 6) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Skilled' };
  if (level <= 8) return { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', label: 'Master' };
  return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Elite' }; // Level 9–10
}

export default function Stats() {
  const userStats = useAppStore((s) => s.userStats);
  const sessionHistory = useAppStore((s) => s.sessionHistory);
  const globalSkillScore = useAppStore((s) => s.globalSkillScore);

  const globalLevel = useMemo(() => computeGlobalLevel(globalSkillScore.totalPlayCount, globalSkillScore.averageMasteryAcrossGames), [globalSkillScore]);
  const levelStyle = getLevelStyle(globalLevel);

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

      {/* Global Player Level */}
      {globalSkillScore.totalPlayCount > 0 && (
        <div className={`rounded-2xl border-2 p-5 flex items-center gap-4 ${levelStyle.bg}`}>
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Global Player Level</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-3xl font-black ${levelStyle.text}`}>Level {globalLevel}</span>
              <span className={`text-sm font-medium ${levelStyle.text} opacity-80`}>{levelStyle.label}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {globalSkillScore.totalPlayCount} sessions · {Math.round(globalSkillScore.averageMasteryAcrossGames)}% avg mastery
            </p>
          </div>
          <div className="hidden sm:flex flex-col gap-1 items-end">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < globalLevel ? 'bg-violet-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>
        </div>
      )}

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
                return (
                  <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      <span className="text-xl">{game.icon}</span>
                      <span>{game.title}</span>
                    </td>
                    <td className="px-6 py-4 text-right">{stats?.highScore ?? 0}</td>
                    <td className="px-6 py-4 text-right">{stats ? `${Math.round(stats.bestAccuracy)}%` : '—'}</td>
                    <td className="px-6 py-4 text-right">{stats?.totalPlays ?? 0}</td>
                    <td className="px-6 py-4 text-right">
                      {stats ? (
                        <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                          L{Math.round(stats.averageDifficulty)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">Not played</span>
                      )}
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
