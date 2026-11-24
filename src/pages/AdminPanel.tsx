import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/app';
import type { DifficultyThresholds, GameSkillScore } from '../types/difficulty';
import { TIERS, TIER_STYLES } from '../types/difficulty';
import { GAMES } from '../data/games';
import { computeGlobalScore } from '../utils/difficultyEngine';
import { LogOut } from 'lucide-react';

export default function AdminPanel() {
  const { gameSkillScores, difficultyThresholds, setDifficultyThresholds, sessionHistory, resetAllData, adminLogout } = useAppStore();
  const navigate = useNavigate();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editThresholds, setEditThresholds] = useState<DifficultyThresholds>(difficultyThresholds);
  const [saved, setSaved] = useState(false);

  const handleSignOut = () => {
    adminLogout();
    navigate('/');
  };

  const handleSaveThresholds = () => {
    setDifficultyThresholds(editThresholds);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetAllData();
    setShowResetConfirm(false);
  };

  const allSkills = Object.values(gameSkillScores) as GameSkillScore[];
  const global = computeGlobalScore(allSkills);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header with Sign Out */}
      <div className="flex items-center justify-between">
        <div className="text-center space-y-2 flex-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">⚙️ Game Admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Adjust difficulty thresholds and view player skill data
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Global Skill Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">🌐 Global Skill Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{global.totalPlayCount}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Avg Mastery</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{global.averageMasteryAcrossGames}%</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Highest Tier</p>
            <p className="text-xl font-bold">{TIER_STYLES[global.highestTier]?.emoji} {global.highestTier.charAt(0).toUpperCase() + global.highestTier.slice(1)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">Games Tracked</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{allSkills.length}</p>
          </div>
        </div>
      </div>

      {/* Per-Game Skills */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">📊 Per-Game Skill Scores</h2>
        {allSkills.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No games played yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-4">Game</th>
                  <th className="pb-2 pr-4">Tier</th>
                  <th className="pb-2 pr-4">Mastery</th>
                  <th className="pb-2 pr-4">EMA Acc</th>
                  <th className="pb-2 pr-4">Consistency</th>
                  <th className="pb-2">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {allSkills.map(skill => {
                  const game = GAMES.find(g => g.id === skill.gameId);
                  const tierStyle = TIER_STYLES[skill.currentTier];
                  return (
                    <tr key={skill.gameId} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 pr-4 font-medium">{game?.title ?? skill.gameId}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierStyle?.bg} ${tierStyle?.color}`}>
                          {tierStyle?.emoji} {skill.currentTier}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                          <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(skill.masteryScore, 100)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{skill.masteryScore}%</span>
                      </td>
                      <td className="py-2 pr-4">{skill.emaAccuracy}%</td>
                      <td className="py-2 pr-4">{Math.round(skill.consistency * 100)}%</td>
                      <td className="py-2">{skill.sessionHistory.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Threshold Editor */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">🎯 Difficulty Thresholds</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          These control when the system upgrades or downgrades a player's tier for any game.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Upgrade Accuracy Threshold (%)
            </label>
            <input
              type="number"
              min={50}
              max={99}
              value={editThresholds.masteryUpgradeAccuracy}
              onChange={e => setEditThresholds({ ...editThresholds, masteryUpgradeAccuracy: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Sessions must hit this accuracy to qualify for upgrade</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Upgrade Streak (sessions)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={editThresholds.masteryUpgradeStreak}
              onChange={e => setEditThresholds({ ...editThresholds, masteryUpgradeStreak: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Consecutive qualifying sessions before promotion</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Degrade Accuracy Floor (%)
            </label>
            <input
              type="number"
              min={10}
              max={70}
              value={editThresholds.masteryDegradeAccuracy}
              onChange={e => setEditThresholds({ ...editThresholds, masteryDegradeAccuracy: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Sessions below this trigger downgrade consideration</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Degrade Streak (sessions)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={editThresholds.masteryDegradeStreak}
              onChange={e => setEditThresholds({ ...editThresholds, masteryDegradeStreak: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Consecutive low sessions before demotion</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Min Sessions Before Change
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={editThresholds.minSessionsBeforeChange}
              onChange={e => setEditThresholds({ ...editThresholds, minSessionsBeforeChange: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Prevents rapid tier-flipping early on</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Speed Weight (0–0.5)
            </label>
            <input
              type="number"
              min={0}
              max={0.5}
              step={0.05}
              value={editThresholds.speedWeight}
              onChange={e => setEditThresholds({ ...editThresholds, speedWeight: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">How much speed contributes to mastery score</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSaveThresholds}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            {saved ? '✓ Saved!' : 'Save Thresholds'}
          </button>
          <button
            onClick={() => setEditThresholds(difficultyThresholds)}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-medium transition-colors"
          >
            Revert
          </button>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">🕐 Recent Sessions</h2>
        {sessionHistory.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No session history.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessionHistory.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-700/50">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {GAMES.find(g => g.id === s.gameId)?.title ?? s.gameId}
                </span>
                <div className="flex gap-4 text-slate-500 dark:text-slate-400">
                  <span>{s.score} pts</span>
                  <span>{Math.round(s.accuracy)}% acc</span>
                  <span className="text-xs">{new Date(s.playedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">⚠️ Danger Zone</h2>
        <p className="text-sm text-red-600 dark:text-red-300">
          Resetting clears all stats, skill scores, session history, and difficulty tiers.
        </p>
        {showResetConfirm ? (
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
            >
              Yes, Reset Everything
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Reset All Data
          </button>
        )}
      </div>

      {/* Tier Reference */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">📖 Tier Reference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIERS.map((tier, idx) => {
            const style = TIER_STYLES[tier];
            return (
              <div key={tier} className={`flex items-center gap-3 p-3 rounded-xl ${style.bg}`}>
                <span className="text-2xl">{style.emoji}</span>
                <div>
                  <p className={`font-bold capitalize ${style.color}`}>{tier}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tier {idx + 1} of {TIERS.length}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
