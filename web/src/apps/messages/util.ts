import { t } from '@/i18n';
import { fmtShortDate, fmtTime } from '@/lib/format';
import type { Contact, ConversationRow, TextMessage, Thread } from './types';

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Lua encodes an empty table as `{}`, so every array off the wire goes through this. */
export const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Longest text the desk may send (server MAX_TEXT, the phone's own cap). */
export const MAX_TEXT = 1000;

/** Bare digits of anything number-ish ("(555) 123-4567" -> "5551234567"). */
export const digitsOf = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

/** Display a bare-digit number: 7 digits "555-1234", 10 digits "(555) 123-4567", anything else as-is. */
export function fmtPhone(raw: string | null | undefined): string {
  const s = String(raw ?? '');
  const d = digitsOf(s);
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return s;
}

/** Text that only looks like a phone number ("555 1234", "(555)123-4567", "+1 555..."). */
export const looksLikeNumber = (s: string): boolean => /^[\d\s()+.-]+$/.test(s.trim()) && digitsOf(s).length > 0;

export const isGroupId = (id: string): boolean => id.startsWith('g-');

export const sameId = (a: TextMessage['id'], b: TextMessage['id']): boolean => String(a) === String(b);

// ── Normalising what comes off the wire ─────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export function normContact(raw: unknown): Contact | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const phone = digitsOf(o.phone);
  const name = str(o.name).trim() || fmtPhone(phone);
  if (!name && !phone) return null;
  const avatar = str(o.avatar);
  return {
    id: str(o.id) || phone || name,
    name: name || '?',
    initials: str(o.initials).trim() || undefined,
    color: str(o.color).trim() || undefined,
    avatar: /^https?:\/\//i.test(avatar) ? avatar : undefined,
    phone: phone || undefined,
  };
}

export function normMessage(raw: unknown): TextMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'number' ? o.id : str(o.id);
  if (id === '') return null;
  const num = (v: unknown): number | undefined => (v === undefined || v === null || v === '' ? undefined : Number(v) || 0);
  const seenAt = Number(o.seenAt);
  return {
    id,
    from: o.from === 'me' ? 'me' : str(o.from),
    body: str(o.body),
    kind: str(o.kind) || 'text',
    ts: Number(o.ts) || 0,
    read: o.read === true,
    seenAt: seenAt > 0 ? seenAt : undefined,
    gifUrl: str(o.gifUrl) || undefined,
    amount: num(o.amount),
    duration: num(o.duration),
    requested: o.requested === true || undefined,
    requestStatus: str(o.requestStatus) || undefined,
  };
}

export const isSome = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined;

/** The participants' names, for a thread the server sent without a title. */
const fallbackTitle = (id: string, participants: Contact[]): string =>
  participants.length ? participants.map(p => p.name).join(', ') : isGroupId(id) ? t('ui.messages.group') : fmtPhone(id);

export function normRow(raw: unknown): ConversationRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  if (!id) return null;
  const participants = asArray<unknown>(o.participants).map(normContact).filter(isSome);
  return {
    id,
    title: str(o.title).trim() || fallbackTitle(id, participants),
    participants,
    group: o.group === true || isGroupId(id),
    unread: Math.max(0, Math.floor(Number(o.unread) || 0)),
    muted: o.muted === true,
    last: normMessage(o.last) ?? undefined,
  };
}

/** Oldest first (stable: same-second messages keep the server's order). */
export const sortOldestFirst = <T extends TextMessage>(list: T[]): T[] => [...list].sort((a, b) => a.ts - b.ts);

/** messages:thread. `id` is the one we asked for (the server echoes it, but trust ours). */
export function normThread(raw: unknown, id: string): Thread {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const participants = asArray<unknown>(o.participants).map(normContact).filter(isSome);
  return {
    id,
    title: str(o.title).trim() || fallbackTitle(id, participants),
    participants,
    group: o.group === true || isGroupId(id),
    unread: Math.max(0, Math.floor(Number(o.unread) || 0)),
    muted: o.muted === true,
    messages: sortOldestFirst(asArray<unknown>(o.messages).map(normMessage).filter(isSome)),
  };
}

export const normContacts = (v: unknown): Contact[] =>
  asArray<unknown>(v)
    .map(normContact)
    .filter(isSome)
    .sort((a, b) => a.name.localeCompare(b.name));

/** Newest conversation first; groups nobody has written in yet go last. */
export const sortRows = (rows: ConversationRow[]): ConversationRow[] => [...rows].sort((a, b) => (b.last?.ts ?? -1) - (a.last?.ts ?? -1));

// ── People ──────────────────────────────────────────────────────────────────────────────────

/** "BM" from "Mechanic - Benny"; null when there's nothing letter-like (a bare number). */
export function initialsOf(c: Pick<Contact, 'name' | 'initials'> | undefined): string | null {
  if (!c) return null;
  const given = (c.initials ?? '').trim();
  if (/\p{L}/u.test(given)) return given.slice(0, 2).toUpperCase();
  const words = c.name.split(/[\s._()-]+/).filter(w => /\p{L}/u.test(w[0] ?? ''));
  if (words.length === 0) return null;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Persona colours for people the phone sent without one. Content, not chrome: a person keeps the
// same colour in both themes, with white initials on top (same palette as Mail's avatars).
const PERSONA = ['#0f6cbd', '#c50f1f', '#ca5010', '#986f0b', '#498205', '#038387', '#5c2e91', '#881798', '#b4009e', '#4f6bed', '#8764b8', '#00727c', '#a4262c', '#5d5a58'];

export function personaColor(key: string): string {
  let h = 0;
  for (const ch of key.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSONA[h % PERSONA.length];
}

/** Who sent `from` (bare digits) in a thread: its participants, then the phone's contacts. */
export function senderOf(from: string, participants: Contact[], contacts: Contact[]): Contact {
  const d = digitsOf(from);
  return (
    participants.find(p => p.phone === d) ??
    contacts.find(p => p.phone === d) ?? { id: d || from, name: fmtPhone(d) || t('ui.messages.unknown_sender'), phone: d || undefined }
  );
}

/** First word of a name, for "Tasha: on my way" previews (a number stays whole). */
export const firstName = (name: string): string => (/\p{L}/u.test(name) ? name.split(/\s+/)[0] : name);

// ── Time ────────────────────────────────────────────────────────────────────────────────────

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole calendar days between `ts` and now (0 = today). */
const daysAgo = (ts: number, now: number): number => Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);

export const sameDay = (a: number, b: number): boolean => startOfDay(a) === startOfDay(b);

/** Conversation list: "now", "5m", "6:05 PM", "Yesterday", "Mon", "10/5/2026". */
export function fmtListTime(ts: number, now: number, clock24: boolean): string {
  if (!ts) return '';
  const diff = now - ts;
  if (diff < 60000) return t('ui.messages.time_now');
  if (diff < 3600000) return t('ui.messages.time_min', Math.floor(diff / 60000));
  const days = daysAgo(ts, now);
  const d = new Date(ts);
  if (days <= 0) return fmtTime(d, clock24);
  if (days === 1) return t('ui.messages.yesterday');
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return fmtShortDate(d);
}

/** Day separator in a thread: "Today", "Yesterday", "Wednesday", "Mon, Sep 28" (+ year when not this year). */
export function fmtDay(ts: number, now: number): string {
  const days = daysAgo(ts, now);
  const d = new Date(ts);
  if (days <= 0) return t('ui.messages.today');
  if (days === 1) return t('ui.messages.yesterday');
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date(now).getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

/** Hover title on a bubble: "Mon, Oct 5, 2026, 6:05 PM". */
export function fmtFull(ts: number, clock24: boolean): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}, ${fmtTime(d, clock24)}`;
}

/** Badge text: 120 -> "99+". */
export const countText = (n: number): string => (n > 99 ? '99+' : String(n));

/** An image the phone attached that the desk may draw (https, or an inline image in browser dev). */
export const drawableUrl = (url: string | undefined): string | null => (url && (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) ? url : null);
