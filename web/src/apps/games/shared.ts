import type { MouseEvent } from 'react';
import type { Bests } from './storage';

export type GameId = 'mines' | 'solitaire' | 'snake';

/** What every game gets from the app around it. */
export interface GameProps {
  /** This window is the focused one and not minimized: keys count and clocks run. */
  focused: boolean;
  bests: Bests;
  /** Change the stored best results. Return the same object to leave them alone. */
  record: (change: (b: Bests) => Bests) => void;
  onBack: () => void;
}

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/**
 * Spread onto a button so clicking it never moves the focus there: Space and Enter belong to the
 * game, and a focused button would answer them too.
 */
export const still = {
  tabIndex: -1,
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
};
