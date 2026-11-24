import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Palette } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

const COLORS = [
  { name: 'RED', value: '#ef4444' },
  { name: 'BLUE', value: '#3b82f6' },
  { name: 'GREEN', value: '#22c55e' },
  { name: 'YELLOW', value: '#eab308' },
  { name: 'PURPLE', value: '#a855f7' },
];

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'preview' | 'playing' | 'complete';

interface WordState {
  text: string;
  colorName: string;
  inkColor: string;
}

interface RuleType {
  type: 'word' | 'ink';
  label: string;
  description: string;
  example: string;
}

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(correct: number, total: number): string {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.9) return 'Outstanding focus! Your brain handled the conflict with ease — that\'s top-tier inhibition control!';
  if (pct >= 0.7) return 'Great mental agility! Most responses were spot-on. Each round sharpens your cognitive flexibility.';
  if (pct >= 0.5) return 'Solid effort! The Stroop effect challenges everyone — you\'re training your brain to overcome it.';
  return 'Every wrong answer reveals a pattern your brain needs to learn. Next round will feel easier!';
}

export default function StroopGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message } = usePredictedDifficulty(gameId);

  const [config, setConfig] = useState({ score: 0, correct: 0, total: 0 });
  const [timeLeft, setTimeLeft] = useState(60);
  const [phase, setPhase] = useState<Phase>('instruction');
  const [hasStartedTimer, setHasStartedTimer] = useState(false);
  const [currentWord, setCurrentWord] = useState<WordState>(() => {
    const textIdx = Math.floor(Math.random() * COLORS.length);
    let colorIdx = Math.floor(Math.random() * COLORS.length);
    if (colorIdx === textIdx) colorIdx = (colorIdx + 1) % COLORS.length;
    return {
      text: COLORS[textIdx].name,
      colorName: COLORS[colorIdx].name,
      inkColor: COLORS[colorIdx].value,
    };
  });
  const [currentRule, setCurrentRule] = useState<RuleType>({ type: 'word', label: '🔤 Pick the WORD', description: 'Tap the button matching the TEXT meaning', example: 'E.g., "BLUE" in red ink → tap BLUE' });
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const lastSpawnTimeRef = useRef(0);
  const finishGameRef = useRef<() => void>();
  const totalAnswersRef = useRef(0);
  // Enable mid-game rule switching only for experienced players (not novices)
  const enableRuleSwitching = masteryScore > 0 && tier !== 'novice';

  const generateWord = useCallback((): WordState => {
    const textIdx = Math.floor(Math.random() * COLORS.length);
    let colorIdx = Math.floor(Math.random() * COLORS.length);
    if (Math.random() > 0.3 && colorIdx === textIdx) {
      colorIdx = (colorIdx + 1) % COLORS.length;
    }
    return {
      text: COLORS[textIdx].name,
      colorName: COLORS[colorIdx].name,
      inkColor: COLORS[colorIdx].value,
    };
  }, []);

  const pickRandomRule = useCallback((): RuleType => {
    const rules: RuleType[] = [
      { 
        type: 'word', 
        label: '🔤 Pick the WORD', 
        description: 'Tap the button matching the TEXT meaning', 
        example: 'E.g., "BLUE" in red ink → tap BLUE' 
      },
      { 
        type: 'ink', 
        label: '🎨 Pick the INK COLOR', 
        description: 'Tap the button matching the COLORED TEXT', 
        example: 'E.g., "BLUE" in red ink → tap RED' 
      },
    ];
    return rules[Math.floor(Math.random() * rules.length)];
  }, []);

  const startGame = useCallback(() => {
    const rule = pickRandomRule();
    setConfig({ score: 0, correct: 0, total: 0 });
    setTimeLeft(60);
    setHasStartedTimer(false);
    setReactionTimes([]);
    setCurrentRule(rule);
    setCurrentWord(generateWord());
    totalAnswersRef.current = 0;
    setPhase('instruction');
  }, [generateWord, pickRandomRule]);

  const beginPlaying = useCallback(() => {
    const rule = pickRandomRule();
    setCurrentRule(rule);
    setPhase('playing');
    setHasStartedTimer(false);
    setTimeLeft(60);
    setCurrentWord(generateWord());
    lastSpawnTimeRef.current = Date.now();
    totalAnswersRef.current = 0;
  }, [generateWord, pickRandomRule]);

  // Timer starts only after the first answer is given
  useEffect(() => {
    if (phase !== 'playing' || !hasStartedTimer) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          finishGameRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, hasStartedTimer]);

  const handleSubmit = useCallback((answerName: string) => {
    if (!hasStartedTimer) {
      setHasStartedTimer(true);
    }

    const isCorrect = currentRule.type === 'word' 
      ? answerName === currentWord.text
      : answerName === currentWord.colorName;
    
    const reactionTime = Date.now() - lastSpawnTimeRef.current;
    
    if (isCorrect) {
      soundEnabled && playSound('correct');
      setReactionTimes(prev => [...prev, reactionTime]);
      setConfig(prev => ({
        ...prev,
        score: prev.score + 10,
        correct: prev.correct + 1,
        total: prev.total + 1
      }));
    } else {
    soundEnabled && playSound('wrong');
      setConfig(prev => ({ ...prev, total: prev.total + 1 }));
    }
    
    setCurrentWord(generateWord());
    lastSpawnTimeRef.current = Date.now();
    totalAnswersRef.current += 1;

    // Switch rule every 5 answers for experienced players
    if (enableRuleSwitching && totalAnswersRef.current % 5 === 0) {
      setCurrentRule(prev => ({
        type: prev.type === 'word' ? 'ink' : 'word',
        label: prev.type === 'word' ? '🎨 Pick the INK COLOR' : '🔤 Pick the WORD',
        description: prev.type === 'word' ? 'Tap the button matching the COLORED TEXT' : 'Tap the button matching the TEXT meaning',
        example: prev.type === 'word' ? 'E.g., "BLUE" in red ink → tap RED' : 'E.g., "BLUE" in red ink → tap BLUE',
      }));
    }
  }, [currentWord, currentRule, generateWord, hasStartedTimer, enableRuleSwitching]);

  const finishGame = useCallback(() => {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    const avgReaction = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    
    recordSession(
      {
        id: _uuid(),
        userId: null,
        gameId,
        score: config.score,
        accuracy,
        difficultyLevel: 1,
        metrics: { correct: config.correct, total: config.total, avgReaction },
      },
      { highScore: Math.max(config.score, 0), bestAccuracy: accuracy, averageDifficulty: 1 },
    );

    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [gameId, config, reactionTimes, recordSession]);

  // Keep finishGameRef in sync so the timer interval always calls the latest version
  useEffect(() => {
    finishGameRef.current = finishGame;
  }, [finishGame]);

  // Instruction
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return (
        <DifficultyPreview
          tier={tier}
          masteryScore={masteryScore}
          message={message}
          howToPlay={howToPlay}
          onStart={beginPlaying}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl">
            <Palette className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
            Stroop Challenge
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
            A word appears in colored ink. Follow the rule each round — test your inhibition control!
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 w-full max-w-xs space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">How it works:</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-rose-500 font-bold mt-0.5 shrink-0">W</span>
              <p className="text-slate-600 dark:text-slate-300"><strong>WORD rule:</strong> Ignore the ink color. Tap the button matching the <em>text</em>.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 font-bold mt-0.5 shrink-0">I</span>
              <p className="text-slate-600 dark:text-slate-300"><strong>INK rule:</strong> Ignore the text meaning. Tap the button matching the <em>color</em>.</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-1">The timer starts when you tap your first answer.</p>
        </div>
        
        <Button size="lg" onClick={() => setPhase('preview')} className="w-full max-w-xs">
          Start (60s)
        </Button>
      </div>
    );
  }

  // Preview
  if (phase === 'preview') {
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl">
            <Palette className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Round Prep</h2>
          
          <div className={`inline-flex flex-col items-center gap-3 px-5 sm:px-6 py-4 rounded-2xl border-2 ${
            currentRule.type === 'word'
              ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}>
            <p className={`text-lg sm:text-xl font-bold ${
              currentRule.type === 'word' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
            }`}>{currentRule.label}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center max-w-[260px]">{currentRule.description}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{currentRule.example}</p>
          </div>
        </div>
        
        <Button size="lg" onClick={beginPlaying} className="w-full max-w-xs">
          Begin! ({currentRule.label})
        </Button>
      </div>
    );
  }

  // Complete
  if (phase === 'complete') {
    const accuracy = config.total > 0 ? (config.correct / config.total) * 100 : 0;
    const avgReaction = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    const msg = getEncouragement(config.correct, config.total);
    
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">🧠</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
          Game Over
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{msg}</p>
        
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
            <p className="text-xl sm:text-2xl font-bold">{Math.round(accuracy)}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700 text-center min-w-[80px] shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400">Avg RT</p>
            <p className="text-sm sm:text-2xl font-bold whitespace-pre">{avgReaction}<span className="text-xs normal-case">ms</span></p>
          </div>
        </div>
        
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          {config.correct} out of {config.total} correct
        </p>

        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-lg font-black px-3 py-1 rounded-full text-white ${
              tier === 'novice' ? 'bg-emerald-500' :
              tier === 'explorer' ? 'bg-blue-500' :
              tier === 'master' ? 'bg-violet-500' :
              tier === 'grandmaster' ? 'bg-amber-500' :
              'bg-rose-500'
            }`}>{tier.toUpperCase()}</span>
            <div className="flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Mastery Score</p>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${masteryScore}%`,
                    background: tier === 'novice' ? '#10b981' :
                                tier === 'explorer' ? '#3b82f6' :
                                tier === 'master' ? '#8b5cf6' :
                                tier === 'grandmaster' ? '#f59e0b' : '#f43f5e',
                  }}
                />
              </div>
              <p className="text-right text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{masteryScore}/100</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>

        <Button size="lg" onClick={startGame} className="w-full max-w-xs">
          Try Again
        </Button>
      </div>
    );
  }

  // Playing
  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto p-3 sm:p-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      {/* Compact stats bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0">
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
          <p className="text-lg sm:text-xl font-bold">{config.score}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Time</p>
          <p className={`text-lg sm:text-xl font-bold ${timeLeft <= 10 && hasStartedTimer ? 'text-red-500 animate-pulse' : ''}`}>{timeLeft}s</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Round</p>
          <p className="text-lg sm:text-xl font-bold">{config.total + 1}</p>
        </div>
      </div>
      
      {/* Active rule indicator */}
      <div className={`mx-auto mt-3 text-center py-1.5 px-4 rounded-full text-xs sm:text-sm font-semibold shrink-0 shadow-sm ${
        currentRule.type === 'word' 
          ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
      }`}>
        <span className="font-bold text-lg">{currentRule.label}</span>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{currentRule.description}</p>
      </div>
      
      {/* Word display */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 my-auto py-6">
        <p 
          className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-wider text-center select-none"
          style={{ color: currentWord.inkColor }}
        >
          {currentWord.text}
        </p>
      </div>
      
      {/* Color buttons */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3 pb-2 w-full shrink-0">
        {COLORS.map(color => (
          <button
            key={color.name}
            onClick={() => handleSubmit(color.name)}
            className="flex items-center justify-center h-16 sm:h-20 px-1 rounded-xl font-bold text-white transition-transform hover:scale-105 active:scale-95 touch-manipulation shadow-md text-[10px] sm:text-sm"
            style={{ backgroundColor: color.value }}
          >
            {color.name}
          </button>
        ))}
      </div>
    </div>
  );
}
