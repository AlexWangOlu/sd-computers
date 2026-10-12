import { t } from '@/i18n';
import type { MockHandler } from './index';
import { fail, ok } from './index';

// Browser mocks for the Business Manager (server/computers/boss.lua): an LSPD roster with Jessica
// Hale as Chief, a Renewed-Banking style society statement, and three civilians near the computer.
// State is module-level so promotions, firings, hires and transfers persist for the dev session.
// Errors use the server's own locale keys, so the wording matches the game exactly.

const JOB = { name: 'police', label: 'Los Santos Police Department' };
const GRADES = [
  { level: 0, name: 'Recruit' },
  { level: 1, name: 'Officer' },
  { level: 2, name: 'Sergeant' },
  { level: 3, name: 'Lieutenant' },
  { level: 4, name: 'Chief', isboss: true },
];
const MY_CID = 'JH123';
const MY_NAME = 'Jessica Hale';
const MAX_TRANSFER = 1000000;
const TX_LIMIT = 50;

interface MockEmployee {
  cid: string;
  name: string;
  grade: number;
  online: boolean;
  onDuty: boolean;
}

interface MockTx {
  id: string;
  title: string;
  amount: number;
  kind: string;
  issuer: string;
  receiver: string;
  message: string;
  time: number;
}

const employees: MockEmployee[] = [
  { cid: MY_CID, name: MY_NAME, grade: 4, online: true, onDuty: true },
  { cid: 'RC771', name: 'Raymond Cole', grade: 4, online: false, onDuty: false },
  { cid: 'MD482', name: 'Marcus Delgado', grade: 3, online: true, onDuty: true },
  { cid: 'PN217', name: 'Priya Nair', grade: 2, online: true, onDuty: false },
  { cid: 'TB905', name: 'Tom Becker', grade: 2, online: false, onDuty: false },
  { cid: 'AB331', name: 'Aaliyah Brooks', grade: 1, online: true, onDuty: true },
  { cid: 'SM764', name: 'Sofia Marin', grade: 1, online: true, onDuty: true },
  { cid: 'CW118', name: 'Connor Walsh', grade: 1, online: false, onDuty: false },
  { cid: 'DO559', name: 'Dante Okafor', grade: 0, online: true, onDuty: false },
];

/** Ricky declines the offer; the other two accept. */
let nearby: { id: number; name: string; declines: boolean }[] = [
  { id: 14, name: 'Kevin Moore', declines: false },
  { id: 22, name: 'Lena Fischer', declines: false },
  { id: 31, name: 'Ricky Alvarez', declines: true },
];

/** The boss's own money (deposits come out of it, withdrawals land in bank). */
const wallet: Record<string, number> = { bank: 185400, cash: 3420 };

const now = (): number => Math.floor(Date.now() / 1000);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

const H = 3600;
const D = 86400;
const COURTS = 'San Andreas Superior Court';

// [seconds ago, title, amount, kind, issuer, receiver, message] - newest first, like the server.
// One 'transfer' line (society as issuer) exercises the UI's unknown-kind heuristic.
const SEED: [number, string, number, string, string, string, string][] = [
  [2.4 * H, 'Fine revenue', 4850, 'deposit', COURTS, JOB.label, 'Citation batch #4471 (17 citations)'],
  [9 * H, 'Equipment order', 12400, 'withdraw', JOB.label, 'Ammu-Nation Wholesale', 'PO-20931: duty ammunition and tasers'],
  [20 * H, 'Society deposit', 25000, 'deposit', MY_NAME, JOB.label, 'Deposit by Jessica Hale'],
  [1.4 * D, 'Impound fees', 3150, 'deposit', 'Hayes Auto Impound', JOB.label, 'Weekly impound release fees'],
  [1.9 * D, 'Vehicle maintenance', 8720, 'withdraw', JOB.label, 'Los Santos Customs', 'Fleet service: 4 cruisers, 1 interceptor'],
  [2.5 * D, 'Fine revenue', 6300, 'deposit', COURTS, JOB.label, 'Citation batch #4470 (22 citations)'],
  [3.1 * D, 'Payroll', 38600, 'withdraw', JOB.label, 'LSPD Payroll', 'Weekly payroll - 9 employees'],
  [3.6 * D, 'City budget allocation', 75000, 'deposit', 'City of Los Santos', JOB.label, 'Q4 operating budget, tranche 2'],
  [4.2 * D, 'Transfer to Pillbox Medical', 5000, 'transfer', JOB.label, 'Pillbox Hill Medical Center', 'Shared first-aid training costs'],
  [4.8 * D, 'Fine revenue', 5480, 'deposit', COURTS, JOB.label, 'Citation batch #4469 (19 citations)'],
  [5.3 * D, 'Fuel card settlement', 4210, 'withdraw', JOB.label, 'Ron Petroleum', 'September fleet fuel'],
  [5.9 * D, 'Evidence auction proceeds', 14250, 'deposit', COURTS, JOB.label, 'Lots 12-18: seized vehicles'],
  [6.4 * D, 'Equipment order', 9860, 'withdraw', JOB.label, 'Ammu-Nation Wholesale', 'PO-20877: body armour (12)'],
  [7.0 * D, 'Society withdrawal', 10000, 'withdraw', JOB.label, MY_NAME, 'Withdrawal by Jessica Hale'],
  [7.5 * D, 'Fine revenue', 7120, 'deposit', COURTS, JOB.label, 'Citation batch #4468 (25 citations)'],
  [8.1 * D, 'Payroll', 38600, 'withdraw', JOB.label, 'LSPD Payroll', 'Weekly payroll - 9 employees'],
  [8.6 * D, 'Impound fees', 2780, 'deposit', 'Hayes Auto Impound', JOB.label, 'Weekly impound release fees'],
  [9.0 * D, 'Radio network contract', 3400, 'withdraw', JOB.label, 'Lifeinvader Comms', 'Quarterly encrypted radio fee'],
  [9.4 * D, 'Fine revenue', 4960, 'deposit', COURTS, JOB.label, 'Citation batch #4467 (16 citations)'],
  [9.9 * D, 'Society deposit', 40000, 'deposit', MY_NAME, JOB.label, 'Deposit by Jessica Hale'],
];

let balance = 284650;
let txs: MockTx[] = SEED.map(([ago, title, amount, kind, issuer, receiver, message]) => ({
  id: uuid(),
  title,
  amount,
  kind,
  issuer,
  receiver,
  message,
  time: now() - Math.round(ago),
}));

const myGrade = (): number => employees.find(e => e.cid === MY_CID)?.grade ?? 4;
const gradeName = (level: number): string => GRADES.find(g => g.level === level)?.name ?? String(level);

const record = (tx: Omit<MockTx, 'id' | 'time'>) => {
  txs = [{ ...tx, id: uuid(), time: now() }, ...txs].slice(0, TX_LIMIT);
};

/** boss.lua amountOf: whole dollars in (0, MaxTransfer], else nil. */
const amountOf = (v: unknown): number | null => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 && n <= MAX_TRANSFER ? n : null;
};

const newCid = (name: string): string => {
  const letters = name.split(/\s+/).map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || 'XX';
  let cid = '';
  do {
    cid = letters + String(100 + Math.floor(Math.random() * 900));
  } while (employees.some(e => e.cid === cid));
  return cid;
};

const handlers: Record<string, MockHandler> = {
  'boss:overview': () =>
    ok({
      job: JOB,
      grades: GRADES,
      myGrade: myGrade(),
      myCid: MY_CID,
      counts: {
        total: employees.length,
        online: employees.filter(e => e.online).length,
        onDuty: employees.filter(e => e.onDuty).length,
      },
      funds: {
        available: true,
        balance,
        transactions: txs.map(tx => ({ ...tx })),
        depositFrom: ['bank', 'cash'],
        withdrawTo: 'bank',
        max: MAX_TRANSFER,
      },
    }),

  'boss:employees': () =>
    ok(
      [...employees]
        .sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name))
        .map(e => ({ ...e, gradeName: gradeName(e.grade) })),
    ),

  'boss:setGrade': ({ cid, grade }) => {
    const level = Number(grade);
    if (typeof cid !== 'string' || !Number.isInteger(level)) return fail(t('err.invalid'));
    if (cid === MY_CID) return fail(t('boss.err_self'));
    if (!GRADES.some(g => g.level === level)) return fail(t('err.invalid'));
    const e = employees.find(x => x.cid === cid);
    if (!e) return fail(t('boss.err_not_employee'));
    const mine = myGrade();
    if (e.grade >= mine || level >= mine) return fail(t('boss.err_rank'));
    e.grade = level;
    return ok();
  },

  'boss:fire': ({ cid }) => {
    if (typeof cid !== 'string') return fail(t('err.invalid'));
    if (cid === MY_CID) return fail(t('boss.err_self'));
    const i = employees.findIndex(x => x.cid === cid);
    if (i < 0) return fail(t('boss.err_not_employee'));
    if (employees[i].grade >= myGrade()) return fail(t('boss.err_rank'));
    employees.splice(i, 1);
    return ok();
  },

  'boss:nearby': () => ok([...nearby].sort((a, b) => a.name.localeCompare(b.name)).map(({ id, name }) => ({ id, name }))),

  // The real call blocks on the target's accept/decline prompt (up to ~20s).
  'boss:hire': async ({ id }) => {
    const target = nearby.find(p => p.id === Number(id));
    if (!target) return fail(t('boss.err_not_around'));
    await sleep(2500);
    if (!nearby.includes(target)) return fail(t('boss.err_not_around'));
    if (target.declines) return fail(t('boss.err_declined'));
    nearby = nearby.filter(p => p !== target);
    employees.push({ cid: newCid(target.name), name: target.name, grade: 0, online: true, onDuty: false });
    return ok({ name: target.name });
  },

  'boss:deposit': ({ amount, from }) => {
    const n = amountOf(amount);
    if (n === null) return fail(t('boss.err_amount'));
    if (typeof from !== 'string' || !(from in wallet)) return fail(t('err.invalid'));
    if (wallet[from] < n) return fail(t('boss.err_broke'));
    wallet[from] -= n;
    balance += n;
    record({ title: t('boss.tx_deposit'), amount: n, kind: 'deposit', issuer: MY_NAME, receiver: JOB.label, message: t('boss.tx_deposit_msg', MY_NAME) });
    return ok({ balance });
  },

  'boss:withdraw': ({ amount }) => {
    const n = amountOf(amount);
    if (n === null) return fail(t('boss.err_amount'));
    if (n > balance) return fail(t('boss.err_society_broke'));
    balance -= n;
    wallet.bank += n;
    record({ title: t('boss.tx_withdraw'), amount: n, kind: 'withdraw', issuer: JOB.label, receiver: MY_NAME, message: t('boss.tx_withdraw_msg', MY_NAME) });
    return ok({ balance });
  },
};

export default handlers;
