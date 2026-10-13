import { fmtMoney } from '@/lib/format';
import type { Overview, Source, Tx } from './types';

/**
 * Lua -> JSON turns an EMPTY table into `{}` rather than `[]` (an account with no transactions
 * yet), so the statement goes through this before it's mapped.
 */
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

const SOURCES: Source[] = ['phone', 'banking', 'none'];

/** bank:overview as the page uses it. The server normalises the rows; this only guards the types. */
export function normOverview(raw: unknown): Overview {
  const o = (raw ?? {}) as Partial<Record<keyof Overview, unknown>>;
  return {
    name: str(o.name),
    bank: num(o.bank),
    cash: num(o.cash),
    source: SOURCES.includes(o.source as Source) ? (o.source as Source) : 'none',
    transactions: asArray<Partial<Record<keyof Tx, unknown>>>(o.transactions).map((tx, i) => ({
      id: str(tx.id) || `row-${i}`,
      title: str(tx.title),
      amount: Math.abs(num(tx.amount)),
      kind: tx.kind === 'withdraw' ? 'withdraw' : 'deposit',
      issuer: str(tx.issuer),
      receiver: str(tx.receiver),
      message: str(tx.message),
      time: num(tx.time),
    })),
  };
}

/** Signed effect of one statement line on the bank balance (+ in, - out). */
export const txDelta = (tx: Tx): number => (tx.kind === 'withdraw' ? -tx.amount : tx.amount);

/** +$1,250 / −$980 (true minus sign, so columns of amounts line up). */
export const fmtSigned = (delta: number): string => (delta < 0 ? '−' : '+') + fmtMoney(Math.abs(delta));

/** A balance: $1,250, or −$980 for an overdrawn one (fmtMoney alone would write "$-980"). */
export const fmtBalance = (n: number): string => (Math.round(n) < 0 ? '−' : '') + fmtMoney(Math.abs(n));

const trimFixed = (v: number, digits: number): string => {
  const s = v.toFixed(digits);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};

/** Axis labels: $950 / $12.5K / $1.25M. */
export function fmtCompactMoney(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const digits = (v: number) => (v >= 100 ? 0 : v >= 10 ? 1 : 2);
  if (a >= 1e6) return `${sign}$${trimFixed(a / 1e6, digits(a / 1e6))}M`;
  if (a >= 1e3) return `${sign}$${trimFixed(a / 1e3, digits(a / 1e3))}K`;
  return `${sign}$${Math.round(a)}`;
}

/**
 * Whether a statement line matches the search box: the text anywhere in its description, either
 * party or its message, or - typed as a number ("1250", "$1,250") - anywhere in its amount.
 */
export function matchesSearch(tx: Tx, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (`${tx.title}\n${tx.issuer}\n${tx.receiver}\n${tx.message}`.toLowerCase().includes(q)) return true;
  const digits = q.replace(/[$,\s]/g, '');
  return /^\d+$/.test(digits) && String(Math.round(tx.amount)).includes(digits);
}
