import {
  DISPLAY_DIGITS,
  ZERO,
  add,
  clampTiny,
  div,
  formatDec,
  fromInt,
  group,
  isNeg,
  isZero,
  mul,
  neg,
  overflows,
  parseDec,
  sqrt,
  sub,
  type Dec,
} from './decimal';

/**
 * Windows Calculator (Standard) as a pure reducer. The rules it copies:
 *  - operators chain left to right ("2 + 3 x" shows 5); pressing another operator before typing
 *    just swaps it; "5 + =" uses the displayed 5 as the right operand
 *  - "=" again repeats the last operation; typing a number then "=" applies it to the new number
 *  - unary keys wrap the operand in the expression line: sqr(3), √(9), 1/(4), negate(5)
 *  - % : a + b% = a + a*b/100 (same for -), a x b% = a x b/100 (same for /), no operator = 0
 *  - an error ("Cannot divide by zero", ...) locks every key but C and CE
 * Kept free of React and i18n so it can be exercised headless.
 */

export type Op = 'add' | 'sub' | 'mul' | 'div';
export type Fn = 'sqr' | 'sqrt' | 'recip' | 'negate';
export type MemOp = 'mc' | 'mr' | 'mplus' | 'mminus' | 'ms';
export type CalcError = 'divzero' | 'undefined' | 'invalid' | 'overflow';

/** How an operand is written in the expression line: a number, or a function of another term. */
export type Term = { v: Dec } | { fn: Fn; of: Term };

/** The small expression line above the result: "left op right =". */
export interface Expr {
  left?: Term;
  op?: Op;
  right?: Term;
  eq?: boolean;
}

export interface HistoryItem {
  id: number;
  expr: Expr;
  result: Dec;
}

export interface CalcState {
  /** Digits being typed ("1234.5", "-0.") or null while a computed value is shown. */
  entry: string | null;
  /** The shown value when entry is null. */
  value: Dec;
  /** The current operand's expression form when it came from a unary key. */
  term: Term | null;
  /** Left operand while an operator is pending. */
  acc: Dec | null;
  op: Op | null;
  /** A right operand has been typed/produced since the operator was pressed. */
  typed: boolean;
  expr: Expr | null;
  /** The last "op b" applied by "=", for repeats. */
  last: { op: Op; b: Dec } | null;
  /** The display shows a "=" result. */
  done: boolean;
  error: CalcError | null;
  memory: Dec | null;
  history: HistoryItem[];
  seq: number;
}

export type Action =
  | { type: 'digit'; d: string }
  | { type: 'dot' }
  | { type: 'op'; op: Op }
  | { type: 'eq' }
  | { type: 'fn'; fn: Fn }
  | { type: 'percent' }
  | { type: 'ce' }
  | { type: 'c' }
  | { type: 'back' }
  | { type: 'mem'; m: MemOp }
  | { type: 'recall'; id: number }
  | { type: 'clearHistory' };

const HISTORY_MAX = 50;

export const initialState: CalcState = {
  entry: null,
  value: ZERO,
  term: null,
  acc: null,
  op: null,
  typed: false,
  expr: null,
  last: null,
  done: false,
  error: null,
  memory: null,
  history: [],
  seq: 0,
};

/** The value on screen. */
export const current = (s: CalcState): Dec => (s.entry !== null ? parseDec(s.entry) : s.value);

/** Typed digits, not counting a lone leading "0" before the point. */
const typedDigits = (entry: string): number => {
  const e = entry.replace('-', '');
  const [int, frac = ''] = e.split('.');
  return (int === '0' ? 0 : int.length) + frac.length;
};

/** The display text: the entry as typed (with separators), or the formatted value. */
export function displayText(s: CalcState): string {
  if (s.entry === null) return formatDec(s.value);
  const negative = s.entry.startsWith('-');
  const [int, frac] = s.entry.replace('-', '').split('.');
  return (negative ? '-' : '') + group(int) + (frac !== undefined ? `.${frac}` : '');
}

type Outcome = { ok: true; v: Dec } | { ok: false; err: CalcError };

function checked(v: Dec): Outcome {
  if (overflows(v)) return { ok: false, err: 'overflow' };
  return { ok: true, v: clampTiny(v) };
}

function apply(a: Dec, op: Op, b: Dec): Outcome {
  switch (op) {
    case 'add':
      return checked(add(a, b));
    case 'sub':
      return checked(sub(a, b));
    case 'mul':
      return checked(mul(a, b));
    case 'div':
      if (isZero(b)) return { ok: false, err: isZero(a) ? 'undefined' : 'divzero' };
      return checked(div(a, b));
  }
}

function applyFn(x: Dec, fn: Fn): Outcome {
  switch (fn) {
    case 'sqr':
      return checked(mul(x, x));
    case 'sqrt':
      return isNeg(x) ? { ok: false, err: 'invalid' } : checked(sqrt(x));
    case 'recip':
      return isZero(x) ? { ok: false, err: 'divzero' } : checked(div(fromInt(1), x));
    case 'negate':
      return { ok: true, v: neg(x) };
  }
}

/** Enter the error state, keeping memory/history and the expression that caused it. */
const fail = (s: CalcState, err: CalcError, expr: Expr | null): CalcState => ({
  ...initialState,
  memory: s.memory,
  history: s.history,
  seq: s.seq,
  expr,
  error: err,
});

const pushHistory = (s: CalcState, expr: Expr, result: Dec): Pick<CalcState, 'history' | 'seq'> => ({
  history: [{ id: s.seq + 1, expr, result }, ...s.history].slice(0, HISTORY_MAX),
  seq: s.seq + 1,
});

/** Starting a fresh operand: drop a finished "=" expression or a lone unary expression. */
const freshExpr = (s: CalcState): Expr | null => (s.op ? { left: s.expr?.left, op: s.op } : null);

/** Commit the typed entry into `value` (MS/M+/M- do this - the next digit starts a new number). */
const commit = (s: CalcState): CalcState => (s.entry === null ? s : { ...s, value: parseDec(s.entry), entry: null });

export function reduce(s: CalcState, a: Action): CalcState {
  if (s.error && a.type !== 'c' && a.type !== 'ce') return s;

  switch (a.type) {
    case 'digit': {
      if (s.entry === null) {
        return { ...s, entry: a.d, value: ZERO, term: null, typed: true, done: false, expr: freshExpr(s) };
      }
      if (s.entry === '0' || s.entry === '-0') return { ...s, entry: s.entry.replace('0', a.d) };
      if (typedDigits(s.entry) >= DISPLAY_DIGITS) return s;
      return { ...s, entry: s.entry + a.d };
    }

    case 'dot': {
      if (s.entry === null) {
        return { ...s, entry: '0.', value: ZERO, term: null, typed: true, done: false, expr: freshExpr(s) };
      }
      if (s.entry.includes('.')) return s;
      return { ...s, entry: s.entry + '.' };
    }

    case 'op': {
      const x = current(s);
      if (s.op !== null && s.acc !== null) {
        if (!s.typed) return { ...s, op: a.op, expr: { left: s.expr?.left, op: a.op } };
        const r = apply(s.acc, s.op, x);
        if (!r.ok) return fail(s, r.err, { left: s.expr?.left, op: s.op, right: s.term ?? { v: x } });
        return { ...s, entry: null, value: r.v, term: null, acc: r.v, op: a.op, typed: false, done: false, expr: { left: { v: r.v }, op: a.op } };
      }
      const left: Term = s.done ? { v: x } : s.term ?? { v: x };
      return { ...s, entry: null, value: x, term: null, acc: x, op: a.op, typed: false, done: false, expr: { left, op: a.op } };
    }

    case 'eq': {
      const x = current(s);
      if (s.op !== null && s.acc !== null) {
        const expr: Expr = { left: s.expr?.left ?? { v: s.acc }, op: s.op, right: s.term ?? { v: x }, eq: true };
        const r = apply(s.acc, s.op, x);
        if (!r.ok) return fail(s, r.err, expr);
        return {
          ...s,
          ...pushHistory(s, expr, r.v),
          entry: null,
          value: r.v,
          term: null,
          acc: null,
          op: null,
          typed: false,
          done: true,
          expr,
          last: { op: s.op, b: x },
        };
      }
      if (s.last) {
        const expr: Expr = { left: s.done ? { v: x } : s.term ?? { v: x }, op: s.last.op, right: { v: s.last.b }, eq: true };
        const r = apply(x, s.last.op, s.last.b);
        if (!r.ok) return fail(s, r.err, expr);
        return { ...s, ...pushHistory(s, expr, r.v), entry: null, value: r.v, term: null, typed: false, done: true, expr };
      }
      return { ...s, entry: null, value: x, term: null, typed: false, done: true, expr: { left: s.term ?? { v: x }, eq: true } };
    }

    case 'fn': {
      // +/- while typing just flips the sign of the entry, like Windows.
      if (a.fn === 'negate' && s.entry !== null) {
        if (isZero(parseDec(s.entry))) return s;
        return { ...s, entry: s.entry.startsWith('-') ? s.entry.slice(1) : `-${s.entry}` };
      }
      const x = current(s);
      const base: Term = s.done || s.entry !== null ? { v: x } : s.term ?? { v: x };
      const term: Term = { fn: a.fn, of: base };
      const expr: Expr = s.op ? { left: s.expr?.left, op: s.op, right: term } : { left: term };
      const r = applyFn(x, a.fn);
      if (!r.ok) return fail(s, r.err, expr);
      return { ...s, entry: null, value: r.v, term, typed: true, done: false, expr };
    }

    case 'percent': {
      const x = current(s);
      let v: Dec = ZERO;
      if (s.op !== null && s.acc !== null) v = s.op === 'add' || s.op === 'sub' ? div(mul(s.acc, x), fromInt(100)) : div(x, fromInt(100));
      const term: Term = { v };
      return { ...s, entry: null, value: v, term, typed: true, done: false, expr: s.op ? { left: s.expr?.left, op: s.op, right: term } : { left: term } };
    }

    case 'ce': {
      if (s.error) return { ...initialState, memory: s.memory, history: s.history, seq: s.seq };
      return { ...s, entry: null, value: ZERO, term: null, done: false, expr: s.op ? { left: s.expr?.left, op: s.op } : null };
    }

    case 'c':
      return { ...initialState, memory: s.memory, history: s.history, seq: s.seq };

    case 'back': {
      if (s.entry === null) return s.done ? { ...s, expr: null } : s;
      const next = s.entry.slice(0, -1);
      return { ...s, entry: next === '' || next === '-' ? '0' : next };
    }

    case 'mem': {
      switch (a.m) {
        case 'mc':
          return { ...s, memory: null };
        case 'mr':
          if (!s.memory) return s;
          return { ...s, entry: null, value: s.memory, term: null, typed: true, done: false, expr: freshExpr(s) };
        case 'ms':
          return { ...commit(s), memory: current(s) };
        case 'mplus':
        case 'mminus': {
          const x = current(s);
          const m = s.memory ?? ZERO;
          const r = checked(a.m === 'mplus' ? add(m, x) : sub(m, x));
          if (!r.ok) return fail(s, r.err, s.expr);
          return { ...commit(s), memory: r.v };
        }
      }
      return s;
    }

    case 'recall': {
      const h = s.history.find(x => x.id === a.id);
      if (!h) return s;
      return { ...s, entry: null, value: h.result, term: null, acc: null, op: null, typed: false, done: true, expr: h.expr };
    }

    case 'clearHistory':
      return { ...s, history: [] };
  }
}
