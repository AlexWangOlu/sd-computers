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
const JOB = 'Los Santos Police Department';
const JESS_MAIL = 'jessica.hale@lsmail.com';
const MIKE_MAIL = 'mike.reyes@lsmail.com';

/** [minutes ago, level, source, event id, message, actor, data] - oldest first. */
type Row = [number, Level, string, number, string, string | null, Record<string, unknown>?];

const logon = (m: number, who: string): Row => [m, 'success', 'Security', 4624, `An account was successfully logged on. Account: ${who}`, who];
const logoff = (m: number, who: string): Row => [m, 'success', 'Security', 4634, `An account was logged off. Account: ${who}`, who];
const badPin = (m: number, who: string): Row => [m, 'failure', 'Security', 4625, `An account failed to log on (incorrect PIN). Account: ${who}`, who];
const app = (m: number, label: string, who: string): Row => [m, 'information', 'Shell', 1000, `Application started: ${label} (user ${who})`, who];
const sent = (m: number, who: string, from: string, to: string[], subject: string): Row => [
  m, 'information', 'Mail', 3001, `Mail sent from ${from} to ${to.join(', ')} - "${subject}"`, who, { from, to, subject, failed: [] },
];

const ROWS: Row[] = [
  logon(2872, MIKE),
  app(2870, 'Mail', MIKE),
  [2868, 'success', 'Mail', 3002, `Mail account ${MIKE_MAIL} signed in by ${MIKE}`, MIKE],
  sent(2853, MIKE, MIKE_MAIL, [JESS_MAIL], 'Shift handover - Sunday nights'),
  app(2841, 'Business Manager', MIKE),
  [2835, 'information', 'Business', 6004, `${MIKE} deposited $2500 into ${JOB}`, MIKE, { amount: 2500, from: 'cash' }],
  app(2801, 'Command Prompt', MIKE),
  [2796, 'information', 'Hack', 7001, 'net-maze.exe (easy) completed in 48s', MIKE],
  [2789, 'warning', 'Hack', 7002, 'cipher-lock.exe (medium) terminated - process failed', MIKE],
  [2783, 'information', 'Hack', 7001, 'pipe-route.exe (medium) completed in 61s', MIKE],
  [2770, 'information', 'Mail', 3003, `Mail account ${MIKE_MAIL} signed out by ${MIKE}`, MIKE],
  logoff(2766, MIKE),
  [2352, 'information', 'sd-doors', 9000, 'Evidence locker door opened', null, { door: 'mrpd_evidence_1', badge: 'LSPD-4471', method: 'keycard' }],
  [2350, 'information', 'sd-doors', 9000, 'Evidence locker door closed', null, { door: 'mrpd_evidence_1', openFor: 94 }],
  badPin(2112, MIKE),
  badPin(2112, MIKE),
  badPin(2111, MIKE),
  [2111, 'failure', 'Security', 4740, `A user account was locked out. Account: ${MIKE}, duration: 60 seconds`, MIKE],
  logon(2109, MIKE),
  app(2108, 'Command Prompt', MIKE),
  [2105, 'warning', 'Security', 7101, 'Unauthorised access attempt against Fleeca Bank - branch ledger relay', MIKE],
  [2101, 'failure', 'Security', 7103, 'Intrusion attempt against Fleeca Bank - branch ledger relay was blocked', MIKE],
  logoff(2099, MIKE),
  logon(1428, JESS),
  app(1427, 'Mail', JESS),
  [1426, 'success', 'Mail', 3002, `Mail account ${JESS_MAIL} signed in by ${JESS}`, JESS],
  sent(1412, JESS, JESS_MAIL, [MIKE_MAIL], 'Re: Shift handover - Sunday nights'),
  sent(1404, JESS, JESS_MAIL, ['captain.ward@lsmail.com', 'sgt.oneil@lsmail.com'], 'Evidence locker access at 03:00'),
  app(1396, 'Business Manager', JESS),
  [1391, 'information', 'Business', 6001, `${JESS} hired Daniel Cho into ${JOB}`, JESS, { cid: 'QBX48213' }],
  [1388, 'information', 'Business', 6003, `${JESS} changed Daniel Cho from Cadet to Officer`, JESS, { cid: 'QBX48213', from: 0, to: 1 }],
  [1383, 'information', 'Business', 6002, `${JESS} removed ${MIKE} from ${JOB}`, JESS, { cid: 'QBX11872' }],
  [1377, 'information', 'Business', 6005, `${JESS} withdrew $1200 from ${JOB}`, JESS, { amount: 1200 }],
  [1372, 'information', 'Business', 6004, `${JESS} deposited $5000 into ${JOB}`, JESS, { amount: 5000, from: 'bank' }],
  [1350, 'information', 'Mail', 3003, `Mail account ${JESS_MAIL} signed out by ${JESS}`, JESS],
  logoff(1348, JESS),
  [905, 'information', 'sd-doors', 9000, 'Evidence locker door opened', null, { door: 'mrpd_evidence_1', badge: 'LSPD-2210', method: 'keycard' }],
  [903, 'error', 'sd-doors', 9000, 'Evidence locker door forced - lock integrity fault', null, { door: 'mrpd_evidence_1', sensor: 'reed switch B', state: 'tamper' }],
  logon(611, JESS),
  app(609, 'Command Prompt', JESS),
  [606, 'information', 'Hack', 7001, 'code-inject.exe (hard) completed in 74s', JESS],
  [599, 'warning', 'Hack', 7002, 'fw-defense.exe (hard) terminated - process failed', JESS],
  [593, 'information', 'Hack', 7001, 'sig-replay.exe (medium) completed in 39s', JESS],
  [530, 'warning', 'sd-cctv', 9000, 'Camera 3 (evidence corridor) went offline', null, { camera: 3, reason: 'signal lost' }],
  [524, 'information', 'sd-cctv', 9000, 'Camera 3 (evidence corridor) is back online', null, { camera: 3, downtime: 362 }],
  logoff(478, JESS),
  badPin(266, JESS),
  logon(265, JESS),
  app(264, 'Mail', JESS),
  sent(257, JESS, JESS_MAIL, ['dispatch@lsmail.com'], 'Locker audit request'),
  [251, 'information', 'Mail', 3004, `Mail account frontdesk@lsmail.com created by ${JESS}`, JESS],
  app(246, 'Event Viewer', JESS),
  app(240, 'Notepad', JESS),
  logoff(188, JESS),
  logon(79, MIKE),
  app(78, 'Command Prompt', MIKE),
  [76, 'information', 'Hack', 7001, 'net-maze.exe (hard) completed in 71s', MIKE],
  [69, 'warning', 'Security', 7101, 'Unauthorised access attempt against MRPD CCTV uplink', MIKE],
  [61, 'error', 'Security', 7102, 'SECURITY BREACH: MRPD CCTV uplink was compromised', MIKE],
  [58, 'information', 'sd-doors', 9000, 'Evidence locker door opened', null, { door: 'mrpd_evidence_1', badge: 'LSPD-4471', method: 'keycard' }],
  [52, 'failure', 'Mail', 3002, `Failed sign-in to mail account ${JESS_MAIL} by ${MIKE}`, MIKE],
  logoff(49, MIKE),
  logon(21, JESS),
  app(20, 'Event Viewer', JESS),
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
        message: `The audit log was cleared. Subject: ${mockPayload.user.name}`,
        actor_name: mockPayload.user.name,
        ts: Math.floor(Date.now() / 1000),
      },
    ];
    return ok();
  },
};

export default handlers;
