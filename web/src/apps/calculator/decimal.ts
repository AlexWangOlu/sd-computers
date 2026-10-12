// Exact decimal arithmetic on BigInt, so the calculator does what a person expects (0.1 + 0.2 = 0.3,
// 4.35 x 100 = 435) instead of what IEEE doubles do. A value is m * 10^e with m holding at most
// PREC significant digits; division and square roots are rounded there, and the display rounds
// again to DISPLAY_DIGITS - the same two-level precision Windows Calculator uses.

export interface Dec {
  m: bigint;
  e: number;
}

const PREC = 40;
/** Digits shown on screen (and accepted while typing). */
export const DISPLAY_DIGITS = 16;
/** Windows Calculator gives up ("Overflow") past 10^9999. */
const MAX_EXP = 9999;

export const ZERO: Dec = { m: 0n, e: 0 };

const pow10 = (n: number): bigint => 10n ** BigInt(n);
const abs = (n: bigint): bigint => (n < 0n ? -n : n);
const digitCount = (m: bigint): number => abs(m).toString().length;

/** a / b rounded half away from zero. */
function roundDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  if (r === 0n) return q;
  if (abs(r) * 2n >= abs(b)) return q + ((a < 0n) !== (b < 0n) ? -1n : 1n);
  return q;
}

/** Round to PREC significant digits and strip trailing zeros. */
function norm(m: bigint, e: number): Dec {
  if (m === 0n) return ZERO;
  const n = digitCount(m);
  if (n > PREC) {
    m = roundDiv(m, pow10(n - PREC));
    e += n - PREC;
  }
  while (m % 10n === 0n) {
    m /= 10n;
    e++;
  }
  return { m, e };
}

/** Power of ten of the leading digit (123 -> 2, 0.05 -> -2). */
export const magnitude = (d: Dec): number => d.e + digitCount(d.m) - 1;

export const isZero = (d: Dec): boolean => d.m === 0n;
export const isNeg = (d: Dec): boolean => d.m < 0n;
export const neg = (d: Dec): Dec => ({ m: -d.m, e: d.e });

/** Too big to show (Windows' "Overflow"); vanishingly small values collapse to 0 instead. */
export const overflows = (d: Dec): boolean => d.m !== 0n && magnitude(d) > MAX_EXP;
export const clampTiny = (d: Dec): Dec => (d.m !== 0n && magnitude(d) < -MAX_EXP ? ZERO : d);

/** "-123.45", "0.", "1.5e+20" -> Dec (anything unparsable is 0). */
export function parseDec(s: string): Dec {
  const r = /^(-)?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s.trim());
  if (!r) return ZERO;
  const frac = r[3] ?? '';
  let m = BigInt((r[2] || '0') + frac);
  if (r[1]) m = -m;
  return norm(m, -frac.length + (r[4] ? parseInt(r[4], 10) : 0));
}

export const fromInt = (n: number): Dec => norm(BigInt(n), 0);

export function add(a: Dec, b: Dec): Dec {
  if (a.m === 0n) return b;
  if (b.m === 0n) return a;
  const e = Math.min(a.e, b.e);
  return norm(a.m * pow10(a.e - e) + b.m * pow10(b.e - e), e);
}

export const sub = (a: Dec, b: Dec): Dec => add(a, neg(b));

export const mul = (a: Dec, b: Dec): Dec => norm(a.m * b.m, a.e + b.e);

/** a / b; the caller must rule out b = 0. */
export function div(a: Dec, b: Dec): Dec {
  if (a.m === 0n) return ZERO;
  const shift = Math.max(0, PREC + 2 + digitCount(b.m) - digitCount(a.m));
  return norm(roundDiv(a.m * pow10(shift), b.m), a.e - b.e - shift);
}

/** floor(sqrt(n)) by Newton's method from an over-estimate. */
function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** Square root; the caller must rule out negatives. */
export function sqrt(a: Dec): Dec {
  if (a.m === 0n) return ZERO;
  let k = Math.max(0, 2 * PREC + 2 - digitCount(a.m));
  if ((((a.e - k) % 2) + 2) % 2 === 1) k++;
  return norm(isqrt(a.m * pow10(k)), (a.e - k) / 2);
}

/** "1234567" -> "1,234,567". */
export const group = (int: string): string => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * A value as the display shows it: rounded to 16 significant digits, thousands separators, and
 * Windows' scientific form ("1.e+16", "1.234567890123457e+20") once it no longer fits.
 */
export function formatDec(d: Dec, separators = true): string {
  if (d.m === 0n) return '0';
  const negative = d.m < 0n;
  let m = abs(d.m);
  let e = d.e;
  const n = digitCount(m);
  if (n > DISPLAY_DIGITS) {
    m = roundDiv(m, pow10(n - DISPLAY_DIGITS));
    e += n - DISPLAY_DIGITS;
  }
  let ds = m.toString();
  while (ds.length > 1 && ds.endsWith('0')) {
    ds = ds.slice(0, -1);
    e++;
  }
  const x = e + ds.length - 1;
  const g = separators ? group : (s: string) => s;
  let out: string;
  if (x >= DISPLAY_DIGITS || x < -8) {
    out = `${ds[0]}.${ds.slice(1)}e${x >= 0 ? '+' : '-'}${Math.abs(x)}`;
  } else if (e >= 0) {
    out = g(ds + '0'.repeat(e));
  } else {
    const point = ds.length + e;
    out = point > 0 ? `${g(ds.slice(0, point))}.${ds.slice(point)}` : `0.${'0'.repeat(-point)}${ds}`;
  }
  return negative ? `-${out}` : out;
}
