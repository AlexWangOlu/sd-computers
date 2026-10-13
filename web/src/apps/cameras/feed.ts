import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import { rpc } from '@/nui/rpc';
import type { Control, Filter, Watching } from './types';

// What the app asks of the game's side of a camera (client/computers/cameras.lua) - look through
// it, turn it, stop - and of the page holding the OS (src/host): the whole display for the picture,
// or the prop's screen back. In a browser there is no game to look through anything, so the same
// messages the game would send are sent from here instead: everything round the picture can be
// worked on without one.

interface Reply {
  ok: boolean;
  error?: string;
  zoom?: number;
  /** Another ask (a second camera, or stop) came in while this one was waited for: its answer is the one that counts. */
  overtaken?: boolean;
}

let dev: Watching | null = null;
const say = (data: object) => window.postMessage({ action: 'computers:camera', data }, '*');
const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/** Look through a camera (or switch to it from another). Answers once its picture is there to show. */
export async function startCamera(id: string): Promise<Reply> {
  if (!isEnvBrowser()) return (await fetchNui<Reply>('computers:camera:start', { id })) ?? { ok: false };
  const res = await rpc<{ id: string; label: string; area?: string; zoom: number; filter?: Filter }>('cameras:watch', { id });
  if (!res.ok || !res.data) return { ok: false, error: res.error };
  await wait(700); // (about what the game takes to load the world round a camera)
  dev = { id: res.data.id, label: res.data.label, area: res.data.area, zoom: 1, maxZoom: res.data.zoom, filter: res.data.filter };
  say({ active: true, ...dev });
  return { ok: true };
}

/** Turn, tip or zoom the camera being watched; the reply says how far it is zoomed in now. */
export async function controlCamera(c: Control): Promise<number | null> {
  if (!isEnvBrowser()) return (await fetchNui<Reply>('computers:camera:control', c))?.zoom ?? null;
  if (!dev) return null;
  const max = dev.maxZoom ?? 3;
  dev = { ...dev, zoom: c.reset ? 1 : Math.min(max, Math.max(1, (dev.zoom ?? 1) * (c.zoom ?? 1))) };
  return dev.zoom ?? 1;
}

/** Stop looking through a camera. Answers once the game is showing the room again. */
export async function stopCamera(): Promise<void> {
  if (!isEnvBrowser()) {
    await fetchNui('computers:camera:stop');
    return;
  }
  if (dev) await wait(400);
  dev = null;
  say({ active: false });
}

/**
 * Ask the page holding the OS for the whole display (the picture, expanded), or for the prop's
 * screen again. It hides the OS while it moves it; the answer comes once it has, and what the OS
 * shows is only changed then - so neither layout is ever seen in the other's place.
 */
export function setDisplay(expanded: boolean): Promise<void> {
  if (window.parent === window) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      resolve();
    };
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { action?: unknown } | undefined)?.action === 'computers:host:display') done();
    };
    const timer = window.setTimeout(done, 400);
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ source: 'sd-computers-os', expanded }, '*');
  });
}
