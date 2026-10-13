import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx, monogram } from './model';

/** How a click on something that opens a page asks for it: here, or in a tab of its own. */
export type OpenFn = (address: string, newTab?: boolean) => void;

/**
 * Click handlers for anything that opens a page: a plain click opens it here, Ctrl-click or a
 * middle click in a new tab. (The mousedown is swallowed for the middle button, or Chromium starts
 * its autoscroll instead.)
 */
export function openHandlers(open: (newTab: boolean) => void) {
  return {
    onClick: (e: MouseEvent) => open(e.ctrlKey || e.metaKey),
    onAuxClick: (e: MouseEvent) => {
      if (e.button === 1) open(true);
    },
    onMouseDown: (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    },
  };
}

/** A site has no icon of its own: the first letter of its name, on the accent tint. */
export function Monogram({ title, size = 20 }: { title: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-ctl flex items-center justify-center font-semibold bg-[var(--accent-soft)] text-accent-text select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55), lineHeight: 1 }}
    >
      {monogram(title)}
    </span>
  );
}

/** A page to go to, as a card: a start-page tile, a row of a `links` block, a suggestion. */
export function SiteCard({ title, detail, onOpen, className }: { title: string; detail: string; onOpen: (newTab: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      {...openHandlers(onOpen)}
      className={cx('ctl-card w-full min-w-0 flex items-center gap-3 rounded-win bg-card border border-stroke hover:bg-card-hover px-3 py-2.5 text-left cursor-pointer', className)}
    >
      <Monogram title={title} size={32} />
      <span className="flex-1 min-w-0">
        <span className="block text-body text-t1 truncate">{title}</span>
        <span className="block text-caption text-t2 truncate">{detail}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-t3" />
    </button>
  );
}

// The app keeps its one animation with itself: the stylesheet belongs to the shell.
const LOAD_KEYFRAMES = '@keyframes browser-load{from{transform:translateX(-100%)}to{transform:translateX(400%)}}';

/** The slim bar across the top of the page area while something is on its way. */
export function LoadBar() {
  return (
    <div role="progressbar" className="absolute top-0 inset-x-0 z-20 h-[2px] overflow-hidden pointer-events-none">
      <style>{LOAD_KEYFRAMES}</style>
      <div className="h-full w-1/4 bg-accent" style={{ animation: 'browser-load 1.1s ease-in-out infinite' }} />
    </div>
  );
}

/**
 * What every page that is not a frame sits in: one scrolling, centred column of a comfortable
 * reading width. (No breakpoints: they would measure the whole display, not this window.)
 */
export function Column({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto os-scroll">
      <div className={cx('mx-auto w-full px-8 pt-10 pb-12 page-in', wide ? 'max-w-[840px]' : 'max-w-[680px]')}>{children}</div>
    </div>
  );
}
