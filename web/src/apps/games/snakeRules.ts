// The rules of Snake, with no drawing in them. A game is a plain value; each tick and each key
// press returns the next one.

/** The board is SIZE x SIZE. A cell is the number y * SIZE + x. */
export const SIZE = 20;

export type Dir = 'up' | 'down' | 'left' | 'right';

const STEP: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export interface SnakeGame {
  /** The cells the snake covers, head first. */
  body: number[];
  /** The direction it last actually moved in. */
  dir: Dir;
  /** Turns waiting for a tick of their own, oldest first. */
  turns: Dir[];
  /** The cell the food is on, or -1 when the snake has filled the board. */
  food: number;
  score: number;
  status: 'ready' | 'playing' | 'paused' | 'over';
}

/** A free cell for the food, picked from the cells the snake is not on. -1 when there is none. */
function spawn(body: number[]): number {
  const taken = new Set(body);
  const free: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) free.push(i);
  return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
}

/** Three cells long in the middle of the board, heading right, waiting for the first key. */
export function newSnake(): SnakeGame {
  const mid = Math.floor(SIZE / 2);
  const head = mid * SIZE + mid;
  const body = [head, head - 1, head - 2];
  return { body, dir: 'right', turns: [], food: spawn(body), score: 0, status: 'ready' };
}

/** Milliseconds per step: a little quicker for every piece of food, down to a floor. */
export const tickMs = (score: number): number => Math.max(75, 160 - score * 3);

/**
 * A steering key. Turns queue up, one per tick, and each is checked against the turn before it
 * (or, with none waiting, against the way the snake last really moved). So two keys inside one
 * tick become two steps, and neither can fold the snake back onto its own neck.
 */
export function turn(g: SnakeGame, d: Dir): SnakeGame {
  if (g.status !== 'ready' && g.status !== 'playing') return g;
  const last = g.turns.length ? g.turns[g.turns.length - 1] : g.dir;
  const ok = d !== last && d !== OPPOSITE[last] && g.turns.length < 3;
  const turns = ok ? g.turns.concat([d]) : g.turns;
  // The first steering key also sets the snake off.
  if (g.status === 'ready') return { ...g, turns, status: 'playing' };
  return ok ? { ...g, turns } : g;
}

/** Space or P: start, pause, carry on. */
export function togglePause(g: SnakeGame): SnakeGame {
  if (g.status === 'over') return g;
  return { ...g, status: g.status === 'playing' ? 'paused' : 'playing' };
}

/** One step forward. */
export function step(g: SnakeGame): SnakeGame {
  if (g.status !== 'playing') return g;
  const dir = g.turns.length ? g.turns[0] : g.dir;
  const turns = g.turns.slice(1);
  const head = g.body[0];
  const x = (head % SIZE) + STEP[dir].x;
  const y = Math.floor(head / SIZE) + STEP[dir].y;
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return { ...g, dir, turns, status: 'over' };
  const next = y * SIZE + x;
  const eats = next === g.food;
  // The tail moves out of the way on this same step, unless the snake is growing.
  const rest = eats ? g.body : g.body.slice(0, -1);
  if (rest.indexOf(next) !== -1) return { ...g, dir, turns, status: 'over' };
  const body = [next].concat(rest);
  if (!eats) return { ...g, dir, turns, body };
  const food = spawn(body);
  return { ...g, dir, turns, body, food, score: g.score + 1, status: food < 0 ? 'over' : 'playing' };
}
