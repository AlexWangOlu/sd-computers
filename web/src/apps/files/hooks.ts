import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * An element's own width, kept up to date - Files lays itself out by the room its WINDOW has
 * (container queries aren't in Chromium 103, and the viewport says nothing about a window).
 * A minimized window measures 0: the last real width stays, so the layout doesn't flip. 0 until
 * the first measure. Put the ref on an element that is there from the first render.
 */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number) => {
      if (w > 0) setWidth(Math.round(w));
    };
    apply(el.clientWidth);
    const ro = new ResizeObserver(entries => apply(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
