// Tiny WebAudio-synthesised system sounds (no audio files shipped): a logon chime, a notification
// ding and an error bonk. MASTER keeps them well under game volume.

const MASTER = 0.12;
let ctx: AudioContext | null = null;

const audio = (): AudioContext | null => {
  try {
    ctx = ctx ?? new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

/** One soft sine/triangle note with a quick attack and exponential release. */
const note = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 1): void => {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(MASTER * gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
};

export const sfx = {
  /** Rising major arpeggio - signing in. */
  logon(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.09, 0.9, 'sine', 0.8));
  },
  /** Two-tone ding - a toast. */
  notify(): void {
    note(880, 0, 0.35, 'triangle', 0.7);
    note(1318.5, 0.11, 0.5, 'triangle', 0.6);
  },
  /** Low bonk - an error. */
  error(): void {
    note(220, 0, 0.25, 'square', 0.25);
    note(196, 0.08, 0.3, 'square', 0.2);
  },
};
