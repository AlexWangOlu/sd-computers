// The retro shell's period sounds, synthesised with WebAudio (no audio files): power switch +
// degauss + PSU fan, POST beep and memory ticks, drive chatter, key clicks, window blips, a toast
// chime, an error buzz and the CRT power-down. Ported from frp_mdt's retroSounds.
//
// Every effect is gated on payload.desktop.sounds and is safe to call anywhere: without an
// AudioContext (or while it is suspended by a dev tab's autoplay policy) it degrades to silence.
import { useOS } from '@/store/os';

const MASTER_VOLUME = 0.5;

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let noiseBuf: AudioBuffer | undefined;
let fan: { gain: GainNode; src: AudioBufferSourceNode } | undefined;

const enabled = (): boolean => useOS.getState().payload?.desktop.sounds !== false;

function ac(): AudioContext | undefined {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return undefined;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(ctx.destination);
      // One second of reusable white noise for clunks, seeks and the fan.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Browser dev tabs: resume on the first gesture so later effects play.
      const wake = () => {
        ctx?.resume().catch(() => undefined);
      };
      window.addEventListener('pointerdown', wake, { once: true });
      window.addEventListener('keydown', wake, { once: true });
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return undefined;
  }
}

/** One decaying oscillator note, optionally gliding to another pitch. */
function tone(type: OscillatorType, freq: number, dur: number, gain: number, when = 0, glideTo?: number): void {
  const c = ac();
  if (!c || !master) return;
  try {
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* silence */
  }
}

/** A filtered noise burst (clunks, clicks, static). */
function burst(dur: number, gain: number, filterType: BiquadFilterType, freq: number, when = 0, q = 1): void {
  const c = ac();
  if (!c || !master || !noiseBuf) return;
  try {
    const t0 = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  } catch {
    /* silence */
  }
}

/** The PSU fan: looped noise through a low-pass, ramping up and holding. No-op while one runs. */
function startFan(rampSec: number): void {
  const c = ac();
  if (!c || !master || !noiseBuf || fan) return;
  try {
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 230;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.016, c.currentTime + rampSec);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
    fan = { gain: g, src };
  } catch {
    /* silence */
  }
}

export const retroSfx = {
  /** Power switch clunk, degauss thump, and the fan winding up. */
  powerOn(): void {
    if (!enabled()) return;
    burst(0.05, 0.16, 'lowpass', 320);
    tone('sine', 62, 0.55, 0.12, 0.03, 38);
    burst(0.4, 0.05, 'lowpass', 180, 0.03);
    startFan(1.4);
  },

  /** No boot sequence (Boot = false): a soft degauss and the fan spinning up, no switch clunk. */
  wake(): void {
    if (!enabled()) return;
    tone('sine', 70, 0.4, 0.07, 0.02, 44);
    startFan(0.5);
  },

  /** Spin the fan down and stop it. Always runs (a muted fan never started anyway). */
  fanOff(fadeSec = 0.35): void {
    const c = ctx;
    if (!c || !fan) return;
    try {
      fan.gain.gain.cancelScheduledValues(c.currentTime);
      fan.gain.gain.setValueAtTime(Math.max(fan.gain.gain.value, 0.0002), c.currentTime);
      fan.gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fadeSec);
      fan.src.stop(c.currentTime + fadeSec + 0.05);
    } catch {
      /* silence */
    }
    fan = undefined;
  },

  /** PC-speaker POST beep. */
  beep(): void {
    if (enabled()) tone('square', 880, 0.14, 0.045);
  },

  /** One memory-count tick - call sparsely. */
  tick(): void {
    if (enabled()) tone('square', 2100, 0.006, 0.011);
  },

  /** One buckling-spring keystroke, force and pitch jittered so a line never sounds stamped. */
  key(kind: 'char' | 'enter' = 'char'): void {
    if (!enabled()) return;
    const v = 0.75 + Math.random() * 0.5;
    if (kind === 'enter') {
      burst(0.016, 0.05 * v, 'bandpass', 1400 + Math.random() * 300, 0, 1.4);
      burst(0.04, 0.034 * v, 'lowpass', 300, 0.012);
    } else {
      burst(0.01, 0.038 * v, 'bandpass', 2000 + Math.random() * 900, 0, 1.8);
      burst(0.02, 0.02 * v, 'lowpass', 420 + Math.random() * 140, 0.004);
    }
  },

  /** Hard-drive seek chatter: motor whine plus a scatter of head ticks. */
  hddSeek(durMs: number): void {
    if (!enabled()) return;
    const dur = durMs / 1000;
    tone('sine', 130, dur, 0.01);
    let at = 0;
    while (at < dur - 0.02) {
      burst(0.007, 0.02, 'bandpass', 1100 + Math.random() * 700, at, 4);
      at += 0.02 + Math.random() * 0.05;
    }
  },

  /** The splash's small ta-da. */
  chime(): void {
    if (!enabled()) return;
    tone('sine', 523.25, 0.5, 0.028);
    tone('sine', 659.25, 0.5, 0.026, 0.09);
    tone('sine', 783.99, 0.7, 0.026, 0.18);
  },

  /** Signed in: a rising four-note phrase. */
  logon(): void {
    if (!enabled()) return;
    tone('triangle', 392, 0.18, 0.03);
    tone('triangle', 523.25, 0.18, 0.03, 0.11);
    tone('triangle', 659.25, 0.2, 0.03, 0.22);
    tone('triangle', 1046.5, 0.45, 0.026, 0.33);
  },

  /** Wrong PIN / refused: a flat double buzz straight off the speaker cone. */
  deny(): void {
    if (!enabled()) return;
    tone('square', 140, 0.12, 0.035);
    tone('square', 110, 0.16, 0.035, 0.16);
  },

  /** A window snapping open: a short click and a rising blip. */
  open(): void {
    if (!enabled()) return;
    burst(0.012, 0.05, 'bandpass', 2400, 0, 2);
    tone('square', 520, 0.05, 0.02, 0.02);
    tone('square', 780, 0.06, 0.02, 0.07);
  },

  /** A window shut: a falling blip with a latch clunk at the bottom. */
  close(): void {
    if (!enabled()) return;
    tone('square', 620, 0.05, 0.022);
    tone('square', 330, 0.07, 0.02, 0.05);
    burst(0.02, 0.05, 'lowpass', 900, 0.1);
  },

  /** Minimize: three quick steps down to the icon row. */
  minimize(): void {
    if (!enabled()) return;
    tone('square', 700, 0.045, 0.02);
    tone('square', 470, 0.05, 0.018, 0.05);
    tone('square', 300, 0.05, 0.016, 0.1);
  },

  /** Maximize / restore: the same staircase, climbing. */
  maximize(): void {
    if (!enabled()) return;
    tone('square', 350, 0.045, 0.018);
    tone('square', 560, 0.05, 0.02, 0.05);
    tone('square', 840, 0.05, 0.02, 0.1);
  },

  /** A menu or button click. */
  click(): void {
    if (enabled()) burst(0.012, 0.045, 'bandpass', 2600, 0, 2);
  },

  /** A toast arriving: two bright bell notes. */
  notify(): void {
    if (!enabled()) return;
    tone('sine', 1046.5, 0.3, 0.03);
    tone('sine', 1567.98, 0.45, 0.026, 0.12);
    tone('triangle', 2093, 0.25, 0.008, 0.12);
  },

  /** A program launching: drive chatter under the hourglass. */
  launch(): void {
    if (!enabled()) return;
    retroSfx.hddSeek(260);
  },

  /** CRT off: the flyback whine collapsing, the relay clunk, the fan winding down. */
  powerDown(): void {
    if (enabled()) {
      tone('sine', 1500, 0.4, 0.016, 0, 180);
      burst(0.05, 0.14, 'lowpass', 300, 0.02);
      tone('sine', 55, 0.3, 0.06, 0.03, 34);
    }
    retroSfx.fanOff(0.9);
  },
};
