import { t } from '@/i18n';
import { fmtLongDate, fmtShortDate, fmtTime } from '@/lib/format';
import type { NoteRow } from './types';

// Notes' data helpers: the list rows, the phone's title/preview rule, dates. No state in here.

/** The phone's limits (sd-phone configs/notes.lua; the server enforces them). */
export const MAX_BODY = 20000;
const MAX_TITLE = 80;
const MAX_PREVIEW = 120;

/**
 * One list row: a phonenotes:list row plus a stable local `key`. A new note is a local draft
 * (`id` null, key 'draft:N') until its first save returns an id; the key never changes, so the
 * selection, the open editor and the save status follow the note through that first save.
 */
export interface Row extends Omit<NoteRow, 'id'> {
  key: string;
  id: string | null;
}

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Lua encodes an empty table as `{}`, so every array off the wire goes through this. */
export const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Photo URLs / sketch data URLs: strings only, empties dropped. */
export const strList = (v: unknown): string[] => asArray<unknown>(v).filter((x): x is string => typeof x === 'string' && x !== '');

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const count = (v: unknown): number => Math.max(0, Math.floor(Number(v) || 0));

/** ISO-8601 -> epoch ms (0 when missing or unparseable). */
export const toMs = (iso: string): number => {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
};

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * The server's rule (phoneapps.lua noteRow): title = the first non-empty line (trimmed, max 80),
 * preview = everything after it on one line (max 120). Used to update a row while typing.
 */
export function deriveText(body: string): { title: string; preview: string } {
  const m = /^\s*([^\n]*)\n?/.exec(body);
  if (!m) return { title: '', preview: '' };
  return { title: m[1].trim().slice(0, MAX_TITLE), preview: oneLine(body.slice(m[0].length)).slice(0, MAX_PREVIEW) };
}

/** A phonenotes:list row, defensively (null when it has no id). */
export function normRow(raw: unknown): Row | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Partial<Record<keyof NoteRow, unknown>>;
  const id = typeof n.id === 'string' ? n.id : typeof n.id === 'number' ? String(n.id) : '';
  if (!id) return null;
  const createdAt = str(n.createdAt);
  return {
    key: id,
    id,
    title: str(n.title).trim(),
    // The server collapses whitespace but doesn't trim, so a blank line after the title leaves a leading space.
    preview: oneLine(str(n.preview)),
    images: count(n.images),
    sketches: count(n.sketches),
    createdAt,
    updatedAt: str(n.updatedAt) || createdAt,
  };
}

/** Newest-edited first (then newest-created, then a stable key order). */
export const sortRows = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt) || toMs(b.createdAt) - toMs(a.createdAt) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

/** Search: title + preview, case-insensitive. */
export function matches(r: Row, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return r.title.toLowerCase().includes(q) || r.preview.toLowerCase().includes(q);
}

/** Whole calendar days between `ms` and today (0 = today, 1 = yesterday). */
const daysAgo = (ms: number): number => {
  const now = new Date();
  return Math.floor((new Date(now.toDateString()).getTime() - new Date(new Date(ms).toDateString()).getTime()) / 86400000);
};

export type DayGroup = 'today' | 'yesterday' | 'week' | 'older';

export function dayGroup(ms: number): DayGroup {
  if (!ms) return 'older';
  const d = daysAgo(ms);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return 'week';
  return 'older';
}

/** "today at 6:05 PM" / "yesterday at ..." / "Monday, October 5 at ..." / "10/5/2025 at ..." */
function when(ms: number, clock24: boolean, kind: 'edited' | 'created'): string {
  if (!ms) return '';
  const d = new Date(ms);
  const time = fmtTime(d, clock24);
  const days = daysAgo(ms);
  if (days <= 0) return t(`ui.notes.${kind}_today`, time);
  if (days === 1) return t(`ui.notes.${kind}_yesterday`, time);
  const day = d.getFullYear() === new Date().getFullYear() ? fmtLongDate(d) : fmtShortDate(d);
  return t(`ui.notes.${kind}_on`, day, time);
}

export const editedLabel = (iso: string, clock24: boolean): string => when(toMs(iso), clock24, 'edited');
export const createdLabel = (iso: string, clock24: boolean): string => when(toMs(iso), clock24, 'created');
