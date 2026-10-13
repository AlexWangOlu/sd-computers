import { useEffect, useRef, type RefObject } from 'react';
import { useOS } from '@/store/os';
import type { Control } from './types';

// Looking round with a camera: what the mouse and the keys do on its picture, turned into turns of
// the camera. The same in the window and with the picture over the whole display - only who hears
// the keys differs. In the window they are the picture's while the window has them, and only the
// ones it has a use for; expanded, every key is the picture's (the desktop under it must not hear
// Escape and stand the player up).

/** Picture widths a second an arrow key turns the camera. */
const KEY_SPEED = 0.3;
/** Zoom per notch of the wheel, and per press of + / -. */
export const ZOOM_STEP = 1.15;

export interface Look {
  /** false while there is no picture to turn (still connecting): nothing is sent. */
  live: boolean;
  onControl: (c: Control) => Promise<number | null>;
  /** How far the camera is zoomed in now, as the game answers. */
  onZoom: (zoom: number) => void;
  /** The camera before (-1) or after (1) this one. */
  onStep: (dir: number) => void;
  /** Expand the picture over the whole display, or put it back in the window. */
  onToggle: () => void;
  onBack: () => void;
}

/**
 * @param surface the picture: dragged to turn the camera, wheeled over to zoom
 * @param scope what the keys are heard on - the element that holds the picture and its buttons, or
 *              'window' for every key there is
 */
export function useLook(surface: RefObject<HTMLElement | null>, scope: RefObject<HTMLElement | null> | 'window', look: Look): void {
  // Latest of everything the listeners use, so they are bound once.
  const latest = useRef(look);
  latest.current = look;

  useEffect(() => {
    const el = surface.current;
    const all = scope === 'window';
    const keys: HTMLElement | Window | null = scope === 'window' ? window : scope.current;
    if (!el || !keys) return;

    const held = new Set<string>();
    let dx = 0;
    let dy = 0;
    let factor = 1;
    let dragging = false;
    let last = performance.now();
    let frame = 0;

    const send = (c: Control) => {
      void latest.current.onControl(c).then(z => {
        if (typeof z === 'number') latest.current.onZoom(z);
      });
    };

    // What the pointer drags and what the arrow keys ask for are gathered and sent once a frame -
    // one message, however many mouse moves went into it.
    const tick = (at: number) => {
      const dt = Math.min(0.1, (at - last) / 1000);
      last = at;
      // (an arrow turns the camera that way: the picture slides the other)
      if (held.has('ArrowLeft')) dx += KEY_SPEED * dt;
      if (held.has('ArrowRight')) dx -= KEY_SPEED * dt;
      if (held.has('ArrowUp')) dy += KEY_SPEED * dt;
      if (held.has('ArrowDown')) dy -= KEY_SPEED * dt;
      if (dx !== 0 || dy !== 0 || factor !== 1) {
        if (latest.current.live) send({ dx, dy, zoom: factor === 1 ? undefined : factor });
        dx = 0;
        dy = 0;
        factor = 1;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onKeyDown = (e: KeyboardEvent) => {
      const used = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (all) used();
      if (e.key.startsWith('Arrow')) {
        used();
        held.add(e.key);
        return;
      }
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'Escape') {
        // (in the window the key is first the launcher's and the flyouts', which close on it)
        const os = useOS.getState();
        if (!all && (os.start || os.flyout)) return;
        latest.current.onBack();
      } else if (k === '+' || k === '=') factor *= ZOOM_STEP;
      else if (k === '-' || k === '_') factor /= ZOOM_STEP;
      else if (k === 'r') send({ reset: true });
      else if (k === 'f') latest.current.onToggle();
      else if (k === 'a' || k === 'PageUp') latest.current.onStep(-1);
      else if (k === 'd' || k === 'PageDown') latest.current.onStep(1);
      else return;
      used();
    };
    // (a key let go anywhere is let go: one held as the window lost the keys must not turn for ever)
    const onKeyUp = (e: KeyboardEvent) => {
      if (all) e.stopPropagation();
      held.delete(e.key);
    };
    const onBlur = () => held.clear();
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dx += e.movementX / Math.max(1, el.clientWidth);
      dy += e.movementY / Math.max(1, el.clientHeight);
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      factor *= e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    };

    keys.addEventListener('keydown', onKeyDown as EventListener, all);
    window.addEventListener('keyup', onKeyUp, all);
    window.addEventListener('blur', onBlur);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      keys.removeEventListener('keydown', onKeyDown as EventListener, all);
      window.removeEventListener('keyup', onKeyUp, all);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [surface, scope]);
}
