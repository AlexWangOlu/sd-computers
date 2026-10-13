import { t } from '@/i18n';
import type { Contact } from './types';

// Contacts' data helpers: what comes off the wire, the A-Z groups, search, numbers and avatars.
// No state in here.

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Lua encodes an empty table as `{}`, so every array off the wire goes through this. */
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** The desk's rules for a new contact (server/computers/contacts.lua), so the dialog can say so first. */
export const MAX_NAME = 60;
export const MIN_DIGITS = 3;
export const MAX_DIGITS = 15;

// ── Numbers ─────────────────────────────────────────────────────────────────────────────────

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

/** Only digits and the separators people type between them. */
const numberish = (s: string): boolean => /^[\d\s()+.-]*$/.test(s);

/** What the number field keeps of what was typed. */
export const cleanNumber = (s: string): string => s.replace(/[^\d\s()+.-]/g, '');

/** Why a new contact can't be sent as typed (null when it can). The server checks the same again. */
export function checkNew(name: string, number: string): string | null {
  if (name.trim() === '') return t('ui.contacts.err_name');
  const d = digitsOf(number);
  if (!numberish(number) || d.length < MIN_DIGITS || d.length > MAX_DIGITS) return t('ui.contacts.err_number', MIN_DIGITS, MAX_DIGITS);
  return null;
}

// ── Off the wire ────────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** A contacts:list row, defensively (null when there is neither a name nor a number to show). */
export function normContact(raw: unknown): Contact | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<Record<keyof Contact, unknown>>;
  const number = digitsOf(o.number);
  const given = str(o.name).trim();
  // Saved without a name, the phone shows the number: draw it the way numbers are drawn.
  const name = given && given !== number ? given : fmtPhone(number);
  if (!name) return null;
  const color = str(o.color).trim();
  const avatar = str(o.avatar);
  return {
    id: str(o.id) || number || name,
    name,
    number,
    initials: str(o.initials).trim() || undefined,
    color: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : undefined,
    avatar: /^https?:\/\//i.test(avatar) ? avatar : undefined,
    favorite: o.favorite === true,
    email: str(o.email).trim() || undefined,
    address: str(o.address).trim() || undefined,
  };
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** The heading a name files under: its first letter without accents ("Élodie" -> E), # for a number or symbol. */
export function letterOf(name: string): string {
  const first = name
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .charAt(0)
    .toUpperCase();
  return /\p{L}/u.test(first) ? first : '#';
}

/** A to Z by name, with the cards that start with a number or symbol after the letters. */
export function sortContacts(list: Contact[]): Contact[] {
  const last = (c: Contact): number => (letterOf(c.name) === '#' ? 1 : 0);
  return [...list].sort((a, b) => last(a) - last(b) || collator.compare(a.name, b.name) || (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
}

/** The whole list: one card per id, in list order. */
export function normList(raw: unknown): Contact[] {
  const seen = new Set<string>();
  const out: Contact[] = [];
  for (const row of asArray<unknown>(raw)) {
    const c = normContact(row);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return sortContacts(out);
}

/** The cards under one letter. */
export interface LetterGroup {
  letter: string;
  contacts: Contact[];
}

/** Split a sorted list under its letters (a letter's cards are next to each other in it). */
export function groupByLetter(list: Contact[]): LetterGroup[] {
  const out: LetterGroup[] = [];
  let cur: LetterGroup | null = null;
  for (const c of list) {
    const letter = letterOf(c.name);
    if (!cur || cur.letter !== letter) {
      cur = { letter, contacts: [] };
      out.push(cur);
    }
    cur.contacts.push(c);
  }
  return out;
}

/** Search: the name or email, or - typed as a number, any way - the digits. */
export function matches(c: Contact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)) return true;
  const d = digitsOf(q);
  return d !== '' && numberish(q) && c.number.includes(d);
}

// ── Avatars ─────────────────────────────────────────────────────────────────────────────────

/**
 * "MB" for "Mechanic - Benny"; null when there's nothing letter-like (a bare number). The phone's
 * own initials are used when they are letters; it takes the first character of the first two
 * words whatever they are ("M-" here), and then the name does better.
 */
export function initialsOf(c: Pick<Contact, 'name' | 'initials'>): string | null {
  const given = (c.initials ?? '').trim();
  if (/^\p{L}{1,2}$/u.test(given)) return given.toUpperCase();
  const words = c.name.split(/[\s._()-]+/).filter(w => /\p{L}/u.test(w[0] ?? ''));
  if (words.length === 0) return null;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Persona colours for cards the phone sent without one. Content, not chrome: a person keeps the
// same colour in both themes (same palette as the avatars in Mail and Messages).
const PERSONA = ['#0f6cbd', '#c50f1f', '#ca5010', '#986f0b', '#498205', '#038387', '#5c2e91', '#881798', '#b4009e', '#4f6bed', '#8764b8', '#00727c', '#a4262c', '#5d5a58'];

export function personaColor(key: string): string {
  let h = 0;
  for (const ch of key.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSONA[h % PERSONA.length];
}

/** The initials' colour on an avatar: white, or near-black on the phone's few pale colours (its yellow, its sky blue). */
export function inkOn(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, ch => ch + ch) : h, 16);
  if (!Number.isFinite(n)) return '#ffffff';
  const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luma > 0.68 ? '#1b1b1b' : '#ffffff';
}
