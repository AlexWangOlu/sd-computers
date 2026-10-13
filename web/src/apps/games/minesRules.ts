// The rules of Mines, with no drawing in them. Every move takes a board and returns a new one
// (or the same one when the move does nothing), so the view only ever swaps boards.

export type Level = 'beginner' | 'intermediate' | 'expert';

export const LEVELS: Record<Level, { cols: number; rows: number; mines: number }> = {
  beginner: { cols: 9, rows: 9, mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert: { cols: 30, rows: 16, mines: 99 },
};

export const LEVEL_ORDER: Level[] = ['beginner', 'intermediate', 'expert'];

export interface Board {
  level: Level;
  cols: number;
  rows: number;
  mines: number;
  /** Where the mines are. All false until the first cell is opened: they are laid around it. */
  mine: boolean[];
  /** How many mines touch each cell. */
  near: number[];
  open: boolean[];
  flag: boolean[];
  status: 'ready' | 'playing' | 'won' | 'lost';
  /** The mine that ended the game, or -1. */
  boom: number;
}

export function newBoard(level: Level): Board {
  const { cols, rows, mines } = LEVELS[level];
  const blank = <T,>(v: T): T[] => new Array<T>(cols * rows).fill(v);
  return { level, cols, rows, mines, mine: blank(false), near: blank(0), open: blank(false), flag: blank(false), status: 'ready', boom: -1 };
}

const copy = (b: Board): Board => ({ ...b, mine: b.mine.slice(), near: b.near.slice(), open: b.open.slice(), flag: b.flag.slice() });

const over = (b: Board): boolean => b.status === 'won' || b.status === 'lost';

/** The up to eight cells touching cell `i`. */
export function around(b: Board, i: number): number[] {
  const x = i % b.cols;
  const y = (i - x) / b.cols;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < b.cols && ny >= 0 && ny < b.rows) out.push(ny * b.cols + nx);
    }
  }
  return out;
}

/**
 * Lay the mines once the first cell is known: never on it, and never touching it, so the first
 * click always opens an area and not a lone number.
 */
function lay(b: Board, first: number): void {
  const clear = new Set([first, ...around(b, first)]);
  let spots: number[] = [];
  for (let i = 0; i < b.mine.length; i++) if (!clear.has(i)) spots.push(i);
  // A board too crowded to keep the whole neighbourhood clear still keeps the clicked cell safe.
  if (spots.length < b.mines) {
    spots = [];
    for (let i = 0; i < b.mine.length; i++) if (i !== first) spots.push(i);
  }
  const count = Math.min(b.mines, spots.length);
  for (let k = 0; k < count; k++) {
    const j = k + Math.floor(Math.random() * (spots.length - k));
    const pick = spots[j];
    spots[j] = spots[k];
    spots[k] = pick;
    b.mine[pick] = true;
  }
  for (let i = 0; i < b.mine.length; i++) b.near[i] = around(b, i).filter(n => b.mine[n]).length;
}

/**
 * Open a cell and, when nothing touches it, everything around it, and so on outwards. A list of
 * cells still to visit instead of a function calling itself: an empty Expert board would otherwise
 * go hundreds of calls deep. Flagged cells are left shut, mines are never opened.
 */
function flood(b: Board, from: number): void {
  const todo = [from];
  while (todo.length) {
    const i = todo.pop() as number;
    if (b.open[i] || b.flag[i] || b.mine[i]) continue;
    b.open[i] = true;
    if (b.near[i] !== 0) continue;
    for (const n of around(b, i)) if (!b.open[n] && !b.flag[n]) todo.push(n);
  }
}

/** Won when every safe cell is open. Flags do not count: a wrong one never wins or loses a game. */
function settle(b: Board): Board {
  let opened = 0;
  for (const o of b.open) if (o) opened++;
  if (opened !== b.open.length - b.mines) return b;
  b.status = 'won';
  // Mark what is left, so the finished board shows where everything was.
  for (let i = 0; i < b.mine.length; i++) b.flag[i] = b.mine[i];
  return b;
}

function lose(b: Board, hit: number): Board {
  b.status = 'lost';
  b.boom = hit;
  return b;
}

/** Left click on a closed cell. */
export function open(b: Board, i: number): Board {
  if (over(b) || b.open[i] || b.flag[i]) return b;
  const next = copy(b);
  if (next.status === 'ready') {
    lay(next, i);
    next.status = 'playing';
  }
  if (next.mine[i]) return lose(next, i);
  flood(next, i);
  return settle(next);
}

/** Left click on an open number: with that many flags around it, open the rest of its neighbours. */
export function chord(b: Board, i: number): Board {
  if (b.status !== 'playing' || !b.open[i] || b.near[i] === 0) return b;
  const ring = around(b, i);
  if (ring.filter(n => b.flag[n]).length !== b.near[i]) return b;
  const rest = ring.filter(n => !b.open[n] && !b.flag[n]);
  if (!rest.length) return b;
  const next = copy(b);
  // A flag in the wrong place leaves a real mine among the cells being opened.
  const hit = rest.find(n => next.mine[n]);
  if (hit !== undefined) return lose(next, hit);
  for (const n of rest) flood(next, n);
  return settle(next);
}

/** Right click on a closed cell. */
export function toggleFlag(b: Board, i: number): Board {
  if (over(b) || b.open[i]) return b;
  const next = copy(b);
  next.flag[i] = !next.flag[i];
  return next;
}

/** The counter: mines minus flags placed. It goes below zero when there are too many flags. */
export function flagsLeft(b: Board): number {
  let flags = 0;
  for (const f of b.flag) if (f) flags++;
  return b.mines - flags;
}
