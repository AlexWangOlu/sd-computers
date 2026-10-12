import type { MockHandler } from './index';
import { ok, fail } from './index';

// Browser mocks for notes:list / notes:save / notes:delete, mirroring server/computers/profile.lua:
// an unknown or missing id makes a new note, an empty title becomes "Untitled", title/body are cut
// to 80/20000 chars, at 50 notes a new save is refused, deleting an unknown id is a no-op.

interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

const MAX_NOTES = 50;
const MAX_TITLE = 80;
const MAX_BODY = 20000;

const now = (): number => Math.floor(Date.now() / 1000);
const newId = (): string => now().toString(16) + Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');

const notes: Note[] = [
  {
    id: '66f1a2b30a1c',
    title: 'Shift handover',
    body: [
      'Shift handover - nights -> days',
      '',
      '- 10-80 on Route 68 ended at Harmony, suspect in custody (cell 3)',
      '- Pillbox called: GSW victim from Grove St stable, statement pending',
      '- Impound lot gate sticks again, ticket raised with facilities',
      '- Armoury count done 05:40, all signed back in',
      '',
      'Reminder: briefing room booked 14:00 for the bank detail.',
    ].join('\n'),
    updatedAt: now() - 25 * 60,
  },
  {
    id: '66f0f9e10b7e',
    title: 'Plate list',
    body: ['BOLO plates', '', '46EEK572  black Sultan RS  - linked to Vinewood burglaries', '88JAX190  white Speedo   - stolen, Sandy Shores', '12ROC447  red Buffalo S  - expired reg, warn only', '03FKN882  grey Baller    - flagged by Gang Unit'].join('\n'),
    updatedAt: now() - 3 * 3600,
  },
  {
    id: '66ee41c70f02',
    title: 'Passwords - DO NOT SHARE',
    body: ['Front desk PC PIN: ask the Sergeant', 'Records terminal: hale.j / Spring2026!', 'Armoury keypad: changes every Monday', '', 'Seriously, do not leave this note open.'].join('\n'),
    updatedAt: now() - 2 * 86400,
  },
];

const sorted = (): Note[] => [...notes].sort((a, b) => b.updatedAt - a.updatedAt).map(n => ({ ...n }));

const handlers: Record<string, MockHandler> = {
  'notes:list': () => ok(sorted()),

  'notes:save': p => {
    const input = p.note as { id?: unknown; title?: unknown; body?: unknown } | undefined;
    if (!input || typeof input !== 'object') return fail('Invalid request.');
    const title = String(input.title ?? '').slice(0, MAX_TITLE) || 'Untitled';
    const body = String(input.body ?? '').slice(0, MAX_BODY);
    const existing = input.id !== undefined ? notes.find(n => n.id === input.id) : undefined;
    if (existing) {
      existing.title = title;
      existing.body = body;
      existing.updatedAt = now();
      return ok({ ...existing });
    }
    if (notes.length >= MAX_NOTES) return fail('You have reached the maximum number of notes.');
    const note: Note = { id: newId(), title, body, updatedAt: now() };
    notes.push(note);
    return ok({ ...note });
  },

  'notes:delete': p => {
    const i = notes.findIndex(n => n.id === p.id);
    if (i >= 0) notes.splice(i, 1);
    return ok();
  },
};

export default handlers;
