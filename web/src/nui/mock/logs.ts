import type { MockHandler } from './index';
import { ok } from './index';
import { mockPayload } from './payload';

// Browser mocks for Event Viewer (server/computers/shell.lua logs:page / logs:clear over
// logs.lua + store.lua). ~65 entries spread over the last two days, written in the server's own
// message formats (locales/en.json logs.*). PAGE_SIZE is small on purpose so "Load more" shows.

type Level = 'information' | 'warning' | 'error' | 'success' | 'failure';

interface MockEntry {
  id: number;
  level: Level;
  source: string;
  event_id: number;
  message: string;
  actor_name: string | null;
  data?: Record<string, unknown>;
  ts: number;
}

const PAGE_SIZE = 40;
const JESS = 'Jessica Hale';
const MIKE = 'Mike Reyes';
const JOB = '洛圣都警察局';
const JESS_MAIL = 'jessica.hale@lsmail.com';
const MIKE_MAIL = 'mike.reyes@lsmail.com';

/** [minutes ago, level, source, event id, message, actor, data] - oldest first. */
type Row = [number, Level, string, number, string, string | null, Record<string, unknown>?];

const logon = (m: number, who: string): Row => [m, 'success', 'Security', 4624, `账户登录成功。账户：${who}`, who];
const logoff = (m: number, who: string): Row => [m, 'success', 'Security', 4634, `账户已注销。账户：${who}`, who];
const badPin = (m: number, who: string): Row => [m, 'failure', 'Security', 4625, `账户登录失败（PIN 错误）。账户：${who}`, who];
const app = (m: number, label: string, who: string): Row => [m, 'information', 'Shell', 1000, `应用程序已启动：${label}（用户 ${who}）`, who];
const sent = (m: number, who: string, from: string, to: string[], subject: string): Row => [
  m, 'information', 'Mail', 3001, `邮件已从 ${from} 发送至 ${to.join(', ')}，主题“${subject}”`, who, { from, to, subject, failed: [] },
];

const ROWS: Row[] = [
  logon(2872, MIKE),
  app(2870, '邮件', MIKE),
  [2868, 'success', 'Mail', 3002, `邮件账户 ${MIKE_MAIL} 登录成功，操作者：${MIKE}`, MIKE],
  sent(2853, MIKE, MIKE_MAIL, [JESS_MAIL], '周末夜班交接'),
  app(2841, '经营管理', MIKE),
  [2835, 'information', 'Business', 6004, `${MIKE} 已将 $2500 存入 ${JOB}`, MIKE, { amount: 2500, from: 'cash' }],
  app(2801, '命令提示符', MIKE),
  [2796, 'information', 'Hack', 7001, 'net-maze.exe（easy）已完成，用时 48s', MIKE],
  [2789, 'warning', 'Hack', 7002, 'cipher-lock.exe（medium）已终止，进程失败', MIKE],
  [2783, 'information', 'Hack', 7001, 'pipe-route.exe（medium）已完成，用时 61s', MIKE],
  [2770, 'information', 'Mail', 3003, `邮件账户 ${MIKE_MAIL} 已注销，操作者：${MIKE}`, MIKE],
  logoff(2766, MIKE),
  [2352, 'information', 'sd-doors', 9000, '证物柜门已打开', null, { door: 'mrpd_evidence_1', badge: 'LSPD-4471', method: 'keycard' }],
  [2350, 'information', 'sd-doors', 9000, '证物柜门已关闭', null, { door: 'mrpd_evidence_1', openFor: 94 }],
  badPin(2112, MIKE),
  badPin(2112, MIKE),
  badPin(2111, MIKE),
  [2111, 'failure', 'Security', 4740, `用户账户已被锁定。账户：${MIKE}，时长：60 秒`, MIKE],
  logon(2109, MIKE),
  app(2108, '命令提示符', MIKE),
  [2105, 'warning', 'Security', 7101, '对 Fleeca 银行 - 分行账本中继 的未授权访问尝试', MIKE],
  [2101, 'failure', 'Security', 7103, '针对 Fleeca 银行 - 分行账本中继 的入侵尝试已被拦截', MIKE],
  logoff(2099, MIKE),
  logon(1428, JESS),
  app(1427, '邮件', JESS),
  [1426, 'success', 'Mail', 3002, `邮件账户 ${JESS_MAIL} 登录成功，操作者：${JESS}`, JESS],
  sent(1412, JESS, JESS_MAIL, [MIKE_MAIL], '回复：周末夜班交接'),
  sent(1404, JESS, JESS_MAIL, ['captain.ward@lsmail.com', 'sgt.oneil@lsmail.com'], '03:00 证物柜取用'),
  app(1396, '经营管理', JESS),
  [1391, 'information', 'Business', 6001, `${JESS} 已将 Daniel Cho 招入 ${JOB}`, JESS, { cid: 'QBX48213' }],
  [1388, 'information', 'Business', 6003, `${JESS} 已将 Daniel Cho 的职级从 Cadet 改为 Officer`, JESS, { cid: 'QBX48213', from: 0, to: 1 }],
  [1383, 'information', 'Business', 6002, `${JESS} 已将 ${MIKE} 移出 ${JOB}`, JESS, { cid: 'QBX11872' }],
  [1377, 'information', 'Business', 6005, `${JESS} 已将 $1200 从 ${JOB} 支取`, JESS, { amount: 1200 }],
  [1372, 'information', 'Business', 6004, `${JESS} 已将 $5000 存入 ${JOB}`, JESS, { amount: 5000, from: 'bank' }],
  [1350, 'information', 'Mail', 3003, `邮件账户 ${JESS_MAIL} 已注销，操作者：${JESS}`, JESS],
  logoff(1348, JESS),
  [905, 'information', 'sd-doors', 9000, '证物柜门已打开', null, { door: 'mrpd_evidence_1', badge: 'LSPD-2210', method: 'keycard' }],
  [903, 'error', 'sd-doors', 9000, '证物柜门被强行打开 - 锁具完整性故障', null, { door: 'mrpd_evidence_1', sensor: 'reed switch B', state: 'tamper' }],
  logon(611, JESS),
  app(609, '命令提示符', JESS),
  [606, 'information', 'Hack', 7001, 'code-inject.exe（hard）已完成，用时 74s', JESS],
  [599, 'warning', 'Hack', 7002, 'fw-defense.exe（hard）已终止，进程失败', JESS],
  [593, 'information', 'Hack', 7001, 'sig-replay.exe（medium）已完成，用时 39s', JESS],
  [530, 'warning', 'sd-cctv', 9000, '摄像头 3（证物走廊）已离线', null, { camera: 3, reason: 'signal lost' }],
  [524, 'information', 'sd-cctv', 9000, '摄像头 3（证物走廊）已重新上线', null, { camera: 3, downtime: 362 }],
  logoff(478, JESS),
  badPin(266, JESS),
  logon(265, JESS),
  app(264, '邮件', JESS),
  sent(257, JESS, JESS_MAIL, ['dispatch@lsmail.com'], '证物柜审计请求'),
  [251, 'information', 'Mail', 3004, `邮件账户 frontdesk@lsmail.com 已创建，操作者：${JESS}`, JESS],
  app(246, '事件查看器', JESS),
  app(240, '记事本', JESS),
  logoff(188, JESS),
  logon(79, MIKE),
  app(78, '命令提示符', MIKE),
  [76, 'information', 'Hack', 7001, 'net-maze.exe（hard）已完成，用时 71s', MIKE],
  [69, 'warning', 'Security', 7101, '对 米申罗警局监控上行链路 的未授权访问尝试', MIKE],
  [61, 'error', 'Security', 7102, '安全入侵：米申罗警局监控上行链路 已被攻破', MIKE],
  [58, 'information', 'sd-doors', 9000, '证物柜门已打开', null, { door: 'mrpd_evidence_1', badge: 'LSPD-4471', method: 'keycard' }],
  [52, 'failure', 'Mail', 3002, `邮件账户 ${JESS_MAIL} 登录失败，操作者：${MIKE}`, MIKE],
  logoff(49, MIKE),
  logon(21, JESS),
  app(20, '事件查看器', JESS),
];

const now = Math.floor(Date.now() / 1000);
let entries: MockEntry[] = ROWS.map(([m, level, source, event_id, message, actor_name, data], i) => ({
  id: i + 1,
  level,
  source,
  event_id,
  message,
  actor_name,
  data,
  // a few seconds of jitter so same-minute events keep their order
  ts: now - m * 60 + i * 7 - (ROWS.length * 7),
}));
let nextId = entries.length + 1;

const summary = () => {
  const counts: Partial<Record<Level, number>> = {};
  for (const e of entries) counts[e.level] = (counts[e.level] ?? 0) + 1;
  const sources = [...new Set(entries.map(e => e.source))].sort((a, b) => a.localeCompare(b));
  return { counts, sources };
};

const handlers: Record<string, MockHandler> = {
  'logs:page': p => {
    const f = (p.filter ?? {}) as { level?: string; source?: string; search?: string; beforeId?: number };
    const q = typeof f.search === 'string' ? f.search.toLowerCase() : '';
    const rows = entries
      .filter(
        e =>
          (!f.level || e.level === f.level) &&
          (!f.source || e.source === f.source) &&
          (!q || e.message.toLowerCase().includes(q) || (e.actor_name ?? '').toLowerCase().includes(q)) &&
          (typeof f.beforeId !== 'number' || e.id < f.beforeId),
      )
      .sort((a, b) => b.id - a.id)
      .slice(0, PAGE_SIZE);
    return ok({
      entries: rows,
      ...summary(),
      pageSize: PAGE_SIZE,
      canClear: true,
      computer: { hostname: mockPayload.computer.hostname, label: mockPayload.computer.label },
    });
  },
  'logs:clear': () => {
    entries = [
      {
        id: nextId++,
        level: 'warning',
        source: 'Eventlog',
        event_id: 1102,
        message: `审核日志已清空。主体：${mockPayload.user.name}`,
        actor_name: mockPayload.user.name,
        ts: Math.floor(Date.now() / 1000),
      },
    ];
    return ok();
  },
};

export default handlers;
