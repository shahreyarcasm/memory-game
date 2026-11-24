/**
 * Web Audio API sound engine — zero assets needed.
 * Plays correct / wrong / level-up tones based on an oscillator.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const _enabled = true; // driven by zustand; caller checks first

type ToneType = 'correct' | 'wrong' | 'complete';

export function playSound(type: ToneType): void {
  if (!_enabled) return;
  try {
    const c = getCtx();
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    switch (type) {
      case 'correct':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, now);     // C5
        osc.frequency.setValueAtTime(659, now + 0.07); // E5
        osc.frequency.setValueAtTime(784, now + 0.14); // G5
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
        break;

      case 'wrong':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;

      case 'complete':
        osc.type = 'triangle';
        // Ascending arpeggio — triumphant
        [523, 659, 784, 1047].forEach((freq, i) => {
          const t = now + i * 0.1;
          const o = c.createOscillator();
          const g = c.createGain();
          o.connect(g);
          g.connect(c.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, t);
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          o.start(t);
          o.stop(t + 0.18);
        });
        break;
    }
  } catch {
    // Audio not supported or blocked — silent fail
  }
}
