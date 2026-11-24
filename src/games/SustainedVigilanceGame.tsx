import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/app';
import Button from '../components/ui/Button';
import { Heart, Crosshair } from 'lucide-react';
import { usePredictedDifficulty } from '../hooks/usePredictedDifficulty';
import DifficultyPreview from '../components/difficulty/DifficultyPreview';
import { playSound } from '../utils/audio';

interface Props {
  gameId: string;
  howToPlay?: string;
}

type Phase = 'instruction' | 'preview' | 'playing' | 'complete';

interface Stimulus {
  id: string;
  x: number;
  y: number;
  type: 'target' | 'noGo';
  bornAt: number;      // timestamp in ms — when this stim entered the world
  expiresAt: number;   // timestamp in ms — when this stim must disappear
}

const STIMULUS_LIFETIME   = 4000;       // base constant used in default formula
const TAP_RADIUS          = 20;         // percentage-based distance threshold
const RED_TO_GREEN_DELAY  = 150;        // ms: green appears this long after red (surprise flanker)
// Escalation: every 10 s shrink visible lifetime by 10 %, floor 500 ms
const ESCALATION_STEP      = 0.90;
const ESCALATION_INTERVAL_MS = 10000;
const LIFETIME_FLOOR       = 500;
// Per-correct-hit shrink: proportional to remaining gap to floor (diminishing returns)
const HIT_SHRINK_PERCENT  = 0.02;       // 2 % of (current − floor) per hit
const MAX_LIVES            = 3;

// Helpers
function tierIndex(t: 'novice' | 'explorer' | 'master' | 'grandmaster' | 'legend'): number {
  return ['novice', 'explorer', 'master', 'grandmaster', 'legend'].indexOf(t);
}

function _uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEncouragement(targetsHit: number, livesLeft: number, falseAlarms: number): string {
  if (targetsHit >= 30 && livesLeft > 0) return 'Phenomenal sustained attention! You stayed locked in the whole time.';
  if (livesLeft === 0 && targetsHit >= 20) return 'Great focus! Three strikes and you\'re out — keep that concentration going.';
  if (livesLeft === 0 && falseAlarms <= 2) return 'Almost there! Your reaction speed is strong — just hold back on the red ✕s next time.';
  if (targetsHit < 10) return 'Every session builds your attention muscle. Try to stay present even when the pace picks up!';
  return 'Solid effort! Each round you\'ll find your rhythm — keep tracking the green and ignore the traps.';
}

export default function SustainedVigilanceGame({ gameId, howToPlay }: Props) {
  const recordSession = useAppStore(s => s.recordSession);
  const soundEnabled  = useAppStore(s => s.soundEnabled);
  const { tier, masteryScore, message, params } = usePredictedDifficulty(gameId);

  // Tier-based base parameters
  const ti       = tierIndex(tier);
  const baseStimulusLife = (params.stimulusLife as number) ?? Math.max(LIFETIME_FLOOR, STIMULUS_LIFETIME / 3 - ti * 80);
  // Red no-go ratio comes from the engine: 1 − targetRatio
  const redSurpriseRatio = typeof (params.targetRatio as number) === 'number'
    ? 1 - (params.targetRatio as number)
    : 0.25;

  const phaseRef      = useRef<Phase>('instruction');
  const [phase,       setPhase]      = useState<Phase>('instruction');
  const [config,      setConfig]     = useState({ score: 0, targetsHit: 0, misses: 0, falseAlarms: 0 });
  const [lives,       setLives]      = useState(MAX_LIVES);
  const [elapsed,     setElapsed]    = useState(0);
  const [stimuli,     setStimuli]    = useState<Stimulus[]>([]);
  const [now,         setNow]        = useState(Date.now());
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);

  const tickRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const escalateRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef    = useRef(false);
  // Mutable: current stimulus lifetime (adaptive)
  const stimLifeRef    = useRef(baseStimulusLife);
  // Pending auto-expire timeout — there is AT MOST ONE at any time
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mutable: current lives (kept in sync with state for timer callbacks)
  const livesRef       = useRef(MAX_LIVES);
  // Next-stimulus id guard: prevents the expire callback from double-spawning
  // after the tap handler has already placed a replacement.
  const nextStimIdRef  = useRef<string | null>(null);
  // Expiry serial: incremented each time startExpire is called; stale timers bail out
  const expireSerialRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const stopAllTimers = useCallback(() => {
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    expireTimerRef.current = null;
    if (escalateRef.current) clearInterval(escalateRef.current);
    escalateRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    finishedRef.current = true;
  }, []);

  /**
   * The SINGLE source of truth for placing stimuli on screen.
   * Guards against double-placement: only proceeds when the field is empty
   * AND the expected next-stim id hasn't already been claimed by the tap handler.
   */
  const scheduleNext = useCallback(() => {
    if (finishedRef.current) return false;
    // Must be alone on screen
    setStimuli(prev => {
      if (prev.length > 0) return prev; // someone else already placed one
      const life = stimLifeRef.current;
      const now  = Date.now();
      const isSurprise = Math.random() < redSurpriseRatio;

      if (!isSurprise) {
        const expiresAt = now + life;
        const stim: Stimulus = {
          id: _uuid(),
          x: 18 + Math.random() * 64,
          y: 14 + Math.random() * 68,
          type: 'target',
          bornAt: now,
          expiresAt,
        };
        startExpire(life);
        return [stim];
      } else {
        const noGo: Stimulus = {
          id: _uuid(),
          x: 6 + Math.random() * 88,
          y: 4 + Math.random() * 88,
          type: 'noGo',
          bornAt: now,
          expiresAt: now + life,
        };
        const green: Stimulus = {
          id: _uuid(),
          x: 18 + Math.random() * 64,
          y: 14 + Math.random() * 68,
          type: 'target',
          bornAt: now + RED_TO_GREEN_DELAY,
          expiresAt: now + life,
        };
        startExpire(life);
        return [noGo, green];
      }
    });
    return true;
  }, []);

  /**
   * Set up the auto-expire timeout for the current stim batch.
   * Tracks an expirySerial so stale timers can detect they've been superseded
   * and bail out before deducting a second life.
   */
  function startExpire(_ignoredLifeHint: number) {
    const mySerial = ++expireSerialRef.current;
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    expireTimerRef.current = window.setTimeout(() => {
      expireTimerRef.current = null;
      // If a newer timer was scheduled after this one was created, bail out
      if (mySerial !== expireSerialRef.current) return;
      if (finishedRef.current) return;
      // Read current state inside updater — never rely on stale closure
      setStimuli(prev => {
        if (finishedRef.current) return prev;
        // Guard: tap handler already spawned the next stim → don't double-spawn
        if (nextStimIdRef.current !== null) {
          nextStimIdRef.current = null;
          return prev; // tap handled it
        }
        // Find targets whose deadline has passed in current state
        const now = Date.now();
        const missedTargets = prev.filter(s => s.type === 'target' && s.expiresAt <= now);
        if (missedTargets.length > 0) {
          const newLives = --livesRef.current;
          setLives(newLives);
          setConfig(c => ({ ...c, misses: c.misses + 1 }));
          if (newLives <= 0) setTimeout(() => finishGame(), 0);
        }
        // Clear field and trigger next (single source of truth)
        return [];
      });
      if (!finishedRef.current) scheduleNext();
    }, _ignoredLifeHint);
  }

  const startGame = useCallback(() => {
    finishedRef.current = false;
    stimLifeRef.current = baseStimulusLife;
    livesRef.current = MAX_LIVES;
    nextStimIdRef.current = null;
    expireSerialRef.current = 0;
    setConfig({ score: 0, targetsHit: 0, misses: 0, falseAlarms: 0 });
    setLives(MAX_LIVES);
    setElapsed(0);
    setStimuli([]);
    setNow(Date.now());
    setReactionTimes([]);
    setPhase('instruction');
  }, [baseStimulusLife]);

  const finishGame = useCallback(() => {
    stopAllTimers();
    const totalResponses = config.targetsHit + config.misses + config.falseAlarms;
    const accuracy = totalResponses > 0 ? (config.targetsHit / totalResponses) * 100 : 0;
    const avgReaction = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : null;

    recordSession(
      {
        id: _uuid(), userId: null, gameId, score: config.score, accuracy,
        difficultyLevel: ti + 1,
        metrics: { avgReactionMs: avgReaction ?? undefined, time: elapsed },
      },
      { highScore: Math.max(config.score, 0), bestAccuracy: accuracy, averageDifficulty: ti + 1 },
    );
    soundEnabled && playSound('complete');
    setPhase('complete');
  }, [config, ti, reactionTimes, elapsed, recordSession, soundEnabled, stopAllTimers]);

  // Core loop — kick off the first stimulus
  const beginPlaying = useCallback(() => {
    finishedRef.current = false;
    stimLifeRef.current = baseStimulusLife;
    livesRef.current = MAX_LIVES;
    nextStimIdRef.current = null;
    expireSerialRef.current = 0;
    setPhase('playing');
    setElapsed(0);
    setStimuli([]);
    setNow(Date.now());
    setReactionTimes([]);

    scheduleNext();

    tickRef.current = setInterval(() => {
      if (!finishedRef.current) setNow(Date.now());
    }, 150);

    // Elapsed-time pacemaker (informational only — game ends on 3 strikes)
    const startedAt = Date.now();
    const elapsedTick = setInterval(() => {
      if (finishedRef.current) return;
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    // Mid-game escalation: shrink lifetime every 10 s toward floor
    escalateRef.current = setInterval(() => {
      if (finishedRef.current) return;
      stimLifeRef.current = Math.max(LIFETIME_FLOOR, stimLifeRef.current * ESCALATION_STEP);
    }, ESCALATION_INTERVAL_MS);

    return () => { clearInterval(elapsedTick); };
  }, [baseStimulusLife, scheduleNext]);

  // One-shot cleanup
  useEffect(() => {
    return () => { stopAllTimers(); };
  }, [stopAllTimers]);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleFieldTap = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (phase !== 'playing') return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.changedTouches[0]?.clientX ?? e.touches[0]?.clientX ?? 0;
      clientY = e.changedTouches[0]?.clientY ?? e.touches[0]?.clientY ?? 0;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const tapX = ((clientX - rect.left) / rect.width) * 100;
    const tapY = ((clientY - rect.top) / rect.height) * 100;

    // Live stimuli: those whose deadline hasn't passed yet
    const now = Date.now();
    const live = stimuli.filter(s => s.expiresAt > now);

    let nearest: Stimulus | null = null;
    let nearestDist = Infinity;
    for (const s of live) {
      const d = Math.sqrt((tapX - s.x) ** 2 + (tapY - s.y) ** 2);
      if (d < TAP_RADIUS && d < nearestDist) {
        nearestDist = d;
        nearest = s;
      }
    }

    // Tap on empty space with no nearby stimulus — free action, no penalty
    if (!nearest) return;

    // Cancel the pending auto-expire so it can't stack after tap
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current);
      expireTimerRef.current = null;
    }
    // Claim the next-slot so the expire callback knows not to double-spawn
    nextStimIdRef.current = null;

    if (nearest.type === 'target') {
      // ═══ CORRECT: tapped green target ═══
      const rt = Date.now() - nearest.bornAt;
      setReactionTimes(prev => [...prev, rt]);
      soundEnabled && playSound('correct');
      setConfig(c => ({ ...c, targetsHit: c.targetsHit + 1, score: c.score + 10 }));
      // Shrink lifetime proportionally to remaining gap — slows as floor is approached
      const gap = stimLifeRef.current - LIFETIME_FLOOR;
      stimLifeRef.current = Math.max(LIFETIME_FLOOR, stimLifeRef.current - gap * HIT_SHRINK_PERCENT);
      // Replace current stim with fresh one immediately — zero dead air
      setStimuli(() => {
        const life = stimLifeRef.current;
        const now  = Date.now();
        const next: Stimulus = {
          id: _uuid(),
          x: 18 + Math.random() * 64,
          y: 14 + Math.random() * 68,
          type: 'target',
          bornAt: now,
          expiresAt: now + life,
        };
        nextStimIdRef.current = next.id;
        startExpire(life);
        return [next];
      });
    } else {
      // ═══ WRONG: tapped red no-go ═══
      soundEnabled && playSound('wrong');
      setConfig(c => ({ ...c, falseAlarms: c.falseAlarms + 1 }));
      // Lose a life — difficulty does NOT change (per design: wrong-response is pure penalty)
      setLives(prev => {
        const next = prev - 1;
        livesRef.current = next;
        if (next <= 0) {
          setTimeout(() => finishGame(), 0);
        }
        return next;
      });
      // Spawn fresh green target immediately so flow never breaks
      setStimuli(() => {
        const life = stimLifeRef.current;
        const now  = Date.now();
        const next: Stimulus = {
          id: _uuid(),
          x: 18 + Math.random() * 64,
          y: 14 + Math.random() * 68,
          type: 'target',
          bornAt: now,
          expiresAt: now + life,
        };
        nextStimIdRef.current = next.id;
        startExpire(life);
        // Clear any lingering extras, replace with exactly one fresh target
        return [next];
      });
    }
  }, [phase, stimuli, soundEnabled, scheduleNext, finishGame]);

  // ── Instruction ───────────────────────────────────────────────────────────
  if (phase === 'instruction') {
    if (masteryScore > 0) {
      return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} howToPlay={howToPlay} onStart={beginPlaying} />;
    }
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8" style={{ minHeight: 'calc(100dvh - 56px)' }}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl">
            <Crosshair className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
            Sustained Vigilance
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed text-center">
            A green ● appears — tap it fast! Occasionally a red ✕ flashes alongside it as a trap — ignore the red, tap the green. You have <strong>3 lives</strong>. Tap a red or miss a green and you lose one. How long can you stay locked in?
          </p>
          {howToPlay && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 w-full max-w-xs mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">How to Play</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{howToPlay}</p>
            </div>
          )}
        </div>
        <Button size="lg" onClick={() => setPhase('preview')} className="w-full max-w-xs">Start</Button>
      </div>
    );
  }

  if (phase === 'preview') {
    return <DifficultyPreview tier={tier} masteryScore={masteryScore} message={message} onStart={beginPlaying} />;
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    const totalResponses = config.targetsHit + config.misses + config.falseAlarms;
    const accuracy = totalResponses > 0 ? (config.targetsHit / totalResponses) * 100 : 0;
    const avgReaction = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : null;
    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 animate-fade-in px-4 py-8 min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-4xl sm:text-5xl mb-1">🎯</div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">Finished!</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 italic text-center max-w-xs">{getEncouragement(config.targetsHit, lives, config.falseAlarms)}</p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-sm px-2">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-xl font-bold text-primary-600 dark:text-primary-400">{config.score}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Targets Hit</p><p className="text-xl font-bold text-emerald-500">{config.targetsHit}</p></div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-center shadow-sm"><p className="text-xs text-slate-500 dark:text-slate-400">Lives Left</p><p className="text-xl font-bold text-red-500">{lives}</p></div>
        </div>
        {avgReaction != null && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Accuracy: {Math.round(accuracy)}% · Avg response: <span className="font-bold text-violet-500">{avgReaction} ms</span> · {config.misses} misses · {config.falseAlarms} false alarms · {elapsed}s elapsed
          </p>
        )}
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-lg font-black px-3 py-1 rounded-full text-white ${tier === 'novice' ? 'bg-emerald-500' : tier === 'explorer' ? 'bg-blue-500' : tier === 'master' ? 'bg-violet-500' : tier === 'grandmaster' ? 'bg-amber-500' : 'bg-rose-500'}`}>{tier.toUpperCase()}</span>
            <div className="flex-1"><p className="text-xs text-slate-500 dark:text-slate-400">Mastery Score</p><div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${masteryScore}%`, background: tier === 'novice' ? '#10b981' : tier === 'explorer' ? '#3b82f6' : tier === 'master' ? '#8b5cf6' : tier === 'grandmaster' ? '#f59e0b' : '#f43f5e' }} /></div><p className="text-right text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">{masteryScore}/100</p></div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <Button size="lg" onClick={startGame} className="w-full max-w-xs">Try Again</Button>
      </div>
    );
  }

  // ── Playing field ─────────────────────────────────────────────────────────
  const nowForRender = now;
  const visibleStims = stimuli.filter(s => s.expiresAt > nowForRender);

  return (
    <div className="flex flex-col justify-between max-w-xl mx-auto p-3 sm:p-4 w-full" style={{ minHeight: 'calc(100dvh - 80px)' }}>
      {/* HUD */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 flex justify-around shadow-sm shrink-0">
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Score</p><p className="text-lg sm:text-xl font-bold">{config.score}</p></div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Lives</p>
          <div className="flex gap-0.5 justify-center mt-0.5">
            {[...Array(MAX_LIVES)].map((_, i) => (
              <Heart key={i} className={`w-4 h-4 ${i < lives ? 'text-red-500 fill-red-500' : 'text-slate-300 dark:text-slate-600'}`} />
            ))}
          </div>
        </div>
        <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">Hit</p><p className="text-lg sm:text-xl font-bold text-emerald-500">{config.targetsHit}</p></div>
      </div>

      {/* Tap area */}
      <div
        className="flex-1 relative my-2 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 touch-none select-none"
        onClick={handleFieldTap}
      >
        {visibleStims.map(stim => {
          const ageMs = now - stim.bornAt;
          const life = stimLifeRef.current;
          const fadeOut = ageMs > life * 0.65
            ? Math.max(0, 1 - (ageMs - life * 0.65) / (life * 0.35))
            : 1;
          const isTarget = stim.type === 'target';
          return (
            <div
              key={stim.id}
              className="absolute rounded-full flex items-center justify-center shadow-lg"
              style={{
                left: `${stim.x}%`,
                top: `${stim.y}%`,
                transform: 'translate(-50%, -50%)',
                width: 52,
                height: 52,
                opacity: fadeOut,
                backgroundColor: isTarget ? '#22c55e' : '#ef4444',
                color: 'white',
                fontSize: 22,
                fontWeight: 700,
                cursor: isTarget ? 'pointer' : 'default',
                animation: isTarget ? 'pulse 1s ease-in-out infinite' : 'none',
                boxShadow: isTarget
                  ? '0 0 0 0 rgba(34,197,94,0.5), 0 4px 14px rgba(0,0,0,0.25)'
                  : '0 4px 14px rgba(0,0,0,0.25)',
              }}
            >
              {isTarget ? '●' : '✕'}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center pb-2">
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Tap this
        </span>
        <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Avoid this
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5), 0 4px 14px rgba(0,0,0,0.25); }
          50%       { box-shadow: 0 0 0 8px rgba(34,197,94,0),   0 4px 14px rgba(0,0,0,0.25); }
        }
      `}</style>
    </div>
  );
}
