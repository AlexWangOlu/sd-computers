import type { MockHandler } from './index';
import { ok, fail } from './index';
import type { NoteFull, NoteRow, SaveData } from '@/apps/notes/types';

// Browser mocks for phonenotes:* (server/computers/phoneapps.lua over the sd-phone link), mirroring
// the server + sd-phone's computer link: no id = a new note, an unknown id is created under that id
// (the link upserts), saving only replaces the text (photos/sketches are kept), the title is the
// first non-empty line and the preview the rest, timestamps are ISO-8601 UTC, 200 notes max.
//
// To try the "link went away" path in the browser: localStorage['mock:phonelink'] = 'down'.

interface StoredNote {
  id: string;
  body: string;
  images: string[];
  sketches: string[];
  createdAt: string;
  updatedAt: string;
}

const MAX_NOTES = 200;
const MAX_BODY = 20000;

const iso = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const newId = (): string => {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
};

/** A phone sketch is a transparent PNG drawn over a white board; an SVG stands in for it here. */
const sketch = (paths: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="520" viewBox="0 0 390 520" fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
  );

// Escape route for the Fleeca job: roads, the bank, the boat, and an angry arrow.
const ROUTE_SKETCH = sketch(
  '<path d="M30 470 C 90 400, 120 330, 190 300 S 300 220, 350 90" stroke="#1c1c1e" stroke-width="5"/>' +
    '<path d="M60 120 L 180 180 L 330 160" stroke="#1c1c1e" stroke-width="3" stroke-dasharray="10 9"/>' +
    '<rect x="160" y="270" width="54" height="40" rx="4" stroke="#d70015" stroke-width="5"/>' +
    '<path d="M168 262 l 19 -16 l 19 16" stroke="#d70015" stroke-width="4"/>' +
    '<path d="M300 60 q 30 -12 60 0 l -8 18 h -44 z" stroke="#0a60ff" stroke-width="4"/>' +
    '<path d="M215 300 C 260 290, 285 240, 300 110" stroke="#0a60ff" stroke-width="4" stroke-dasharray="2 12"/>' +
    '<path d="M288 132 l 12 -24 l 12 24" stroke="#0a60ff" stroke-width="4"/>' +
    '<circle cx="60" cy="440" r="12" stroke="#248a3d" stroke-width="5"/>',
);

// Where the car's parked: a doodled lot with an X.
const PARKING_SKETCH = sketch(
  '<rect x="40" y="60" width="310" height="400" rx="10" stroke="#1c1c1e" stroke-width="4"/>' +
    '<path d="M40 180 H 350 M40 300 H 350 M195 60 V 460" stroke="#1c1c1e" stroke-width="3" stroke-dasharray="14 10"/>' +
    '<path d="M250 210 l 60 60 M310 210 l -60 60" stroke="#d70015" stroke-width="8"/>' +
    '<path d="M90 420 q 40 -50 100 -40" stroke="#0a60ff" stroke-width="4"/>' +
    '<path d="M178 372 l 14 8 l -10 12" stroke="#0a60ff" stroke-width="4"/>',
);

const notes: StoredNote[] = [
  {
    id: 'k3v9q1m7z2xa',
    body: [
      'Fleeca job - Great Ocean Hwy',
      '',
      'Crew: me, Dex (wheel), Kira (laptop)',
      'Need: thermite x2, drill, laptop, 3 burners',
      'Hit at shift change, 21:00 sharp',
      'Route out: Paleto back roads -> boat at Procopio',
      '',
      'No names on comms. Burners go in the ocean after.',
    ].join('\n'),
    images: ['https://picsum.photos/seed/fleeca/600/400', 'https://picsum.photos/seed/procopio/600/400'],
    sketches: [ROUTE_SKETCH],
    createdAt: iso(3 * DAY),
    updatedAt: iso(14 * MIN),
  },
  {
    id: 'p8d2w6r4t0yb',
    body: [
      'Shopping list',
      '- Birthday gift card for Mia (Burger Shot)',
      '- New tyres for the Sultan, ask Benny about a deal',
      '- Phone case, Digital Den',
      '- Laundry detergent',
      '- Dog food (the good stuff)',
    ].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(2 * DAY),
    updatedAt: iso(3 * HOUR),
  },
  {
    id: 'g5n1c7h3j9ue',
    body: ['Grocery run - 24/7 on Innocence Blvd', 'Eggs', 'Bread', 'Oat milk', 'Coffee beans', 'Frozen pizza x3', 'Cat food!!'].join('\n'),
    images: ['https://picsum.photos/seed/receipt/600/400'],
    sketches: [],
    createdAt: iso(DAY + 5 * HOUR),
    updatedAt: iso(DAY + 2 * HOUR),
  },
  {
    id: 'b2x8m4q6s0lf',
    body: [
      'Numbers',
      'Benny (mechanic) 555-0142',
      'Dr. Sato, Pillbox 555-0177',
      'Hale & Partners (lawyer) 555-0109',
      'Davis Towing 555-0163',
      'Pizza This 555-0120',
      '',
      "Don't save Kira's number. Memorise it.",
    ].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(20 * DAY),
    updatedAt: iso(3 * DAY),
  },
  {
    id: 'r7t3y9u1i5oc',
    body: [
      'Vinewood Nights (draft)',
      '',
      'Neon on the boulevard, sirens in the rain',
      'I wrote your number on a parking ticket, now I owe the city twice again',
      'Del Perro to the hills and back, the radio plays our song',
      "Every light in this town says go, so how'd we get it wrong",
      '',
      'chorus?? something about the pier',
    ].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(9 * DAY),
    updatedAt: iso(5 * DAY),
  },
  {
    id: 'h4j0k6l2z8wd',
    body: '',
    images: [],
    sketches: [PARKING_SKETCH],
    createdAt: iso(6 * DAY),
    updatedAt: iso(6 * DAY),
  },
  {
    id: 'c9v5b1n7m3qg',
    body: [
      'Court date - Tue 10:00',
      'Mission Row courthouse, room 2',
      'Bring: ID, proof of insurance, bail receipt ($2,500)',
      'Call Hale the day before. Wear the grey suit, not the tracksuit.',
    ].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(16 * DAY),
    updatedAt: iso(12 * DAY),
  },
  {
    id: 'm1q7w3e9r5th',
    body: ['Car meet - Saturday', 'LS Customs lot, 22:00', 'Bring the Elegy, clean plates', 'No masks, the cops always roll through'].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(40 * DAY),
    updatedAt: iso(33 * DAY),
  },
];

const linkDown = (): boolean => {
  try {
    return window.localStorage.getItem('mock:phonelink') === 'down';
  } catch {
    return false;
  }
};
const LINK_DOWN = 'The phone link is unavailable right now.';

/** server/computers/phoneapps.lua noteTitle(): the first non-empty line, trimmed, max 80. */
const titleOf = (body: string): string => {
  const line = body.split('\n').find(l => l.trim() !== '');
  return line ? line.trim().slice(0, 80) : '';
};

/** noteRow(): leading whitespace + the first line removed, whitespace collapsed, max 120 (not trimmed - like the server). */
const toRow = (n: StoredNote): NoteRow => ({
  id: n.id,
  title: titleOf(n.body),
  preview: n.body.replace(/^\s*[^\n]*\n?/, '').replace(/\s+/g, ' ').slice(0, 120),
  images: n.images.length,
  sketches: n.sketches.length,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

const sorted = (): StoredNote[] => [...notes].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

const handlers: Record<string, MockHandler> = {
  'phonenotes:list': () => {
    if (linkDown()) return fail(LINK_DOWN);
    return ok({ notes: sorted().map(toRow) });
  },

  'phonenotes:get': p => {
    if (linkDown()) return fail(LINK_DOWN);
    if (typeof p.id !== 'string') return fail('Invalid request.');
    const n = notes.find(x => x.id === p.id);
    if (!n) return fail('That note no longer exists.');
    const full: NoteFull = { id: n.id, body: n.body, images: [...n.images], sketches: [...n.sketches], createdAt: n.createdAt, updatedAt: n.updatedAt };
    return ok(full);
  },

  'phonenotes:save': p => {
    if (linkDown()) return fail(LINK_DOWN);
    const id = typeof p.id === 'string' && p.id !== '' ? p.id : newId();
    const body = (typeof p.body === 'string' ? p.body : '').slice(0, MAX_BODY);
    const now = new Date().toISOString();
    const existing = notes.find(x => x.id === id);
    if (existing) {
      existing.body = body;
      existing.updatedAt = now;
      const res: SaveData = { id, createdAt: existing.createdAt, updatedAt: now };
      return ok(res);
    }
    if (notes.length >= MAX_NOTES) return fail('Note limit reached');
    notes.push({ id, body, images: [], sketches: [], createdAt: now, updatedAt: now });
    const res: SaveData = { id, createdAt: now, updatedAt: now };
    return ok(res);
  },

  'phonenotes:delete': p => {
    if (linkDown()) return fail(LINK_DOWN);
    if (typeof p.id !== 'string' || p.id === '') return fail('Bad note id');
    const i = notes.findIndex(x => x.id === p.id);
    if (i >= 0) notes.splice(i, 1);
    return ok();
  },
};

export default handlers;
