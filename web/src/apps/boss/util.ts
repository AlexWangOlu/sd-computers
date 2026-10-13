import { t } from '@/i18n';
import { fmtMoney } from '@/lib/format';
import type { Employee, Grade, Nearby, Overview, Tx } from './types';

/**
 * Lua -> JSON turns an EMPTY table into `{}` rather than `[]` (an empty roster, nobody nearby, a
 * fresh society statement), so every list from the server goes through this before it's mapped.
 */
export const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function normOverview(raw: unknown): Overview {
  const o = (raw ?? {}) as Partial<Overview>;
  const funds = (o.funds ?? { available: false }) as Overview['funds'];
  return {
    job: { name: o.job?.name ?? '', label: o.job?.label ?? o.job?.name ?? '' },
    grades: asArray<Grade>(o.grades)
      .map(g => ({ ...g, level: num(g.level) }))
      .sort((a, b) => a.level - b.level),
    // Unknown grade (should not happen) = manage nobody.
    myGrade: typeof o.myGrade === 'number' ? o.myGrade : -1,
    myCid: o.myCid ?? '',
    hireById: o.hireById === true,
    counts: { total: num(o.counts?.total), online: num(o.counts?.online), onDuty: num(o.counts?.onDuty) },
    funds: {
      available: !!funds.available,
      balance: typeof funds.balance === 'number' ? funds.balance : null,
      transactions: asArray<Tx>(funds.transactions).map(tx => ({ ...tx, amount: num(tx.amount), time: num(tx.time) })),
      depositFrom: asArray<string>(funds.depositFrom),
      withdrawTo: funds.withdrawTo ?? 'bank',
      max: num(funds.max, 1000000) || 1000000,
    },
  };
}

export const normEmployees = (raw: unknown): Employee[] =>
  asArray<Employee>(raw).map(e => ({ ...e, grade: num(e.grade), online: !!e.online, onDuty: !!e.onDuty }));

export const normNearby = (raw: unknown): Nearby[] => asArray<Nearby>(raw);

/** "Jessica Hale" -> "JH", "Madonna" -> "MA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Words that mark an unknown transaction kind as money LEAVING the society.
const OUTGOING = /withdraw|debit|out|remov|pay|purchase|fee|charge|expense|sent|send/i;

/**
 * Signed effect of one statement line on the society balance (+ in, - out).
 *
 * Renewed-Banking / sd-banking store `amount` as a positive number and put the direction in
 * `trans_type` ('deposit' | 'withdraw'), so those two map directly. Anything else (another
 * backend, a 'transfer', a custom kind from a third-party resource) is resolved in this order:
 *   1. a negative amount is a debit, whatever the kind says;
 *   2. the society as `issuer` means money went out, as `receiver` means money came in
 *      (society.lua writes deposits as person -> society and withdrawals as society -> person);
 *   3. otherwise a kind that reads like "withdraw" / "transfer out" / "payment" / "fee" is a
 *      debit, and everything else is treated as a credit.
 */
export function txDelta(tx: Tx, jobLabel: string): number {
  const raw = num(tx.amount);
  const amt = Math.abs(raw);
  if (raw < 0) return -amt;
  const kind = String(tx.kind ?? '').toLowerCase();
  if (kind === 'deposit') return amt;
  if (kind === 'withdraw') return -amt;
  if (jobLabel && tx.issuer === jobLabel && tx.receiver !== jobLabel) return -amt;
  if (jobLabel && tx.receiver === jobLabel && tx.issuer !== jobLabel) return amt;
  return OUTGOING.test(kind) ? -amt : amt;
}

/** +$1,250 / −$980 (true minus sign, so columns of amounts line up). */
export const fmtSigned = (delta: number): string => (delta < 0 ? '−' : '+') + fmtMoney(Math.abs(delta));

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

/** 'bank' -> "Bank", 'cash' -> "Cash", anything else capitalised as-is. */
export function sourceLabel(source: string): string {
  if (source === 'bank') return t('ui.boss.source_bank');
  if (source === 'cash') return t('ui.boss.source_cash');
  return source ? source[0].toUpperCase() + source.slice(1) : '';
}

export function withdrawNote(to: string): string {
  if (to === 'bank') return t('ui.boss.withdraw_to_bank');
  if (to === 'cash') return t('ui.boss.withdraw_to_cash');
  return t('ui.boss.withdraw_to_other', sourceLabel(to));
}

export const gradeName = (grades: Grade[], level: number): string =>
  grades.find(g => g.level === level)?.name ?? String(level);

// ── Grade rules: server-enforced in boss.lua, mirrored here so the UI never offers a refusal ──

/** Grades a boss may assign: strictly below their own (ascending). */
export const assignableGrades = (ov: Overview): Grade[] => ov.grades.filter(g => g.level < ov.myGrade);

/** Never yourself, only people strictly below your own grade. */
export const canManage = (ov: Overview, e: Employee): boolean => e.cid !== ov.myCid && e.grade < ov.myGrade;

/** Why a row is locked (only meaningful when !canManage). */
export const lockReason = (ov: Overview, e: Employee): string =>
  e.cid === ov.myCid ? t('ui.boss.lock_self') : t('ui.boss.lock_rank');

/** The next assignable grade above the employee's, if any. */
export const promoteTarget = (ov: Overview, e: Employee): Grade | undefined =>
  assignableGrades(ov).find(g => g.level > e.grade);

/** The next grade below the employee's, if any. */
export const demoteTarget = (ov: Overview, e: Employee): Grade | undefined => {
  const lower = assignableGrades(ov).filter(g => g.level < e.grade);
  return lower[lower.length - 1];
};
