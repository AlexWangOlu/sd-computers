import { isEnvBrowser } from '@/nui/bridge';
import { DEV_CHANNEL } from './codec';

// The door to the recorder (src/mirror/recorder.ts). The recorder and the library under it are a
// chunk of their own, fetched the first time a player nearby looks at this computer's screen - a
// player nobody watches never loads it.

export interface MirrorControl {
  record: boolean;
  /** Frames a second the minigame canvases are sampled at (0 = not at all). */
  canvasFps?: number;
}

let recorder: Promise<typeof import('./recorder')> | null = null;

/** computers:mirror from client Lua: start recording / take a fresh snapshot, or stop. */
export function mirrorControl(d: MirrorControl): void {
  if (!d.record && !recorder) return;
  recorder = recorder ?? import('./recorder');
  void recorder.then(m => m.control(d));
}

/** The computer closed: nothing left to record. */
export const mirrorStop = (): void => mirrorControl({ record: false });

/** Browser dev: a screen page open in another tab (/screen.html?mode=live) asks over the channel. */
export function devMirror(): void {
  if (!isEnvBrowser() || typeof BroadcastChannel !== 'function') return;
  new BroadcastChannel(DEV_CHANNEL).onmessage = e => {
    if ((e.data as { need?: boolean } | undefined)?.need) mirrorControl({ record: true, canvasFps: 3 });
  };
}
