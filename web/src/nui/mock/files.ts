import type { MockHandler } from './index';
import { ok, fail } from './index';
import type { FileFull, FileRow, ListData, PhoneFull, PhoneKind, PhoneRow, PhoneSignature } from '@/apps/files/types';

// Browser mocks for files:* (server/computers/files.lua), mirroring the server: names are one
// line, trimmed, at most 80 characters and unique per character whatever their case; a save with
// no id (or an id that is gone) makes a new document; a rename leaves the modified time alone;
// 100 documents at most. The phone's place is sd-phone's documents: read-only here, copied either
// way as plain text.
//
// To try the "no phone" side in the browser: localStorage['mock:phonelink'] = 'down' (the list
// then says phone = false, and the phone endpoints refuse).

const MAX_FILES = 100;
const MAX_NAME = 80;
const MAX_BODY = 20000;
/** sd-phone's own limits (its configs/documents.lua). */
const PHONE_MAX_DOCS = 200;
const PHONE_MAX_BYTES = 25000;
const PHONE_MAX_NAME = 60;

interface StoredFile {
  id: number;
  name: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

interface StoredPhoneDoc {
  id: string;
  name: string;
  kind: PhoneKind;
  content: string;
  url?: string;
  locked: boolean;
  signatures: PhoneSignature[];
  createdAt: number;
  updatedAt: number;
}

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (secs: number): number => Math.floor(Date.now() / 1000) - secs;

const bytes = (s: string): number => new TextEncoder().encode(s).length;

/** Characters the way the server counts them (code points, not UTF-16 units). */
const chars = (s: string): string[] => Array.from(s);
const clipChars = (s: string, max: number): string => {
  const c = chars(s);
  return c.length > max ? c.slice(0, max).join('') : s;
};

let nextId = 7;

const files: StoredFile[] = [
  {
    id: 1,
    name: 'Shift handover - front desk',
    body: [
      'HANDOVER - MRPD FRONT DESK',
      'Day shift to evening shift',
      '',
      'Open at the desk:',
      '- Mr. Okafor is coming back at 18:00 with the paperwork for his impounded Blista. Release form is in the top tray, it only needs a sergeant to sign.',
      '- A woman called twice about a lost dog near Legion Square. Brown terrier, red collar, answers to Biscuit. Her number is on the pad.',
      '- Holding cell 2 is out of use until maintenance has looked at the lock. Do not put anyone in it.',
      '',
      'Waiting on:',
      '- Records still owe us the file on the Vespucci robbery. Chase them if it is not here by 20:00.',
      '- Unit 14 has the spare keys to the side gate. They hand them in when they come off patrol.',
      '',
      'The lobby camera drops out for a few seconds every hour or so. Logged with IT, nothing to do but note the time when it happens.',
      '',
      '- J. Hale',
    ].join('\n'),
    createdAt: ago(9 * DAY),
    updatedAt: ago(25 * MIN),
  },
  {
    id: 2,
    name: 'BOLO - grey Sultan',
    body: [
      'BE ON THE LOOKOUT',
      '',
      'Vehicle: grey four-door Sultan, tinted rear windows, dent in the rear left door',
      'Plate: partial, starts 46E, ends in 7',
      'Last seen: heading north on Strawberry Ave, around 02:40',
      'Wanted for: leaving the scene of a collision outside the 24/7 on Innocence Blvd',
      '',
      'Two people inside. The driver wore a dark hooded top. No weapon seen.',
      'Do not chase in traffic. Call it in, follow at a distance, wait for a second unit.',
      '',
      'Any sighting goes to Sgt. Moreno, whatever the hour.',
    ].join('\n'),
    createdAt: ago(3 * HOUR + 20 * MIN),
    updatedAt: ago(3 * HOUR),
  },
  {
    id: 3,
    name: 'Witness statement - Vespucci robbery',
    body: [
      'WITNESS STATEMENT (draft, not signed yet)',
      '',
      'Taken at: Mission Row, interview room 1',
      'Witness: store clerk, on shift alone',
      '',
      'She was restocking the fridge at the back when the door chime went. Two men came in. One stayed by the door, the other walked straight to the counter and told her to open the register. She did not see a weapon, but he kept one hand inside his jacket the whole time.',
      '',
      'They were in the shop for less than two minutes. They left on foot towards the canals. She heard an engine start a moment later but did not see the car.',
      '',
      'The man at the counter: tall, thin, a scar through his left eyebrow, spoke quietly.',
      'The man at the door: shorter, heavy build, never spoke, kept looking at his phone.',
      '',
      'To do: read it back to her, get her signature, attach the till receipt.',
    ].join('\n'),
    createdAt: ago(DAY + 6 * HOUR),
    updatedAt: ago(DAY + 2 * HOUR),
  },
  {
    id: 4,
    name: 'Radio codes',
    body: [
      'The ones I keep forgetting',
      '',
      '10-4   Understood',
      '10-7   Out of service',
      '10-8   In service',
      '10-20  Location',
      '10-23  Arrived on scene',
      '10-32  Backup needed',
      '10-50  Vehicle collision',
      '10-76  On the way',
      '10-97  Arrived, checking in',
      '',
      'Code 2  Urgent, no lights',
      'Code 3  Lights and sirens',
      'Code 4  No further help needed',
      '',
      'Say the unit number first. Always.',
    ].join('\n'),
    createdAt: ago(40 * DAY),
    updatedAt: ago(2 * DAY),
  },
  {
    id: 5,
    name: 'Evidence locker log',
    body: [
      'EVIDENCE LOCKER - WHAT WENT IN AND OUT THIS WEEK',
      '',
      'Mon  IN   Bag 0412  mobile phone, cracked screen       Ofc. Reyes',
      'Mon  IN   Bag 0413  set of car keys, no fob            Ofc. Reyes',
      'Tue  OUT  Bag 0398  to the lab, signed for by Dr. Lin',
      'Wed  IN   Bag 0414  cash, counted twice, $2,340        Sgt. Moreno',
      'Thu  IN   Bag 0415  kitchen knife, sealed in a tube    Ofc. Park',
      'Thu  OUT  Bag 0413  returned to owner, ID checked',
      '',
      'Bag 0409 is still missing its second signature. Find out who was on with Park that night.',
    ].join('\n'),
    createdAt: ago(18 * DAY),
    updatedAt: ago(5 * DAY),
  },
  {
    id: 6,
    name: 'New recruits - first week',
    body: [
      'What to walk a new recruit through in week one',
      '',
      '1. The building: armoury, lockers, cells, the back stairs nobody tells you about',
      '2. How to book someone in, start to finish, with a real form',
      '3. The radio: who to call, in what order, and what never goes out over the air',
      '4. A ride-along on a quiet shift and another on a Friday night',
      '5. Paperwork. Then more paperwork.',
      '',
      'Tell them the coffee machine on the second floor is the only one that works.',
    ].join('\n'),
    createdAt: ago(31 * DAY),
    updatedAt: ago(12 * DAY),
  },
];

/** A photo taken with the phone: an inline drawing stands in for it, so the mock needs no network. */
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">' +
      '<rect width="640" height="420" fill="#d9d4c7"/>' +
      '<polygon points="0,0 640,0 640,60 0,110" fill="#ebe7dc"/>' +
      '<polygon points="0,110 640,60 640,420 0,420" fill="#cfc9ba"/>' +
      '<rect x="400" y="130" width="170" height="200" fill="#9db7c9" stroke="#f4f1ea" stroke-width="12"/>' +
      '<path d="M485 130 V330 M400 230 H570" stroke="#f4f1ea" stroke-width="8"/>' +
      '<path d="M60 150 C 95 120, 160 128, 178 165 C 205 178, 198 232, 160 242 C 140 280, 80 272, 66 236 C 34 222, 34 172, 60 150 Z" fill="#8a7f63" opacity="0.55"/>' +
      '<path d="M88 172 C 112 156, 146 164, 152 188 C 164 204, 150 226, 128 226 C 108 240, 84 226, 84 206 C 72 194, 76 180, 88 172 Z" fill="#5f553f" opacity="0.6"/>' +
      '<rect x="0" y="372" width="640" height="48" fill="#7a6a55"/>' +
      '</svg>',
  );

const phoneDocs: StoredPhoneDoc[] = [
  {
    id: 'q7m2x9k4c1ta',
    name: 'Things for the flat',
    kind: 'text',
    content: [
      'Things for the flat',
      '',
      '- Light bulbs for the hallway (screw fitting, not the push ones)',
      '- A shelf for the bathroom',
      '- Ask the landlord about the damp patch again, photo is on here',
      '- Spare key for Mum',
      '- Something to stop the bedroom door banging',
    ].join('\n'),
    locked: false,
    signatures: [],
    createdAt: ago(8 * DAY),
    updatedAt: ago(2 * HOUR),
  },
  {
    id: 'h3v8n5w0r6pb',
    name: 'Tenancy agreement - Alta St 4B',
    kind: 'text',
    content: [
      'TENANCY AGREEMENT',
      '',
      'Property: Flat 4B, Alta Street, Los Santos',
      'Landlord: Marcus Webb',
      'Tenant: Jessica Hale',
      '',
      'Rent is $1,850 a month, due on the first. The deposit of $1,850 is held by the landlord and returned within 14 days of the tenant moving out, less the cost of any damage beyond ordinary wear.',
      '',
      'The tenant keeps the flat clean and tells the landlord about anything that needs repair. The landlord carries out repairs within a reasonable time and gives a day of notice before coming in, except in an emergency.',
      '',
      'Either side may end this agreement with one month of notice in writing.',
      '',
      'This agreement is binding once both parties have signed below.',
    ].join('\n'),
    locked: true,
    signatures: [
      { signer: 'Marcus Webb', signedAt: ago(64 * DAY) },
      { signer: 'Jessica Hale', signedAt: ago(63 * DAY + 4 * HOUR) },
    ],
    createdAt: ago(64 * DAY),
    updatedAt: ago(64 * DAY),
  },
  {
    id: 'd1f6z0y8u4ge',
    name: 'Damp patch, bedroom ceiling',
    kind: 'image',
    content: '',
    url: PHOTO,
    locked: false,
    signatures: [],
    createdAt: ago(3 * DAY),
    updatedAt: ago(3 * DAY),
  },
];

const linkDown = (): boolean => {
  try {
    return window.localStorage.getItem('mock:phonelink') === 'down';
  } catch {
    return false;
  }
};

// The server's sentences (locales/en.json: err.* and files.*), word for word.
const INVALID = 'Invalid request.';
const LINK_DOWN = 'The phone link is unavailable right now.';
const MISSING = 'That document no longer exists.';
const NAME_REQUIRED = 'Give the document a name.';
const nameTaken = (name: string): string => `You already have a document called "${name}".`;
const full = (): string => `You can keep ${MAX_FILES} documents at most. Delete one to make room.`;
const tooLong = (): string => `That document is too long to keep here (${MAX_BODY} characters at most).`;
const UNTITLED = 'Untitled';
const PHONE_MISSING = 'That document is no longer on your phone.';
const PHONE_NO_TEXT = 'That document has no text to copy.';
const PHONE_REFUSED = 'Your phone would not take that document. It may be too long for it, or the phone may be full.';

/** files.lua idOf(): a positive whole number, or null. */
const idOf = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** files.lua cleanName(): one line, trimmed, at most MAX_NAME characters. */
const cleanName = (v: unknown): string =>
  typeof v === 'string'
    ? clipChars(v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim(), MAX_NAME).trim()
    : '';

const taken = (name: string, exceptId?: number | null): boolean => files.some(f => f.id !== exceptId && f.name.toLowerCase() === name.toLowerCase());

/** files.lua freeName(): the name itself, else "name (2)", "name (3)" ... */
const freeName = (base: string): string => {
  const b = base || UNTITLED;
  if (!taken(b)) return b;
  for (let n = 2; n <= files.length + 2; n++) {
    const suffix = ` (${n})`;
    const name = clipChars(b, MAX_NAME - suffix.length).trim() + suffix;
    if (!taken(name)) return name;
  }
  return b;
};

const toRow = (f: StoredFile): FileRow => ({ id: f.id, name: f.name, size: bytes(f.body), createdAt: f.createdAt, updatedAt: f.updatedAt });

const toPhoneRow = (d: StoredPhoneDoc): PhoneRow => ({
  id: d.id,
  name: d.name,
  kind: d.kind,
  // The phone keeps no size for a picture.
  size: d.kind === 'image' ? 0 : bytes(d.content),
  locked: d.locked,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const newPhoneId = (): string => {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
};

/** files.lua clipBytes(): at most `max` bytes, never half a character. */
const clipBytes = (s: string, max: number): string => {
  let out = '';
  let used = 0;
  for (const c of chars(s)) {
    used += bytes(c);
    if (used > max) break;
    out += c;
  }
  return out.trim();
};

const now = (): number => Math.floor(Date.now() / 1000);

const handlers: Record<string, MockHandler> = {
  'files:list': () => {
    const data: ListData = {
      files: [...files].sort((a, b) => b.updatedAt - a.updatedAt || b.id - a.id).map(toRow),
      phone: !linkDown(),
      limits: { maxFiles: MAX_FILES, maxName: MAX_NAME, maxBody: MAX_BODY },
    };
    return ok(data);
  },

  'files:read': p => {
    const id = idOf(p.id);
    if (id === null) return fail(INVALID);
    const f = files.find(x => x.id === id);
    if (!f) return fail(MISSING);
    const data: FileFull = { ...toRow(f), body: f.body };
    return ok(data);
  },

  'files:save': p => {
    let id = idOf(p.id);
    if (p.id !== undefined && p.id !== null && id === null) return fail(INVALID);
    const name = cleanName(p.name);
    if (!name) return fail(NAME_REQUIRED);
    const body = clipChars(typeof p.body === 'string' ? p.body : '', MAX_BODY);

    let f = id !== null ? files.find(x => x.id === id) : undefined;
    if (!f) id = null;
    if (taken(name, id)) return fail(nameTaken(name));

    if (f) {
      f.name = name;
      f.body = body;
      f.updatedAt = now();
    } else {
      if (files.length >= MAX_FILES) return fail(full());
      f = { id: nextId++, name, body, createdAt: now(), updatedAt: now() };
      files.push(f);
    }
    return ok(toRow(f));
  },

  'files:rename': p => {
    const id = idOf(p.id);
    if (id === null) return fail(INVALID);
    const name = cleanName(p.name);
    if (!name) return fail(NAME_REQUIRED);
    const f = files.find(x => x.id === id);
    if (!f) return fail(MISSING);
    if (taken(name, id)) return fail(nameTaken(name));
    f.name = name;
    return ok(toRow(f));
  },

  'files:delete': p => {
    const id = idOf(p.id);
    if (id === null) return fail(INVALID);
    const i = files.findIndex(x => x.id === id);
    if (i >= 0) files.splice(i, 1);
    return ok();
  },

  'files:phoneList': () => {
    if (linkDown()) return fail(LINK_DOWN);
    return ok({ files: [...phoneDocs].sort((a, b) => b.updatedAt - a.updatedAt).map(toPhoneRow) });
  },

  'files:phoneRead': p => {
    if (linkDown()) return fail(LINK_DOWN);
    if (typeof p.id !== 'string' || p.id === '') return fail(INVALID);
    const d = phoneDocs.find(x => x.id === p.id);
    if (!d) return fail(PHONE_MISSING);
    const data: PhoneFull = {
      ...toPhoneRow(d),
      body: d.content,
      url: d.kind === 'image' ? d.url : undefined,
      signatures: d.kind === 'text' ? d.signatures.map(s => ({ ...s })) : [],
    };
    return ok(data);
  },

  'files:toPhone': p => {
    if (linkDown()) return fail(LINK_DOWN);
    const id = idOf(p.id);
    if (id === null) return fail(INVALID);
    const f = files.find(x => x.id === id);
    if (!f) return fail(MISSING);
    // The phone's own rules: the server only learns that it said no.
    if (bytes(f.body) > PHONE_MAX_BYTES || phoneDocs.length >= PHONE_MAX_DOCS) return fail(PHONE_REFUSED);
    const doc: StoredPhoneDoc = {
      id: newPhoneId(),
      name: clipBytes(f.name, PHONE_MAX_NAME),
      kind: 'text',
      content: f.body,
      locked: false,
      signatures: [],
      createdAt: now(),
      updatedAt: now(),
    };
    phoneDocs.push(doc);
    return ok({ id: doc.id });
  },

  'files:fromPhone': p => {
    if (linkDown()) return fail(LINK_DOWN);
    if (typeof p.id !== 'string' || p.id === '') return fail(INVALID);
    const d = phoneDocs.find(x => x.id === p.id);
    if (!d) return fail(PHONE_MISSING);
    if (d.content === '') return fail(PHONE_NO_TEXT);
    if (chars(d.content).length > MAX_BODY) return fail(tooLong());
    if (files.length >= MAX_FILES) return fail(full());
    const f: StoredFile = { id: nextId++, name: freeName(cleanName(d.name)), body: d.content, createdAt: now(), updatedAt: now() };
    files.push(f);
    return ok(toRow(f));
  },
};

export default handlers;
