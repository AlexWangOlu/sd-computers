import type { MockHandler } from './index';
import { fail, ok } from './index';
import type { Contact, ListData, RemoveData } from '@/apps/contacts/types';

// Browser mocks for contacts:* (server/computers/contacts.lua over sd-phone's getContacts /
// addContact / removeContactByNumber exports). State lives in module variables so a dev session
// sticks until reload. Same rules as the real thing: the desk asks for a name and 3-15 digits,
// then the phone decides - the number must be in service, not your own and not saved already -
// and a remove takes every card under the number (none is still a success). The people are the
// ones the Messages mock texts with, so the Message button lands on a real thread.
//
// To try the refusals: 5550000 is "not in service", 5551234 is your own number.
// Dev switch (browser console): window.__phoneDown = true fails every endpoint like a dropped
// sd-phone link (as in Messages; localStorage['mock:phonelink'] = 'down' works too).

const UNAVAILABLE = 'The phone link is unavailable right now.';
const MY_NUMBER = '5551234';
const NOT_IN_SERVICE = '5550000';
const MAX_NAME = 60;
const MIN_DIGITS = 3;
const MAX_DIGITS = 15;
const MAX_CONTACTS = 500;

// sd-phone's avatar palette and its initials rule (the first character of the first two words).
const PALETTE = ['#0a84ff', '#30d158', '#ff375f', '#ff9f0a', '#bf5af2', '#ff453a', '#5e5ce6', '#64d2ff', '#ffd60a', '#636366'];

const colorFor = (key: string): string => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

const initialsFor = (name: string): string => {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '#';
};

const newId = (): string => {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
};

/** A stored card, in the shape the server sends (a card saved without a name is named by its number). */
const card = (id: string, name: string, number: string, color: string, extra: Partial<Contact> = {}): Contact => ({
  id,
  name: name || number,
  number,
  initials: initialsFor(name),
  color,
  favorite: false,
  ...extra,
});

let contacts: Contact[] = [
  card('c8k2m5x1q9za', 'Mechanic - Benny', '5558214', '#ff9f0a', { address: "Benny's Original Motor Works, Strawberry" }),
  card('c3n7v4b0w6yb', 'Tasha Reyes', '5550117', '#ff375f', { favorite: true, email: 'tasha.reyes@lsmail.net' }),
  card('c9r1e5t3q7uc', 'Marco Bellini', '5553370', '#30d158'),
  card('c6j2k8l4z0xd', 'Lena - LSMC', '5554410', '#64d2ff', { email: 'l.okafor@lsmc.org' }),
  card('c1o5i9u3y7te', 'Ray - Tow Yard', '5557731', '#636366'),
  card('c4n8b2v6c0xf', 'Mom', '5552020', '#bf5af2', { favorite: true }),
  card('c7w1e5r9t3yg', 'Det. Alvarez', '5553090', '#0a84ff', { address: 'Mission Row Police Station' }),
  card('c2s6d0f4g8hh', 'Vinny Castellano', '5556677', '#5e5ce6'),
  card('c5x9c3v7b1ni', 'Dr. Kim - Pillbox', '5559146', '#ff453a', { email: 'kim@pillboxmedical.org', address: 'Pillbox Hill Medical Center' }),
  card('c0k4j8h2g6fj', 'Hector - PDM Sales', '5558870', '#ffd60a'),
  card('c3t7r1e5w9qk', 'Élodie Marchetti', '5551907', '#30d158'),
  card('c8i2o6p0a4sl', 'Zed', '5550642', '#0a84ff'),
  card('c1f5g9h3j7km', '', '5557001', '#636366'),
];

const linkDown = (): boolean => {
  if ((window as unknown as { __phoneDown?: boolean }).__phoneDown) return true;
  try {
    return window.localStorage.getItem('mock:phonelink') === 'down';
  } catch {
    return false;
  }
};

/** contacts.lua byName: by name whatever its case, then by number. */
const sorted = (): Contact[] =>
  [...contacts].sort((a, b) => {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    return x < y ? -1 : x > y ? 1 : a.number < b.number ? -1 : a.number > b.number ? 1 : 0;
  });

/** contacts.lua digits(): the bare digits, or null when it isn't a number at all. */
const digits = (v: unknown): string | null => {
  const s = typeof v === 'number' ? String(v) : v;
  if (typeof s !== 'string' || s.length > 32 || /[^\d\s()+.-]/.test(s)) return null;
  return s.replace(/\D/g, '');
};

const handlers: Record<string, MockHandler> = {
  'contacts:list': () => {
    if (linkDown()) return fail(UNAVAILABLE);
    const data: ListData = { contacts: sorted() };
    return ok(data);
  },

  'contacts:add': p => {
    if (linkDown()) return fail(UNAVAILABLE);
    const name = (typeof p.name === 'string' ? p.name : '').slice(0, MAX_NAME).trim();
    if (!name) return fail('Enter a name for the contact.');
    const number = digits(p.number);
    if (number === null || number.length < MIN_DIGITS || number.length > MAX_DIGITS) return fail(`Enter a phone number of ${MIN_DIGITS} to ${MAX_DIGITS} digits.`);
    // From here on it is the phone talking (sd-phone server/contacts/actions.lua add).
    if (number === NOT_IN_SERVICE) return fail("That number isn't in service");
    if (number === MY_NUMBER) return fail("You can't add your own number");
    if (contacts.some(c => c.number === number)) return fail('You already have a contact with this number');
    if (contacts.length >= MAX_CONTACTS) return fail(`You can store at most ${MAX_CONTACTS} contacts`);
    const added = card(newId(), name, number, colorFor(name));
    contacts = [...contacts, added];
    return ok(added);
  },

  'contacts:remove': p => {
    if (linkDown()) return fail(UNAVAILABLE);
    const number = digits(p.number);
    if (!number) return fail('Invalid request.');
    const before = contacts.length;
    contacts = contacts.filter(c => c.number !== number);
    const data: RemoveData = { removed: before - contacts.length };
    return ok(data);
  },
};

export default handlers;
