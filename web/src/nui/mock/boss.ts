import { t } from '@/i18n';
import type { MockHandler } from './index';
import { fail, ok } from './index';

// Browser mocks for the Business Manager (server/computers/boss.lua): an LSPD roster with Jessica
// Hale as Chief, a Renewed-Banking style society statement, and three civilians near the computer.
// State is module-level so promotions, firings, hires and transfers persist for the dev session.
// Errors use the server's own locale keys, so the wording matches the game exactly.

const JOB = { name: 'police', label: '洛圣都警察局' };
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

/** Online, but nowhere near the computer: only an offer by player ID reaches them. Ana declines. */
let elsewhere: { id: number; name: string; declines: boolean }[] = [
  { id: 7, name: 'Devon Price', declines: false },
  { id: 45, name: 'Ana Flores', declines: true },
];
const MY_ID = 1;

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
const COURTS = '圣安地列斯高等法院';

// [seconds ago, title, amount, kind, issuer, receiver, message] - newest first, like the server.
// One 'transfer' line (society as issuer) exercises the UI's unknown-kind heuristic.
const SEED: [number, string, number, string, string, string, string][] = [
  [2.4 * H, '罚款收入', 4850, 'deposit', COURTS, JOB.label, '罚单批次 #4471（17 张罚单）'],
  [9 * H, '装备采购', 12400, 'withdraw', JOB.label, 'Ammu-Nation Wholesale', 'PO-20931：执勤弹药与电击枪'],
  [20 * H, '公司资金存入', 25000, 'deposit', MY_NAME, JOB.label, '由 Jessica Hale 存入'],
  [1.4 * D, '拖车费收入', 3150, 'deposit', 'Hayes Auto Impound', JOB.label, '每周放车费'],
  [1.9 * D, '车辆保养', 8720, 'withdraw', JOB.label, 'Los Santos Customs', '车队保养：4 辆巡逻车、1 辆拦截者'],
  [2.5 * D, '罚款收入', 6300, 'deposit', COURTS, JOB.label, '罚单批次 #4470（22 张罚单）'],
  [3.1 * D, '工资发放', 38600, 'withdraw', JOB.label, '洛圣都警局工资科', '每周工资 - 9 名员工'],
  [3.6 * D, '市政预算拨款', 75000, 'deposit', '洛圣都市', JOB.label, '第四季度运营预算，第二批'],
  [4.2 * D, '转账至圆堡山医疗中心', 5000, 'transfer', JOB.label, '圆堡山医疗中心', '急救培训分摊费用'],
  [4.8 * D, '罚款收入', 5480, 'deposit', COURTS, JOB.label, '罚单批次 #4469（19 张罚单）'],
  [5.3 * D, '油卡结算', 4210, 'withdraw', JOB.label, 'Ron Petroleum', '九月车队燃油'],
  [5.9 * D, '证物拍卖所得', 14250, 'deposit', COURTS, JOB.label, '第 12-18 号拍品：查扣车辆'],
  [6.4 * D, '装备采购', 9860, 'withdraw', JOB.label, 'Ammu-Nation Wholesale', 'PO-20877：防弹衣（12 件）'],
  [7.0 * D, '公司资金支取', 10000, 'withdraw', JOB.label, MY_NAME, '由 Jessica Hale 支取'],
  [7.5 * D, '罚款收入', 7120, 'deposit', COURTS, JOB.label, '罚单批次 #4468（25 张罚单）'],
  [8.1 * D, '工资发放', 38600, 'withdraw', JOB.label, '洛圣都警局工资科', '每周工资 - 9 名员工'],
  [8.6 * D, '拖车费收入', 2780, 'deposit', 'Hayes Auto Impound', JOB.label, '每周放车费'],
  [9.0 * D, '无线电网络合同', 3400, 'withdraw', JOB.label, 'Lifeinvader 通信', '季度加密无线电费用'],
  [9.4 * D, '罚款收入', 4960, 'deposit', COURTS, JOB.label, '罚单批次 #4467（16 张罚单）'],
  [9.9 * D, '公司资金存入', 40000, 'deposit', MY_NAME, JOB.label, '由 Jessica Hale 存入'],
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
      hireById: true,
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

  // The real call blocks on the target's accept/decline prompt (up to ~20s). With byId the offer
  // reaches anyone online, near the computer or not.
  'boss:hire': async ({ id, byId }) => {
    const n = Number(id);
    if (byId === true) {
      if (!Number.isInteger(n) || n < 1) return fail(t('err.invalid'));
      if (n === MY_ID) return fail(t('boss.err_self'));
    }
    const target = nearby.find(p => p.id === n) ?? (byId === true ? elsewhere.find(p => p.id === n) : undefined);
    if (!target) return fail(byId === true ? t('boss.err_no_player', n) : t('boss.err_not_around'));
    await sleep(2500);
    if (!nearby.includes(target) && !elsewhere.includes(target)) return fail(t('boss.err_not_around'));
    if (target.declines) return fail(t('boss.err_declined'));
    nearby = nearby.filter(p => p !== target);
    elsewhere = elsewhere.filter(p => p !== target);
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
