import { Brain } from 'lucide-react';
import type { Tier } from '../../types/difficulty';
import { TIER_STYLES } from '../../types/difficulty';

interface Props {
  tier: Tier;
  masteryScore: number;
  message: string;
  onStart: () => void;
  onCancel?: () => void;
  howToPlay?: string;
}

export default function DifficultyPreview({ tier, masteryScore, message, onStart, onCancel, howToPlay }: Props) {
  const style = TIER_STYLES[tier];
  return (
    <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-[calc(100dvh-80px)]">
      <div className="text-center space-y-3 w-full max-w-sm">
        <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg ${style.bg}`}>
          <Brain className="w-8 h-8 text-slate-700 dark:text-slate-200" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Your Predicted Level</h2>
        <div className={`inline-flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border-2 ${style.bg} border-current`}>
          <span className="text-3xl">{style.emoji}</span>
          <p className={`text-xl font-black uppercase tracking-widest ${style.color}`}>
            {tier.charAt(0).toUpperCase() + tier.slice(1)}
          </p>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${masteryScore}%`, backgroundColor: 'currentColor' }}
            />
          </div>
          <p className={`text-xs font-semibold ${style.color}`}>{masteryScore}% mastery score</p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-2">{message}</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {howToPlay && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
          </div>
        )}
        <button
          onClick={onStart}
          className="w-full py-3 rounded-xl font-bold text-white text-base bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md active:scale-95 transition-transform"
        >
          Start Challenge
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full py-2 rounded-xl font-medium text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            Skip — play at my own pace
          </button>
        )}
      </div>
    </div>
  );
}
