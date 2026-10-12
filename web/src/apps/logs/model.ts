import { t } from '@/i18n';
import { fmtStamp } from '@/lib/format';
import type { Entry, Level, LevelCheck, Logged, NodeId, Page, ServerFilter, Sort, UserFilter } from './types';

// Pure Event Viewer logic: which log an entry belongs to, the derived columns (Task Category,
// Keywords), the filter (server half + client half), sorting, and the text/XML renderings.

export const L = (key: string, ...args: unknown[]): string => t(`ui.logs.${key}`, ...args);

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Display order of levels (Summary of Administrative Events, sorting). */
export const LEVELS: Level[] = ['error', 'warning', 'information', 'success', 'failure'];
const LEVEL_SET = new Set<string>(LEVELS);

export const levelLabel = (l: Level): string => L(`level_${l}`);

// ── Logs (the console tree's leaves) ────────────────────────────────────────────────────────

export type Category = 'application' | 'security' | 'system';

/** Security = 'Security'; System = 'Eventlog' + 'Shell'; Application = everything else. */
export const categoryOf = (source: string): Category =>
  source === 'Security' ? 'security' : source === 'Eventlog' || source === 'Shell' ? 'system' : 'application';

export interface LogDef {
  /** Which entries belong (client-side). */
  match: (e: Entry) => boolean;
  /** A single source the server can filter on for this log. */
  serverSource?: string;
  /** Never holds anything on this computer (Setup, Forwarded Events, the services logs). */
  empty?: boolean;
  /** Clear Log… applies (the three real logs). */
  clearable?: boolean;
  kind: 'admin' | 'operational' | 'custom';
  /** Maximum size shown in Properties / Log Summary (KB). */
  maxKb: number;
  file?: string;
}

const none = () => false;

export const LOG_DEFS: Partial<Record<NodeId, LogDef>> = {
  application: { match: e => categoryOf(e.source) === 'application', clearable: true, kind: 'admin', maxKb: 20480, file: 'Application' },
  security: { match: e => e.source === 'Security', serverSource: 'Security', clearable: true, kind: 'admin', maxKb: 20480, file: 'Security' },
  setup: { match: none, empty: true, kind: 'operational', maxKb: 1028, file: 'Setup' },
  system: { match: e => categoryOf(e.source) === 'system', clearable: true, kind: 'admin', maxKb: 20480, file: 'System' },
  forwarded: { match: none, empty: true, kind: 'operational', maxKb: 20480, file: 'ForwardedEvents' },
  'custom-admin': { match: e => e.level === 'error' || e.level === 'warning', kind: 'custom', maxKb: 0 },
  'svc-hardware': { match: none, empty: true, kind: 'admin', maxKb: 20480, file: 'HardwareEvents' },
  'svc-kms': { match: none, empty: true, kind: 'admin', maxKb: 20480, file: 'Key Management Service' },
  'svc-powershell': { match: none, empty: true, kind: 'admin', maxKb: 15360, file: 'Script Host' },
};

const NODE_LABEL: Record<NodeId, string> = {
  root: 'root',
  custom: 'custom_views',
  'custom-admin': 'admin_events',
  windows: 'windows_logs',
  application: 'log_application',
  security: 'log_security',
  setup: 'log_setup',
  system: 'log_system',
  forwarded: 'log_forwarded',
  services: 'services_logs',
  'svc-hardware': 'log_hardware',
  'svc-kms': 'log_kms',
  'svc-powershell': 'log_powershell',
  subscriptions: 'subscriptions',
};

export const nodeLabel = (id: NodeId): string => L(NODE_LABEL[id]);

export interface TreeNode {
  id: NodeId;
  icon: 'root' | 'folder' | 'custom' | 'log' | 'sub';
  children?: TreeNode[];
}

export const TREE: TreeNode = {
  id: 'root',
  icon: 'root',
  children: [
    { id: 'custom', icon: 'folder', children: [{ id: 'custom-admin', icon: 'custom' }] },
    {
      id: 'windows',
      icon: 'folder',
      children: [
        { id: 'application', icon: 'log' },
        { id: 'security', icon: 'log' },
        { id: 'setup', icon: 'log' },
        { id: 'system', icon: 'log' },
        { id: 'forwarded', icon: 'log' },
      ],
    },
    {
      id: 'services',
      icon: 'folder',
      children: [
        { id: 'svc-hardware', icon: 'log' },
        { id: 'svc-kms', icon: 'log' },
        { id: 'svc-powershell', icon: 'log' },
      ],
    },
    { id: 'subscriptions', icon: 'sub' },
  ],
};

export const findNode = (id: NodeId, n: TreeNode = TREE): TreeNode | null => {
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const hit = findNode(id, c);
    if (hit) return hit;
  }
  return null;
};

export const parentOf = (id: NodeId, n: TreeNode = TREE): TreeNode | null => {
  for (const c of n.children ?? []) {
    if (c.id === id) return n;
    const hit = parentOf(id, c);
    if (hit) return hit;
  }
  return null;
};

/** The log name an entry is filed under (General tab's "Log Name"). */
export const entryLogName = (e: Entry): string => nodeLabel(categoryOf(e.source));

// ── Derived columns ─────────────────────────────────────────────────────────────────────────

export const taskCategory = (e: Entry): string => {
  switch (e.event_id) {
    case 4624:
    case 4625:
      return L('task_logon');
    case 4634:
      return L('task_logoff');
    case 4740:
      return L('task_lockout');
    case 1102:
      return L('task_log_clear');
    default:
      return L('task_none');
  }
};

export const keywordsOf = (e: Entry): string =>
  e.level === 'success' ? L('kw_success') : e.level === 'failure' ? L('kw_failure') : L('kw_classic');

export const userOf = (e: Entry): string => (e.actor_name ? e.actor_name : L('na'));

/** The General tab's Level: like Windows, audit events are "Information" (the keyword carries success/failure). */
export const detailLevel = (e: Entry): string => (e.level === 'success' || e.level === 'failure' ? levelLabel('information') : levelLabel(e.level));

// ── Normalising the server page (Lua json: empty tables may arrive as [] or {}) ─────────────

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const normalizeEntry = (raw: Record<string, unknown>): Entry | null => {
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;
  let data = raw.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      /* keep the raw string */
    }
  }
  const level = String(raw.level ?? 'information');
  return {
    id: Math.trunc(id),
    level: (LEVEL_SET.has(level) ? level : 'information') as Level,
    source: String(raw.source ?? ''),
    event_id: Number(raw.event_id) || 0,
    message: String(raw.message ?? ''),
    actor_name: typeof raw.actor_name === 'string' && raw.actor_name !== '' ? raw.actor_name : null,
    data: data ?? undefined,
    ts: Number(raw.ts) || 0,
  };
};

export const normalizePage = (raw: unknown): Page => {
  const p = (raw ?? {}) as Record<string, unknown>;
  const counts: Partial<Record<Level, number>> = {};
  if (p.counts && typeof p.counts === 'object' && !Array.isArray(p.counts)) {
    for (const [k, v] of Object.entries(p.counts as Record<string, unknown>)) if (LEVEL_SET.has(k)) counts[k as Level] = Number(v) || 0;
  }
  const comp = p.computer as { hostname?: unknown; label?: unknown } | undefined;
  return {
    entries: asArray<Record<string, unknown>>(p.entries).map(normalizeEntry).filter((e): e is Entry => e !== null),
    counts,
    sources: asArray<unknown>(p.sources).map(String),
    pageSize: Number(p.pageSize) || 0,
    canClear: !!p.canClear,
    computer: comp ? { hostname: String(comp.hostname ?? ''), label: String(comp.label ?? '') } : null,
  };
};

// ── Filtering ───────────────────────────────────────────────────────────────────────────────

export const EMPTY_FILTER: UserFilter = { checks: {}, source: '', search: '', logged: 'any', ids: '', user: '' };

export const LEVEL_CHECKS: LevelCheck[] = ['critical', 'warning', 'verbose', 'error', 'information', 'success', 'failure'];

/** Windows' level checkboxes mapped onto our five levels. */
const CHECK_LEVEL: Record<LevelCheck, Level> = {
  critical: 'error',
  error: 'error',
  warning: 'warning',
  information: 'information',
  verbose: 'information',
  success: 'success',
  failure: 'failure',
};

export const levelsOf = (f: UserFilter): Level[] => {
  const out = new Set<Level>();
  for (const k of Object.keys(f.checks) as LevelCheck[]) if (f.checks[k]) out.add(CHECK_LEVEL[k]);
  return LEVELS.filter(l => out.has(l));
};

export const LOGGED: Logged[] = ['any', '1h', '12h', '24h', '7d', '30d'];
const LOGGED_SECS: Record<Logged, number> = { any: 0, '1h': 3600, '12h': 43200, '24h': 86400, '7d': 604800, '30d': 2592000 };

export const filterActive = (f: UserFilter): boolean =>
  levelsOf(f).length > 0 || !!f.source || !!f.search.trim() || f.logged !== 'any' || !!f.ids.trim() || !!f.user.trim();

/** "1,3,5-99,-76" -> predicate (Windows' Includes/Excludes Event IDs syntax). null = no constraint. */
export const parseIds = (s: string): ((id: number) => boolean) | null => {
  const inc: [number, number][] = [];
  const exc: [number, number][] = [];
  for (const raw of s.split(',')) {
    const p = raw.trim();
    if (!p) continue;
    const neg = p.startsWith('-');
    const m = (neg ? p.slice(1) : p).match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    (neg ? exc : inc).push([Math.min(a, b), Math.max(a, b)]);
  }
  if (!inc.length && !exc.length) return null;
  return id => (inc.length === 0 || inc.some(([a, b]) => id >= a && id <= b)) && !exc.some(([a, b]) => id >= a && id <= b);
};

/** The half of the filter the server can apply (single-valued level/source, the search text). */
export const serverFilterFor = (node: NodeId, f: UserFilter): ServerFilter => {
  const def = LOG_DEFS[node];
  if (!def) return {};
  const levels = levelsOf(f);
  const sf: ServerFilter = {};
  if (levels.length === 1) sf.level = levels[0];
  const source = f.source || def.serverSource;
  if (source) sf.source = source;
  const search = f.search.trim();
  if (search) sf.search = search.slice(0, 64);
  return sf;
};

/** Everything else, client-side (and re-checking the server half is harmless). */
export const applyFilter = (entries: Entry[], node: NodeId, f: UserFilter): Entry[] => {
  const def = LOG_DEFS[node];
  if (!def || def.empty) return [];
  const levels = levelsOf(f);
  const levelOk = levels.length ? new Set<Level>(levels) : null;
  const search = f.search.trim().toLowerCase();
  const user = f.user.trim().toLowerCase();
  const ids = parseIds(f.ids);
  const since = f.logged === 'any' ? 0 : Date.now() / 1000 - LOGGED_SECS[f.logged];
  return entries.filter(
    e =>
      def.match(e) &&
      (!levelOk || levelOk.has(e.level)) &&
      (!f.source || e.source === f.source) &&
      (!search || e.message.toLowerCase().includes(search) || (e.actor_name ?? '').toLowerCase().includes(search)) &&
      (!user || (e.actor_name ?? '').toLowerCase().includes(user)) &&
      (!ids || ids(e.event_id)) &&
      (!since || e.ts >= since),
  );
};

/** "Log: Security; Levels: Error, Warning; Source: Mail" for the Filtered: strip. */
export const describeFilter = (node: NodeId, f: UserFilter): string => {
  const parts = [`${L('f_log')}: ${nodeLabel(node)}`];
  const levels = levelsOf(f);
  if (levels.length) parts.push(`${L('f_levels')}: ${levels.map(levelLabel).join(', ')}`);
  if (f.source) parts.push(`${L('f_source')}: ${f.source}`);
  if (f.ids.trim()) parts.push(`${L('f_ids')}: ${f.ids.trim()}`);
  if (f.user.trim()) parts.push(`${L('f_user')}: ${f.user.trim()}`);
  if (f.search.trim()) parts.push(`${L('f_keywords')}: ${f.search.trim()}`);
  if (f.logged !== 'any') parts.push(`${L('f_logged')}: ${L(`logged_${f.logged}`)}`);
  return parts.join('; ');
};

// ── Sorting ─────────────────────────────────────────────────────────────────────────────────

export const sortEntries = (list: Entry[], s: Sort): Entry[] => {
  const dir = s.dir === 'asc' ? 1 : -1;
  const key = (e: Entry): string | number => {
    switch (s.key) {
      case 'level':
        return LEVELS.indexOf(e.level);
      case 'source':
        return e.source.toLowerCase();
      case 'event_id':
        return e.event_id;
      case 'task':
        return taskCategory(e).toLowerCase();
      case 'user':
        return userOf(e).toLowerCase();
      default:
        return e.ts;
    }
  };
  return [...list].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka < kb) return -dir;
    if (ka > kb) return dir;
    return (a.id - b.id) * (s.key === 'ts' ? dir : -1);
  });
};

// ── Text renderings ─────────────────────────────────────────────────────────────────────────

export const fmtNum = (n: number): string => n.toLocaleString('en-US');

/** Cosmetic .evtx size: a 68 KB empty file plus ~0.8 KB per record. */
export const logBytes = (count: number): number => 69632 + count * 812;

export const fmtSize = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`);

const LEVEL_NUM: Record<Level, number> = { error: 2, warning: 3, information: 4, success: 0, failure: 0 };
const KEYWORDS_HEX: Record<string, string> = { success: '0x8020000000000000', failure: '0x8010000000000000' };

const xmlEsc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const valueText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v) && v.every(x => typeof x !== 'object' || x === null)) return v.map(x => String(x ?? '')).join(', ');
  return JSON.stringify(v, null, 2);
};

/** EventData as key/value rows (Friendly View). Non-object data becomes a single "Data" row. */
export const dataRows = (data: unknown): { k: string; v: string; block: boolean }[] => {
  if (data === undefined || data === null) return [];
  if (typeof data !== 'object' || Array.isArray(data)) {
    const v = valueText(data);
    return [{ k: 'Data', v, block: v.includes('\n') }];
  }
  return Object.entries(data as Record<string, unknown>).map(([k, raw]) => {
    const v = valueText(raw);
    return { k, v, block: v.includes('\n') };
  });
};

export const systemRows = (e: Entry, hostname: string): { k: string; v: string }[] => [
  { k: 'Provider [ Name]', v: e.source },
  { k: 'EventID', v: String(e.event_id) },
  { k: 'Version', v: '0' },
  { k: 'Level', v: String(LEVEL_NUM[e.level]) },
  { k: 'Task', v: '0' },
  { k: 'Opcode', v: '0' },
  { k: 'Keywords', v: KEYWORDS_HEX[e.level] ?? '0x80000000000000' },
  { k: 'TimeCreated [ SystemTime]', v: new Date(e.ts * 1000).toISOString().replace('.000Z', '.0000000Z') },
  { k: 'EventRecordID', v: String(e.id) },
  { k: 'Channel', v: entryLogName(e) },
  { k: 'Computer', v: hostname },
];

/** The XML View (what Windows would serialise). */
export const eventXml = (e: Entry, hostname: string): string => {
  const sys = [
    `    <Provider Name="${xmlEsc(e.source)}" />`,
    `    <EventID>${e.event_id}</EventID>`,
    '    <Version>0</Version>',
    `    <Level>${LEVEL_NUM[e.level]}</Level>`,
    '    <Task>0</Task>',
    '    <Opcode>0</Opcode>',
    `    <Keywords>${KEYWORDS_HEX[e.level] ?? '0x80000000000000'}</Keywords>`,
    `    <TimeCreated SystemTime="${new Date(e.ts * 1000).toISOString().replace('.000Z', '.0000000Z')}" />`,
    `    <EventRecordID>${e.id}</EventRecordID>`,
    `    <Channel>${xmlEsc(entryLogName(e))}</Channel>`,
    `    <Computer>${xmlEsc(hostname)}</Computer>`,
    e.actor_name ? `    <Security UserID="${xmlEsc(e.actor_name)}" />` : '    <Security />',
  ];
  const rows = dataRows(e.data);
  const data = rows.length
    ? rows.map(r => `    <Data Name="${xmlEsc(r.k)}">${xmlEsc(r.v)}</Data>`)
    : [`    <Data>${xmlEsc(e.message)}</Data>`];
  return [
    '<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">',
    '  <System>',
    ...sys,
    '  </System>',
    '  <EventData>',
    ...data,
    '  </EventData>',
    '</Event>',
  ].join('\n');
};

/** "Copy Details as Text". */
export const eventText = (e: Entry, hostname: string, clock24: boolean): string => {
  const rows: [string, string][] = [
    [L('d_log_name'), entryLogName(e)],
    [L('d_source'), e.source],
    [L('d_date'), fmtStamp(e.ts, clock24)],
    [L('d_event_id'), String(e.event_id)],
    [L('d_task'), taskCategory(e)],
    [L('d_level'), detailLevel(e)],
    [L('d_keywords'), keywordsOf(e)],
    [L('d_user'), userOf(e)],
    [L('d_computer'), hostname],
  ];
  const w = Math.max(...rows.map(r => r[0].length)) + 2;
  const lines = rows.map(([k, v]) => `${(k + ':').padEnd(w)}${v}`);
  lines.push(`${L('d_description')}:`, e.message);
  const extra = dataRows(e.data);
  if (extra.length) lines.push('', ...extra.map(r => `${r.k}: ${r.v}`));
  return lines.join('\r\n');
};

/** Clipboard write that survives CEF without the async clipboard permission. */
export async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    /* fall back to execCommand */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
