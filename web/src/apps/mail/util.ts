import { t } from '@/i18n';
import { fmtLongDateFull, fmtShortDate, fmtTime, fmtWeekdayShort } from '@/lib/format';
import type { Attachment, Counts, MailId, Message } from './types';

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Lua encodes an empty table as `{}`, so every array off the wire goes through this. */
export const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const ZERO_COUNTS: Counts = { unread: 0, inbox: 0, sent: 0, drafts: 0, bin: 0, flagged: 0 };

export function normCounts(c: unknown): Counts {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
  const n = (k: keyof Counts) => Math.max(0, Number(o[k]) || 0);
  return { unread: n('unread'), inbox: n('inbox'), sent: n('sent'), drafts: n('drafts'), bin: n('bin'), flagged: n('flagged'), spam: n('spam') };
}

export function normMessage(raw: Message): Message {
  const from = (raw.from ?? {}) as Partial<Message['from']>;
  const email = String(from.email ?? '');
  return {
    id: typeof raw.id === 'string' ? raw.id : Number(raw.id),
    folder: String(raw.folder ?? 'inbox'),
    from: { email, name: String(from.name || email) },
    to: asArray<string>(raw.to).map(String),
    subject: String(raw.subject ?? ''),
    preview: String(raw.preview ?? ''),
    body: typeof raw.body === 'string' ? raw.body : undefined,
    read: !!raw.read,
    flagged: !!raw.flagged,
    ts: Number(raw.ts) || 0,
    attachments: asArray<Attachment>(raw.attachments),
    hasAttachments: !!raw.hasAttachments,
  };
}

/** Newest first; ties (same second) by id. Drafts get a fresh ts on every save, so sort client-side. */
export const sortMessages = (list: Message[]): Message[] => [...list].sort((a, b) => b.ts - a.ts || cmpId(b.id, a.id));

/** Built-in ids are numbers (newer = bigger); the phone's are random strings (any stable order). */
const cmpId = (a: MailId, b: MailId): number =>
  typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;

/** A one-line preview (the server's preview is the first 160 chars of the body, newlines included). */
export const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

export const isOutgoing = (m: Message): boolean => m.folder === 'sent' || m.folder === 'drafts';

/** "JH" from "Jessica Hale"; falls back to the address's local part. */
export function initials(name: string, email = ''): string {
  const src = (name && !name.includes('@') ? name : email.split('@')[0] || name || '?').trim();
  const words = src.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Fluent persona colours (the avatar palette Outlook/Teams use). These are content, not chrome:
// a person keeps the same colour in both themes, with white initials on top.
const PERSONA = ['#0f6cbd', '#c50f1f', '#ca5010', '#986f0b', '#498205', '#038387', '#5c2e91', '#881798', '#b4009e', '#4f6bed', '#8764b8', '#00727c', '#a4262c', '#5d5a58'];

export function personaColor(key: string): string {
  let h = 0;
  for (const ch of key.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSONA[h % PERSONA.length];
}

/** "Mon 10/5/2026 6:05 PM" / "周一 2026/10/5 下午6:05" (reading pane header). */
export function fmtFull(ts: number, clock24: boolean): string {
  const d = new Date(ts * 1000);
  return `${fmtWeekdayShort(d)} ${fmtShortDate(d)} ${fmtTime(d, clock24)}`;
}

/** "Monday, October 5, 2026 6:05 PM" (quoted header of a reply/forward). */
function fmtQuoteDate(ts: number, clock24: boolean): string {
  const d = new Date(ts * 1000);
  return `${fmtLongDateFull(d)} ${fmtTime(d, clock24)}`;
}

export type DateGroup = 'today' | 'yesterday' | 'week' | 'older';

export function dateGroup(ts: number): DateGroup {
  const d = new Date(ts * 1000);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'week';
  return 'older';
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "RE: Lunch" / "FW: Lunch" - never stacks a prefix that's already there. */
export function withPrefix(kind: 're' | 'fw', subject: string): string {
  const s = subject.trim();
  const local = t(kind === 're' ? 'ui.mail.prefix_re' : 'ui.mail.prefix_fw').replace(/:\s*$/, '');
  const known = kind === 're' ? ['re', local] : ['fw', 'fwd', local];
  const re = new RegExp(`^(${known.map(escapeRe).join('|')}):`, 'i');
  return re.test(s) ? s : `${local}: ${s}`;
}

const who = (name: string, email: string): string => (name && name !== email ? `${name} <${email}>` : email);

/** The Outlook-style "-----Original Message-----" block under a reply/forward. */
export function quoteOriginal(m: Message, clock24: boolean): string {
  return [
    '',
    '',
    t('ui.mail.quote_header'),
    `${t('ui.mail.quote_from')} ${who(m.from.name, m.from.email)}`,
    `${t('ui.mail.quote_sent')} ${fmtQuoteDate(m.ts, clock24)}`,
    `${t('ui.mail.quote_to')} ${m.to.join('; ')}`,
    `${t('ui.mail.quote_subject')} ${m.subject || t('ui.mail.no_subject')}`,
    '',
    m.body ?? m.preview,
  ].join('\n');
}

const ADDRESS = /^[a-z0-9][a-z0-9._-]*@[a-z0-9.-]+$/;

/** Trim/lowercase, unwrap "Name <a@b>", append @domain to a bare username (as the server does). */
export function normalizeAddress(raw: string, domain: string): string {
  let a = raw.trim();
  const angle = /<([^>]+)>/.exec(a);
  if (angle) a = angle[1];
  a = a.trim().toLowerCase();
  if (!a) return '';
  if (!a.includes('@')) a = `${a}@${domain}`;
  return a;
}

export const isValidAddress = (a: string): boolean => a.length <= 64 && ADDRESS.test(a);

/** Split pasted/typed text on commas, semicolons and whitespace. */
export const splitAddresses = (text: string): string[] => text.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);

export const uniq = (list: string[]): string[] => {
  const seen = new Set<string>();
  return list.filter(a => {
    const k = a.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Badge text: 120 -> "99+". */
export const countText = (n: number): string => (n > 99 ? '99+' : String(n));
