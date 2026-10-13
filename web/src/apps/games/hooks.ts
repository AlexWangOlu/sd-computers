import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useOS } from '@/store/os';

/** Live content-box size of an element (ResizeObserver): every board sizes itself from this. */
export function useSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize(s => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * A game clock. It only counts while `running`, so a window that is minimized or behind another
 * one costs the player nothing, and a new `epoch` (a new game) puts it back to zero. `read()` is
 * the exact time in milliseconds, for the moment a game is won.
 */
export function useStopwatch(running: boolean, epoch: number): { seconds: number; read: () => number } {
  const [ms, setMs] = useState(0);
  const banked = useRef(0);
  const since = useRef<number | null>(null);

  const read = useCallback(() => banked.current + (since.current === null ? 0 : performance.now() - since.current), []);

  useEffect(() => {
    if (!running) return;
    since.current = performance.now();
    const id = window.setInterval(() => setMs(read()), 250);
    return () => {
      window.clearInterval(id);
      banked.current = read();
      since.current = null;
      setMs(banked.current);
    };
  }, [running, read]);

  // React runs the clean-up above before this, so a render that both stops the clock and starts a
  // new game banks the old time first and then clears it.
  useEffect(() => {
    banked.current = 0;
    if (since.current !== null) since.current = performance.now();
    setMs(0);
  }, [epoch]);

  return { seconds: Math.floor(ms / 1000), read };
}

/**
 * Keyboard for a game, only while its window is the focused one. `onKey` returns true for a key it
 * used; that key is then kept from the page (no scrolling) and from the shell's own shortcuts.
 * Every other key passes through untouched, as does anything typed into a field.
 */
export function useKeys(active: boolean, onKey: (e: KeyboardEvent) => boolean): void {
  const handler = useRef(onKey);
  handler.current = onKey;

  useEffect(() => {
    if (!active) return;
    const listen = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (!handler.current(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    // Capture phase on the window: it runs before the shell's listeners, which sit on the same
    // window in the bubble phase, so stopping the event here keeps it from them.
    window.addEventListener('keydown', listen, true);
    return () => window.removeEventListener('keydown', listen, true);
  }, [active]);
}
