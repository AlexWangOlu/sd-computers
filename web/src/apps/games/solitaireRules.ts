// Klondike, draw one, with no drawing in it. A table is never changed in place: every move returns
// a new one that shares the piles it did not touch, which is what makes undo a plain list of the
// tables that came before.

export interface Card {
  /** 0-51, unique in the deck: suit * 13 + rank - 1. */
  id: number;
  /** 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
  suit: number;
  /** 1 (ace) to 13 (king). */
  rank: number;
  up: boolean;
}

/** In every pile the last card is the one on top. */
export interface Table {
  stock: Card[];
  waste: Card[];
  /** One foundation per suit, in suit order. */
  found: Card[][];
  piles: Card[][];
}

export type Zone = 'stock' | 'waste' | 'found' | 'pile';

/** A card's place: which pile (`n`, for foundations and the tableau) and how far up it. */
export interface Spot {
  zone: Zone;
  n: number;
  index: number;
}

export interface Dest {
  zone: 'found' | 'pile';
  n: number;
}

export const isRed = (c: Card): boolean => c.suit === 1 || c.suit === 2;

/** A fresh game: 52 different cards, shuffled (Fisher-Yates), 28 dealt to the tableau. */
export function deal(): Table {
  const ids: number[] = [];
  for (let i = 0; i < 52; i++) ids.push(i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = ids[i];
    ids[i] = ids[j];
    ids[j] = swap;
  }
  const deck: Card[] = ids.map(id => ({ id, suit: Math.floor(id / 13), rank: (id % 13) + 1, up: false }));
  const piles: Card[][] = [];
  let next = 0;
  for (let n = 0; n < 7; n++) {
    const pile = deck.slice(next, next + n + 1);
    next += n + 1;
    pile[n] = { ...pile[n], up: true };
    piles.push(pile);
  }
  return { stock: deck.slice(next), waste: [], found: [[], [], [], []], piles };
}

export function locate(t: Table, id: number): Spot | null {
  const at = (cards: Card[]) => cards.findIndex(c => c.id === id);
  let index = at(t.stock);
  if (index >= 0) return { zone: 'stock', n: 0, index };
  index = at(t.waste);
  if (index >= 0) return { zone: 'waste', n: 0, index };
  for (let n = 0; n < t.found.length; n++) {
    index = at(t.found[n]);
    if (index >= 0) return { zone: 'found', n, index };
  }
  for (let n = 0; n < t.piles.length; n++) {
    index = at(t.piles[n]);
    if (index >= 0) return { zone: 'pile', n, index };
  }
  return null;
}

/**
 * The cards a move from `s` would carry, or null when nothing may leave from there. The waste and
 * the foundations give up their top card only. A tableau pile gives the card and everything on it,
 * and only as a proper run: all face up, colours alternating, each one lower than the last.
 */
export function lift(t: Table, s: Spot): Card[] | null {
  if (s.zone === 'stock') return null;
  const from = s.zone === 'waste' ? t.waste : s.zone === 'found' ? t.found[s.n] : t.piles[s.n];
  if (!from || s.index < 0 || s.index >= from.length) return null;
  if (s.zone !== 'pile') return s.index === from.length - 1 ? [from[s.index]] : null;
  const run = from.slice(s.index);
  for (let i = 0; i < run.length; i++) {
    if (!run[i].up) return null;
    if (i > 0 && (isRed(run[i]) === isRed(run[i - 1]) || run[i].rank !== run[i - 1].rank - 1)) return null;
  }
  return run;
}

/** Whether `run` may be put down on `d`. */
export function fits(t: Table, run: Card[], d: Dest): boolean {
  const first = run[0];
  if (d.zone === 'found') return run.length === 1 && first.suit === d.n && first.rank === t.found[d.n].length + 1;
  const pile = t.piles[d.n];
  // An empty pile takes a king and nothing else.
  if (!pile.length) return first.rank === 13;
  const top = pile[pile.length - 1];
  return top.up && isRed(top) !== isRed(first) && top.rank === first.rank + 1;
}

/** Move the card at `s` (and the run on it) to `d`. Null when the rules do not allow it. */
export function move(t: Table, s: Spot, d: Dest): Table | null {
  const run = lift(t, s);
  if (!run || (s.zone === d.zone && s.n === d.n) || !fits(t, run, d)) return null;
  const next: Table = { stock: t.stock, waste: t.waste, found: t.found.slice(), piles: t.piles.slice() };
  if (s.zone === 'waste') next.waste = t.waste.slice(0, -1);
  else if (s.zone === 'found') next.found[s.n] = t.found[s.n].slice(0, -1);
  else {
    const rest = t.piles[s.n].slice(0, s.index);
    // The card the run sat on is the top of its pile now: turn it face up.
    const last = rest.length - 1;
    if (last >= 0 && !rest[last].up) rest[last] = { ...rest[last], up: true };
    next.piles[s.n] = rest;
  }
  if (d.zone === 'found') next.found[d.n] = next.found[d.n].concat(run);
  else next.piles[d.n] = next.piles[d.n].concat(run);
  return next;
}

/** Click on the stock: turn one card onto the waste, or turn the waste back over when it is empty. */
export function draw(t: Table): Table | null {
  if (t.stock.length) {
    const card = t.stock[t.stock.length - 1];
    return { ...t, stock: t.stock.slice(0, -1), waste: t.waste.concat([{ ...card, up: true }]) };
  }
  if (!t.waste.length) return null;
  // Turned over as one pile, so the cards come round again in the order they were first drawn.
  return { ...t, stock: t.waste.slice().reverse().map(c => ({ ...c, up: false })), waste: [] };
}

/**
 * Where a clicked card should go: its foundation if it fits, otherwise a tableau pile. The piles
 * are tried from the one after the card's own and round again, so a second click on the same card
 * moves it on to the next place that takes it.
 */
export function best(t: Table, s: Spot): Dest | null {
  const run = lift(t, s);
  if (!run) return null;
  const home: Dest = { zone: 'found', n: run[0].suit };
  if (s.zone !== 'found' && fits(t, run, home)) return home;
  const first = s.zone === 'pile' ? s.n + 1 : 0;
  let empty: Dest | null = null;
  for (let k = 0; k < t.piles.length; k++) {
    const n = (first + k) % t.piles.length;
    if (s.zone === 'pile' && n === s.n) continue;
    if (!fits(t, run, { zone: 'pile', n })) continue;
    if (t.piles[n].length) return { zone: 'pile', n };
    // A king already at the bottom of its pile gains nothing from another empty one.
    if (!empty && !(s.zone === 'pile' && s.index === 0)) empty = { zone: 'pile', n };
  }
  return empty;
}

export const isWon = (t: Table): boolean => t.found.every(f => f.length === 13);

/** No card in the tableau is face down any more: from here the game cannot be lost. */
export const allUp = (t: Table): boolean => t.piles.every(p => p.every(c => c.up));

/**
 * One card to its foundation, for the automatic finish. The stock and waste are searched whole:
 * with one card drawn at a time every card in them comes up sooner or later, so taking it straight
 * away changes nothing but the wait. Null when no card can go, which only happens once the game is
 * won (the lowest card still out is always on top of a pile or in the stock or waste).
 */
export function autoStep(t: Table): Table | null {
  for (let n = 0; n < t.piles.length; n++) {
    const pile = t.piles[n];
    if (!pile.length) continue;
    const next = move(t, { zone: 'pile', n, index: pile.length - 1 }, { zone: 'found', n: pile[pile.length - 1].suit });
    if (next) return next;
  }
  const due = (c: Card) => c.rank === t.found[c.suit].length + 1;
  const home = (c: Card) => {
    const found = t.found.slice();
    found[c.suit] = found[c.suit].concat([{ ...c, up: true }]);
    return found;
  };
  const inWaste = t.waste.find(due);
  if (inWaste) return { ...t, waste: t.waste.filter(c => c !== inWaste), found: home(inWaste) };
  const inStock = t.stock.find(due);
  if (inStock) return { ...t, stock: t.stock.filter(c => c !== inStock), found: home(inStock) };
  return null;
}

/** For each card id, the pile it is in: 0 stock, 1 waste, 2-5 foundations, 6-12 tableau. */
function homes(t: Table): number[] {
  const at: number[] = new Array<number>(52).fill(-1);
  for (const c of t.stock) at[c.id] = 0;
  for (const c of t.waste) at[c.id] = 1;
  t.found.forEach((f, n) => f.forEach(c => (at[c.id] = 2 + n)));
  t.piles.forEach((p, n) => p.forEach(c => (at[c.id] = 6 + n)));
  return at;
}

/** The ids of the cards that are in a different pile in `b` than in `a`. */
export function moved(a: Table, b: Table): number[] {
  const before = homes(a);
  const after = homes(b);
  const out: number[] = [];
  for (let id = 0; id < 52; id++) if (before[id] !== after[id]) out.push(id);
  return out;
}
