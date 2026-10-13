import { LEVEL_ORDER, type Level } from './minesRules';

/** Every game's best results live under this one key. */
const KEY = 'sd_computers:games';

export interface Bests {
  /** Fastest clear of each difficulty, in seconds. */
  mines: Partial<Record<Level, number>>;
  /** Fastest win in seconds and fewest moves. Kept apart: they need not be the same game. */
  solitaire: { time?: number; moves?: number };
  snake: { score?: number };
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/**
 * Read the stored results. Storage can be switched off in the game's browser, and what is in it
 * may be old or damaged, so only the numbers that make sense are kept.
 */
export function loadBests(): Bests {
  const out: Bests = { mines: {}, solitaire: {}, snake: {} };
  try {
    const raw = obj(JSON.parse(window.localStorage.getItem(KEY) || 'null'));
    const mines = obj(raw.mines);
    for (const level of LEVEL_ORDER) {
      const secs = num(mines[level]);
      if (secs !== undefined) out.mines[level] = secs;
    }
    const solitaire = obj(raw.solitaire);
    out.solitaire = { time: num(solitaire.time), moves: num(solitaire.moves) };
    out.snake = { score: num(obj(raw.snake).score) };
  } catch {
    // Nothing readable: start with no results.
  }
  return out;
}

export function saveBests(bests: Bests): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(bests));
  } catch {
    // Storage is unavailable: the results last until the window closes.
  }
}
