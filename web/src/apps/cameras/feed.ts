import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import { rpc } from '@/nui/rpc';
import type { Control, Watching } from './types';

// The three things the app asks of the game's side of a camera (client/computers/cameras.lua):
// put its picture up, turn it, and go back to the desktop. In a browser there is no game to show
// a picture, so the same messages the game would send are sent from here instead: the frame over
// the picture can be worked on without one.

interface Reply {
  ok: boolean;
  error?: string;
  zoom?: number;
}

let dev: Watching | null = null;
const say = (data: object) => window.postMessage({ action: 'computers:camera', data }, '*');

/** Watch a camera (or switch to it from another). */
export async function startCamera(id: string): Promise<Reply> {
  if (!isEnvBrowser()) return (await fetchNui<Reply>('computers:camera:start', { id })) ?? { ok: false };
  const res = await rpc<{ id: string; label: string; area?: string; zoom: number }>('cameras:watch', { id });
  if (!res.ok || !res.data) return { ok: false, error: res.error };
  dev = { id: res.data.id, label: res.data.label, area: res.data.area, zoom: 1, maxZoom: res.data.zoom };
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

/** Back to the desktop. */
export async function stopCamera(): Promise<void> {
  if (!isEnvBrowser()) {
    await fetchNui('computers:camera:stop');
    return;
  }
  dev = null;
  say({ active: false });
}
