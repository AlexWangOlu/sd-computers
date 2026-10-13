import { useLayoutEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { useOS, selectActiveId, type Win } from '@/store/os';
import { t } from '@/i18n';

/** The games there are. Each is a program of its own: its id is also its window's app (store/os.ts WinApp). */
export const GAME_IDS = ['mines', 'solitaire', 'snake'] as const;
export type GameId = (typeof GAME_IDS)[number];

/** How large each game's window opens. */
const WINDOW: Record<GameId, { w: number; h: number }> = {
  mines: { w: 470, h: 640 },
  solitaire: { w: 920, h: 690 },
  snake: { w: 600, h: 730 },
};

/** The id of a game's window. One of each at most: opening a game that is up brings it forward. */
export const gameWindowId = (id: GameId): string => `game:${id}`;

/** Start a game in a window of its own (the Games shelf does, and nothing else needs to). */
export function openGame(id: GameId): void {
  useOS.getState().openWindow({ id: gameWindowId(id), app: id, title: t(`ui.games.${id}_name`), ...WINDOW[id] });
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

/**
 * What a game needs of the window it runs in: whether it is the one being played (the focused
 * window, not minimized, no shell menu over it - keys count and clocks run only then), and an
 * element to hold the keyboard. The games are played from the keys with nothing in them holding
 * the focus, so when the window comes to the front the game takes it: otherwise the keys would
 * keep landing in a text box left focused in another window. A layout effect, so it happens
 * before the click that brought the window forward gets to focus whatever it was aimed at.
 */
export function useGameWindow(win: Win): { root: RefObject<HTMLDivElement | null>; focused: boolean } {
  const root = useRef<HTMLDivElement>(null);
  const active = useOS(selectActiveId) === win.id;
  const shellMenu = useOS(s => s.start || s.flyout !== null);
  const focused = active && !win.min && !shellMenu;

  useLayoutEffect(() => {
    const el = root.current;
    if (focused && el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [focused]);

  return { root, focused };
}
