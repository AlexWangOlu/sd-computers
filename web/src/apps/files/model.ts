import { t } from '@/i18n';
import { fmtShortDate, fmtTime } from '@/lib/format';
import type { FileRow, Limits, PhoneFull, PhoneKind, PhoneRow, PhoneSignature } from './types';

// Files' data helpers: reading rows off the wire, the list's rows and their order, names, sizes
// and dates. No state in here.

/** The two places in the left pane. */
export type Place = 'documents' | 'phone';

export type SortBy = 'name' | 'modified' | 'size';

export interface Sort {
  by: SortBy;
  /** 1 = ascending (A-Z, oldest, smallest), -1 = descending */
  dir: 1 | -1;
}

/** configs/shared/files.lua's defaults, until the first list reply brings the real ones. */
export const DEFAULT_LIMITS: Limits = { maxFiles: 100, maxName: 80, maxBody: 20000 };

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Lua encodes an empty table as `{}`, so every array off the wire goes through this. */
export const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const KINDS: readonly PhoneKind[] = ['text', 'image', 'file'];

export function normLimits(raw: unknown): Limits {
  const l = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Limits, unknown>>;
  const pick = (v: unknown, fallback: number): number => (num(v) >= 1 ? Math.floor(num(v)) : fallback);
  return {
    maxFiles: pick(l.maxFiles, DEFAULT_LIMITS.maxFiles),
    maxName: pick(l.maxName, DEFAULT_LIMITS.maxName),
    maxBody: pick(l.maxBody, DEFAULT_LIMITS.maxBody),
  };
}

/** A Documents row, defensively (null when it has no usable id). */
export function normFile(raw: unknown): FileRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<Record<keyof FileRow, unknown>>;
  const id = num(f.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const createdAt = num(f.createdAt);
  return { id, name: str(f.name), size: Math.max(0, num(f.size)), createdAt, updatedAt: num(f.updatedAt) || createdAt };
}

/** A phone row, defensively (null when it has no id). */
export function normPhone(raw: unknown): PhoneRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<Record<keyof PhoneRow, unknown>>;
  const id = str(d.id);
  if (!id) return null;
  const kind = KINDS.find(k => k === d.kind) ?? 'file';
  const createdAt = num(d.createdAt);
  return { id, name: str(d.name), kind, size: Math.max(0, num(d.size)), locked: d.locked === true, createdAt, updatedAt: num(d.updatedAt) || createdAt };
}

/** files:phoneRead's reply, defensively. */
export function normPhoneFull(raw: unknown): PhoneFull | null {
  const row = normPhone(raw);
  if (!row) return null;
  const d = raw as Partial<Record<keyof PhoneFull, unknown>>;
  const signatures: PhoneSignature[] = [];
  for (const s of asArray<unknown>(d.signatures)) {
    if (!s || typeof s !== 'object') continue;
    const sig = s as Partial<Record<keyof PhoneSignature, unknown>>;
    signatures.push({ signer: str(sig.signer), signedAt: num(sig.signedAt) });
  }
  return { ...row, body: str(d.body), url: str(d.url) || undefined, signatures };
}

// ── The list ───────────────────────────────────────────────────────────────────────────────

/**
 * One line of the list, whichever place it is from. The new document that hasn't been saved yet
 * has a line too (`id` null, key DRAFT_KEY), so it can be found again from the list.
 */
export interface Row {
  key: string;
  place: Place;
  id: number | string | null;
  name: string;
  kind: PhoneKind;
  locked: boolean;
  /** bytes; null = not saved yet */
  size: number | null;
  updatedAt: number;
}

export const DRAFT_KEY = 'draft';
export const fileKey = (id: number): string => `doc:${id}`;
export const phoneKey = (id: string): string => `phone:${id}`;

const byName = (a: Row, b: Row): number => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

function compare(a: Row, b: Row, sort: Sort): number {
  let d = 0;
  if (sort.by === 'modified') d = a.updatedAt - b.updatedAt;
  else if (sort.by === 'size') d = (a.size ?? 0) - (b.size ?? 0);
  else d = byName(a, b);
  // Equal on the sorted column: by name, then a stable key order.
  return d * sort.dir || byName(a, b) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

/**
 * The lines the list shows for a place: filtered by the search box (names only - the list carries
 * no text), sorted by the chosen column, the unsaved new document always first.
 */
export function buildRows(o: { place: Place; files: FileRow[]; phoneFiles: PhoneRow[]; draftName: string | null; search: string; sort: Sort }): Row[] {
  const q = o.search.trim().toLowerCase();
  const rows: Row[] =
    o.place === 'phone'
      ? o.phoneFiles.map((d): Row => ({ key: phoneKey(d.id), place: 'phone', id: d.id, name: d.name, kind: d.kind, locked: d.locked, size: d.size, updatedAt: d.updatedAt }))
      : o.files.map((f): Row => ({ key: fileKey(f.id), place: 'documents', id: f.id, name: f.name, kind: 'text', locked: false, size: f.size, updatedAt: f.updatedAt }));
  const out = (q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows).sort((a, b) => compare(a, b, o.sort));
  if (o.place === 'documents' && o.draftName !== null) {
    out.unshift({ key: DRAFT_KEY, place: 'documents', id: null, name: o.draftName, kind: 'text', locked: false, size: null, updatedAt: 0 });
  }
  return out;
}

/** Add a row, or replace the one with its id. */
export const upsert = (files: FileRow[], row: FileRow): FileRow[] => (files.some(f => f.id === row.id) ? files.map(f => (f.id === row.id ? row : f)) : [row, ...files]);

// ── Names and text ─────────────────────────────────────────────────────────────────────────

/** `base`, or "base (2)", "base (3)" ... - whichever no document is called yet (ignoring case, like the server). */
export function uniqueName(base: string, names: string[]): string {
  const used = new Set(names.map(n => n.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; n <= names.length + 2; n++) {
    const name = `${base} (${n})`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return base;
}

/** Cut to `max` UTF-16 units without leaving half of a surrogate pair (half an emoji) at the end. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const last = s.charCodeAt(max - 1);
  return s.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max);
}

// ── Sizes and dates ────────────────────────────────────────────────────────────────────────

/** Bytes -> "512 B" / "1.4 KB" / "12 KB" / "2.1 MB". */
export function fmtSize(bytes: number): string {
  if (bytes < 1024) return t('ui.files.size_b', Math.max(0, Math.round(bytes)));
  const kb = bytes / 1024;
  if (kb < 1024) return t('ui.files.size_kb', kb < 10 ? kb.toFixed(1) : Math.round(kb));
  const mb = kb / 1024;
  return t('ui.files.size_mb', mb < 10 ? mb.toFixed(1) : Math.round(mb));
}

/** 20000 -> "20,000". */
export const fmtCount = (n: number): string => n.toLocaleString('en-US');

/** Unix seconds -> "10/5/2026 at 6:05 PM" ('' when there is no time). */
export function fmtWhen(ts: number, clock24: boolean): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return t('ui.files.date_at', fmtShortDate(d), fmtTime(d, clock24));
}
