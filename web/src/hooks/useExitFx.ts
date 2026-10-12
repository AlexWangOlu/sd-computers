import { createElement, useCallback, useRef, type HTMLAttributes } from 'react';

/**
 * A non-interactive clone of `node` as it looks right now, set to play `exitClass` (an .exit-ghost
 * rule in the Motion section of styles.css) and then remove itself. The caller inserts it.
 */
function ghostOf(node: HTMLElement, exitClass: string, ms: number): HTMLElement {
  const ghost = node.cloneNode(true) as HTMLElement;
  // A cloned canvas is blank: carry the last frame over.
  const frames = node.querySelectorAll('canvas');
  ghost.querySelectorAll('canvas').forEach((c, i) => {
    if (frames[i].width && frames[i].height) c.getContext('2d')?.drawImage(frames[i], 0, 0);
  });
  ghost.classList.add('exit-ghost', exitClass);
  ghost.setAttribute('aria-hidden', 'true');
  const done = () => ghost.remove();
  ghost.addEventListener('animationend', e => {
    if (e.target === ghost) done();
  });
  window.setTimeout(done, ms);
  return ghost;
}

/**
 * Exit animations without keeping anything mounted. Attach the returned ref to an element that is
 * rendered conditionally (a menu, flyout, dialog, toast): when React removes it, a non-interactive
 * clone takes its place and plays `exitClass` (fade-out, fly-out, pop-out, toast-out, task-out -
 * see the Motion section of styles.css), then removes itself.
 *
 * Only for overlays and for list items whose exit collapses them (--exit-h / --exit-w carry the
 * size they had): a clone left in normal flow would push its siblings around. Nothing is left
 * behind when the element's parent goes too (a window closing, the desktop unmounting).
 */
export function useExitFx<T extends HTMLElement = HTMLDivElement>(exitClass: string, ms = 260): (el: T | null) => void {
  const node = useRef<T | null>(null);
  return useCallback(
    (el: T | null) => {
      if (el) {
        node.current = el;
        return;
      }
      const gone = node.current;
      node.current = null;
      const parent = gone?.parentElement;
      if (!gone || !parent) return;
      // React detaches refs before it removes the node, so the layout is still readable here.
      const next = gone.nextSibling;
      const { width, height } = gone.getBoundingClientRect();
      queueMicrotask(() => {
        if (gone.isConnected || !parent.isConnected) return;
        const ghost = ghostOf(gone, exitClass, ms);
        ghost.style.setProperty('--exit-w', `${width}px`);
        ghost.style.setProperty('--exit-h', `${height}px`);
        parent.insertBefore(ghost, next && next.parentNode === parent ? next : null);
      });
    },
    [exitClass, ms],
  );
}

/** A div that plays `exit` on its way out, for elements rendered in a loop (where a hook can't go). */
export function ExitFx({ exit, ...props }: { exit: string } & HTMLAttributes<HTMLDivElement>) {
  return createElement('div', { ...props, ref: useExitFx(exit) });
}

/**
 * Dissolve a whole subtree into whatever it is about to become (a theme or accent switch): call
 * this BEFORE the change lands and a snapshot of the current look is laid over `node`, then faded
 * away. One layer's opacity - transitioning every element's colours instead drops frames.
 */
export function dissolveOver(node: HTMLElement, ms = 420): void {
  const parent = node.parentElement;
  if (!parent) return;
  const ghost = ghostOf(node, 'look-out', ms);
  parent.insertBefore(ghost, node.nextSibling);
  // Scroll offsets and <select> choices are state, not markup: a clone starts without them.
  const from = node.querySelectorAll<HTMLElement>('*');
  const to = ghost.querySelectorAll<HTMLElement>('*');
  from.forEach((el, i) => {
    if (el.scrollTop || el.scrollLeft) to[i].scrollTo(el.scrollLeft, el.scrollTop);
    if (el instanceof HTMLSelectElement) (to[i] as HTMLSelectElement).value = el.value;
  });
}
