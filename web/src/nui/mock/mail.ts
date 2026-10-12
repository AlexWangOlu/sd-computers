import type { MockHandler } from './index';
import { fail, ok } from './index';

// Browser stand-in for server/computers/mail.lua + mailstore.lua. State lives in module variables so
// everything you do in a dev session sticks until reload. Same rules as the server: addresses are
// shared and password-protected, a bare username gets @lsmail.com, unknown recipients bounce back
// from the Mail Delivery Subsystem, and deliveries to a signed-in address push 'mail:received'.

const DOMAIN = 'lsmail.com';
const MAX_SIGNED_IN = 5;
const MAX_CREATED = 3;
const MAX_RECIPIENTS = 20;
const MAX_SUBJECT = 200;
const MAX_BODY = 10000;
const MIN_PASSWORD = 6;
const MAX_DISPLAY_NAME = 40;

type StoredFolder = 'inbox' | 'sent' | 'drafts' | 'bin';

interface Account {
  name: string;
  password: string;
}

interface Row {
  id: number;
  owner: string;
  folder: StoredFolder;
  prevFolder?: StoredFolder;
  from: { email: string; name: string };
  to: string[];
  subject: string;
  body: string;
  read: boolean;
  flagged: boolean;
  ts: number;
}

const now = (): number => Math.floor(Date.now() / 1000);
const MIN = 60;
const HOUR = 3600;
const DAY = 86400;

const accounts: Record<string, Account> = {
  'jessica.hale@lsmail.com': { name: 'Jessica Hale', password: 'hale1031' },
  'lspd.records@lsmail.com': { name: 'LSPD Records', password: 'records1' },
  'dispatch@lsmail.com': { name: 'LSPD Dispatch', password: 'dispatch-9' },
  'hr@lsmail.com': { name: 'City of Los Santos HR', password: 'hr-portal' },
  'mike.r@lsmail.com': { name: 'Mike Rodriguez', password: 'mikerod' },
  'mailer-daemon@lsmail.com': { name: 'Mail Delivery Subsystem', password: 'daemon-x' },
};

const signedIn = new Set<string>(['jessica.hale@lsmail.com']);
let created = 0;
let seq = 1000;

const JH = { email: 'jessica.hale@lsmail.com', name: 'Jessica Hale' };
const DISPATCH = { email: 'dispatch@lsmail.com', name: 'LSPD Dispatch' };
const HR = { email: 'hr@lsmail.com', name: 'City of Los Santos HR' };
const MIKE = { email: 'mike.r@lsmail.com', name: 'Mike Rodriguez' };
const RECORDS = { email: 'lspd.records@lsmail.com', name: 'LSPD Records' };
const DAEMON = { email: 'mailer-daemon@lsmail.com', name: 'Mail Delivery Subsystem' };

const seed = (owner: string, folder: StoredFolder, from: Row['from'], to: string[], subject: string, body: string, ago: number, opts: { read?: boolean; flagged?: boolean; prevFolder?: StoredFolder } = {}): Row => ({
  id: ++seq,
  owner,
  folder,
  prevFolder: opts.prevFolder,
  from,
  to,
  subject,
  body,
  read: opts.read ?? true,
  flagged: opts.flagged ?? false,
  ts: now() - ago,
});

const J = JH.email;
const R = RECORDS.email;

// Oldest first, so ids climb with time like the real AUTO_INCREMENT.
const rows: Row[] = [
  seed(J, 'inbox', HR, [J], 'Welcome to the Los Santos Police Department',
    `Officer Hale,\n\nWelcome aboard. Your badge number is 1031 and you are assigned to Mission Row (MRPD), B-shift.\n\nBefore your first patrol, please:\n  1. Collect your duty kit from the armory (bring this email).\n  2. Complete the MDT orientation with Sgt. Collins.\n  3. Sign the use-of-force policy acknowledgement at the front desk.\n\nYour LSMail address is now active. Keep the password private - addresses are shared resources and anyone with the password can sign in.\n\nCity of Los Santos - Human Resources`,
    21 * DAY),
  seed(J, 'inbox', { email: 'no-reply@fleeca.com', name: 'Fleeca Bank' }, [J], 'Your monthly statement is ready',
    `Hi Jessica,\n\nYour statement for checking account ****4471 is ready to view.\n\nOpening balance: $4,812.20\nClosing balance: $6,143.75\n\nLog in at any Fleeca branch or ATM to view the full statement.\n\nFleeca - Banking that moves with you.\nThis is an automated message, please do not reply.`,
    5 * DAY + 2 * HOUR),
  seed(J, 'sent', JH, [MIKE.email], 'Vespucci beat swap',
    `Mike,\n\nAny chance you'd swap your Vespucci beat on Thursday for my Mirror Park one? I've got a court date at 14:00 and Mirror Park is a lot closer to the courthouse.\n\nHappy to cover your Saturday in return.\n\nJess`,
    4 * DAY + 3 * HOUR),
  seed(J, 'inbox', DISPATCH, [J, 'patrol.b@lsmail.com'], 'Shift roster: week 41',
    `B-shift roster for week 41 is attached below.\n\nMON  Hale / Rodriguez     Unit 1-ADAM-12   Mission Row\nTUE  Hale / Rodriguez     Unit 1-ADAM-12   Vinewood\nWED  OFF\nTHU  Hale / Collins       Unit 1-LINCOLN-4 Mirror Park\nFRI  Hale / Rodriguez     Unit 1-ADAM-12   Vespucci\n\nSwaps must be approved by the watch commander 24h in advance.\n\nLSPD Dispatch`,
    6 * DAY, { flagged: true }),
  seed(J, 'inbox', MIKE, [J], 'Re: Vespucci beat swap',
    `Deal. Thursday's yours, Saturday's mine - don't forget I'm on nights that week so it's the 22:00 start.\n\nAlso the cruiser's AC is still busted, bring water.\n\n- Mike`,
    3 * DAY + 5 * HOUR),
  seed(J, 'sent', JH, [R], 'Records request - case 26-1187',
    `Hi Records,\n\nCould you pull the full history for plate 46EEK572 and any priors for the registered owner? It's for case 26-1187 (vehicle pursuit, Del Perro Fwy).\n\nThanks,\nOfficer J. Hale #1031`,
    2 * DAY + 6 * HOUR),
  seed(J, 'inbox', RECORDS, [J], 'Records request #4471 completed',
    `Officer Hale,\n\nYour request for case 26-1187 is complete.\n\nPlate 46EEK572 - Black Ubermacht Sentinel XS\nRegistered owner: Trevor P. (address on file, Sandy Shores)\nPriors: 3x reckless driving, 1x evading, 1x unpaid impound (Davis Mega Mall lot)\n\nThe full packet is in the records room, drawer 4.\n\nLSPD Records`,
    2 * DAY),
  seed(J, 'inbox', { email: 'newsletter@lifeinvader.com', name: 'LifeInvader' }, [J], 'Your weekly LifeInvader digest: 14 new pokes',
    `Hey Jessica!\n\nHere's what you missed this week on LifeInvader:\n\n- 14 people poked you\n- Lester Crest viewed your profile (again)\n- 3 friends checked in at Bahama Mamas West\n- Trending: "Is the Vinewood sign actually haunted?"\n\nRemember: privacy is so last decade. Share more!\n\nLifeInvader - Invading your life since 2008.\nUnsubscribe? Ha.`,
    1 * DAY + 4 * HOUR, { read: false }),
  seed(J, 'inbox', DAEMON, [J], 'Undeliverable: message could not be delivered',
    `Your message could not be delivered to the following recipients because the address does not exist:\n\nsgt.colins@lsmail.com\n\nOriginal subject: MDT orientation - Friday?`,
    1 * DAY + 1 * HOUR),
  seed(J, 'inbox', HR, [J], 'Action required: Q4 firearms recertification',
    `Officer Hale,\n\nOur records show your firearms qualification expires on 10/31. Recertification sessions at the Pillbox Hill range:\n\n  - Tue 10/13, 09:00\n  - Thu 10/15, 14:00\n  - Sat 10/17, 10:00\n\nReply with your preferred session. Officers who are not recertified by the deadline will be placed on desk duty.\n\nCity of Los Santos - Human Resources`,
    3 * HOUR, { flagged: true }),
  seed(J, 'drafts', JH, [HR.email], 'Leave request: Oct 18-20',
    `Hi HR,\n\nI'd like to request annual leave from Sunday 10/18 to Tuesday 10/20 (3 days). Mike Rodriguez has agreed to`,
    90 * MIN),
  seed(J, 'inbox', MIKE, [J], 'Lunch at Bean Machine?',
    `Bean Machine on Vinewood Blvd at 1? I owe you a coffee for covering my report last week.\n\nIf we get a call we'll just take it to go.`,
    40 * MIN, { read: false }),
  seed(J, 'inbox', DISPATCH, [J, 'patrol.b@lsmail.com', MIKE.email], 'BOLO: Black Sultan RS, plate 46EEK572',
    `ALL UNITS - BE ON THE LOOKOUT\n\nVehicle: Black Karin Sultan RS, tinted windows, aftermarket spoiler\nPlate: 46EEK572 (may be swapped)\nLast seen: Northbound on Del Perro Fwy near the Pier exit, 14:52\nWanted for: Armed robbery - 24/7 Supermarket, Innocence Blvd\n\nOccupants: 2 males, one wearing a green hoodie. Considered ARMED. Do NOT attempt a solo stop - call it in and wait for backup.\n\nLSPD Dispatch`,
    12 * MIN, { read: false, flagged: true }),
  seed(J, 'bin', { email: 'warranty@autoexotics.com', name: 'Auto Exotics' }, [J], "We've been trying to reach you about your car's extended warranty",
    `Dear valued motorist,\n\nThis is your FINAL notice regarding your vehicle's extended warranty. Call 1-800-AUTO-EXO now to avoid losing coverage on your Vapid Stanier.\n\n(Your vehicle is a police cruiser. We know. Call anyway.)`,
    4 * DAY, { prevFolder: 'inbox' }),

  seed(R, 'inbox', HR, [R], 'Records retention policy update',
    `Records team,\n\nEffective November 1st, incident reports must be retained for 7 years (up from 5). Please update the archive schedule accordingly.\n\nCity of Los Santos - Human Resources`,
    9 * DAY),
  seed(R, 'inbox', DISPATCH, [R], 'Incident report IR-26-3310 filed',
    `Incident report IR-26-3310 (traffic collision, Alta St / Las Lagunas Blvd) has been filed by Unit 1-ADAM-12 and is ready for indexing.\n\nLSPD Dispatch`,
    3 * DAY, { read: false }),
  seed(R, 'inbox', JH, [R], 'Records request - case 26-1187',
    `Hi Records,\n\nCould you pull the full history for plate 46EEK572 and any priors for the registered owner? It's for case 26-1187 (vehicle pursuit, Del Perro Fwy).\n\nThanks,\nOfficer J. Hale #1031`,
    2 * DAY + 6 * HOUR),
  seed(R, 'sent', RECORDS, [J], 'Records request #4471 completed',
    `Officer Hale,\n\nYour request for case 26-1187 is complete.\n\n(see full packet in drawer 4)\n\nLSPD Records`,
    2 * DAY),
];

// ── Helpers (mirroring mail.lua) ───────────────────────────────────────────────────────────

function normalize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let a = raw.trim().toLowerCase();
  if (!a) return null;
  if (!a.includes('@')) a = `${a}@${DOMAIN}`;
  if (a.length > 64 || !/^[a-z0-9][a-z0-9._-]*@[a-z0-9.-]+$/.test(a)) return null;
  return a;
}

function recipients(to: unknown): string[] | null {
  const raw: unknown[] = typeof to === 'string' ? to.split(/[,;]/) : Array.isArray(to) ? to : [];
  const out: string[] = [];
  for (const r of raw) {
    const a = normalize(r);
    if (!a) return null;
    if (!out.includes(a)) out.push(a);
  }
  if (out.length === 0 || out.length > MAX_RECIPIENTS) return null;
  return out;
}

const mine = (email: unknown): string | null => {
  const a = normalize(email);
  return a && signedIn.has(a) ? a : null;
};

const NOT_SIGNED_IN = 'You are not signed in to that mailbox.';

const clip = (subject: unknown, body: unknown): [string, string] => [String(subject ?? '').slice(0, MAX_SUBJECT), String(body ?? '').slice(0, MAX_BODY)];

const find = (owner: string, id: unknown): Row | undefined => rows.find(r => r.owner === owner && r.id === Number(id));

function counts(owner: string) {
  const c = { unread: 0, inbox: 0, sent: 0, drafts: 0, bin: 0, flagged: 0 };
  for (const r of rows) {
    if (r.owner !== owner) continue;
    c[r.folder]++;
    if (r.folder === 'inbox' && !r.read) c.unread++;
    if (r.flagged && r.folder !== 'bin') c.flagged++;
  }
  return c;
}

const shape = (r: Row, withBody: boolean) => ({
  id: r.id,
  folder: r.folder,
  from: { ...r.from },
  to: [...r.to],
  subject: r.subject,
  preview: r.body.slice(0, 160),
  ...(withBody ? { body: r.body } : {}),
  read: r.read,
  flagged: r.flagged,
  ts: r.ts,
});

/** What the client's 'computers:mail:received' NUI message does: bus event + toast (App.tsx). */
function push(mailbox: string, r: Row): void {
  if (!signedIn.has(mailbox)) return;
  const data = { mailbox, message: { id: r.id, senderName: r.from.name, senderEmail: r.from.email, subject: r.subject, preview: r.body.slice(0, 160) } };
  window.setTimeout(() => window.postMessage({ action: 'computers:mail:received', data }, '*'), 500);
}

function insert(owner: string, folder: StoredFolder, from: Row['from'], to: string[], subject: string, body: string, read: boolean): Row {
  const r: Row = { id: ++seq, owner, folder, from: { ...from }, to: [...to], subject, body, read, flagged: false, ts: now() };
  rows.push(r);
  return r;
}

function deliver(from: Row['from'], to: string[], subject: string, body: string, account: boolean): { delivered: string[]; failed: string[] } {
  const delivered: string[] = [];
  const failed: string[] = [];
  for (const addr of to) {
    if (accounts[addr]) {
      const r = insert(addr, 'inbox', from, to, subject, body, false);
      delivered.push(addr);
      push(addr, r);
    } else {
      failed.push(addr);
    }
  }
  if (account) {
    insert(from.email, 'sent', from, to, subject, body, true);
    if (failed.length > 0) {
      const bounce = insert(
        from.email,
        'inbox',
        DAEMON,
        [from.email],
        'Undeliverable: message could not be delivered',
        `Your message could not be delivered to the following recipients because the address does not exist:\n\n${failed.join('\n')}\n\nOriginal subject: ${subject}`,
        false,
      );
      push(from.email, bounce);
    }
  }
  return { delivered, failed };
}

// A colleague writes in a while after Mail is first opened, so the live-push path can be seen in dev.
let demoQueued = false;
function queueDemoMail(): void {
  if (demoQueued) return;
  demoQueued = true;
  window.setTimeout(() => {
    deliver(MIKE, [JH.email], 'Still on for 1?', "Grabbing a table by the window. Want your usual or are you finally trying the Pumpkin Spice Liberty?\n\n- Mike", false);
  }, 75000);
}

// ── Handlers ───────────────────────────────────────────────────────────────────────────────

const handlers: Record<string, MockHandler> = {
  'mail:state': () => {
    queueDemoMail();
    return ok({
      domain: DOMAIN,
      accounts: [...signedIn].sort().map(email => ({ email, name: accounts[email]?.name ?? email, counts: counts(email) })),
      canSignIn: signedIn.size < MAX_SIGNED_IN,
      canCreate: created < MAX_CREATED,
    });
  },

  'mail:list': p => {
    const email = mine(p.email);
    if (!email) return fail(NOT_SIGNED_IN);
    const folder = ['inbox', 'sent', 'drafts', 'bin', 'flagged'].includes(String(p.folder)) ? String(p.folder) : 'inbox';
    const q = typeof p.search === 'string' ? p.search.slice(0, 64).toLowerCase() : '';
    const list = rows
      .filter(r => r.owner === email && (folder === 'flagged' ? r.flagged && r.folder !== 'bin' : r.folder === folder))
      .filter(r => !q || [r.subject, r.from.name, r.from.email, r.body].some(s => s.toLowerCase().includes(q)))
      .sort((a, b) => b.id - a.id)
      .slice(0, 200)
      .map(r => shape(r, false));
    return ok({ messages: list, counts: counts(email) });
  },

  'mail:read': p => {
    const email = mine(p.email);
    if (!email) return fail(NOT_SIGNED_IN);
    const r = find(email, p.id);
    if (!r) return fail('That message no longer exists.');
    r.read = true;
    return ok(shape(r, true));
  },

  'mail:send': p => {
    const from = mine(p.from);
    if (!from) return fail(NOT_SIGNED_IN);
    const to = recipients(p.to);
    if (!to) return fail(`Enter between 1 and ${MAX_RECIPIENTS} valid recipient addresses.`);
    const [subject, body] = clip(p.subject, p.body);
    if (!subject && !body) return fail('Write a subject or a message first.');
    const res = deliver({ email: from, name: accounts[from]?.name ?? from }, to, subject, body, true);
    const draft = find(from, p.draftId);
    if (draft && (draft.folder === 'drafts' || draft.folder === 'bin')) rows.splice(rows.indexOf(draft), 1);
    return ok(res);
  },

  'mail:draft': p => {
    const from = mine(p.from);
    if (!from) return fail(NOT_SIGNED_IN);
    const to = p.to && p.to !== '' ? recipients(p.to) ?? [] : [];
    const [subject, body] = clip(p.subject, p.body);
    const existing = find(from, p.draftId);
    if (existing && existing.folder === 'drafts') {
      Object.assign(existing, { to, subject, body, ts: now() });
      return ok({ id: existing.id });
    }
    const r = insert(from, 'drafts', { email: from, name: accounts[from]?.name ?? from }, to, subject, body, true);
    return ok({ id: r.id });
  },

  'mail:flag': p => {
    const email = mine(p.email);
    if (!email) return fail(NOT_SIGNED_IN);
    const r = find(email, p.id);
    if (r) r.flagged = p.flagged === true;
    return ok();
  },

  'mail:markRead': p => {
    const email = mine(p.email);
    if (!email) return fail(NOT_SIGNED_IN);
    const r = find(email, p.id);
    if (r) r.read = p.read === true;
    return ok();
  },

  'mail:bin': p => {
    const email = mine(p.email);
    if (!email) return fail(NOT_SIGNED_IN);
    const r = find(email, p.id);
    if (!r) return ok();
    if (p.bin !== false) {
      if (r.folder !== 'bin') {
        r.prevFolder = r.folder;
        r.folder = 'bin';
      }
    } else if (r.folder === 'bin') {
      r.folder = r.prevFolder ?? 'inbox';
      r.prevFolder = undefined;
    }
    return ok();
  },

  'mail:delete': p => {
    const email = mine(p.email);
    if (!email) return fail(NOT_SIGNED_IN);
    const r = find(email, p.id);
    if (r && (r.folder === 'bin' || r.folder === 'drafts')) rows.splice(rows.indexOf(r), 1);
    return ok();
  },

  'mail:emptyBin': p => {
    const email = mine(p.email);
    if (!email) return fail(NOT_SIGNED_IN);
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].owner === email && rows[i].folder === 'bin') rows.splice(i, 1);
    return ok();
  },

  'mail:signUp': p => {
    const user = typeof p.username === 'string' ? p.username.toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(user)) return fail('Usernames are 2-32 characters: letters, numbers, dots, dashes and underscores.');
    const pw = p.password;
    if (typeof pw !== 'string' || pw.length < MIN_PASSWORD || pw.length > 64) return fail(`Passwords must be at least ${MIN_PASSWORD} characters.`);
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || name.length > MAX_DISPLAY_NAME) return fail(`Enter a display name (max ${MAX_DISPLAY_NAME} characters).`);
    if (created >= MAX_CREATED) return fail(`You can only create ${MAX_CREATED} mail accounts.`);
    if (signedIn.size >= MAX_SIGNED_IN) return fail(`You can be signed in to at most ${MAX_SIGNED_IN} accounts.`);
    const email = `${user}@${DOMAIN}`;
    if (accounts[email]) return fail('That address is already taken.');
    accounts[email] = { name, password: pw };
    created++;
    signedIn.add(email);
    return ok({ email });
  },

  'mail:signIn': p => {
    const email = normalize(p.email);
    if (!email || typeof p.password !== 'string') return fail('That address or password is incorrect.');
    if (signedIn.size >= MAX_SIGNED_IN) return fail(`You can be signed in to at most ${MAX_SIGNED_IN} accounts.`);
    const acct = accounts[email];
    if (!acct || acct.password !== p.password) return fail('That address or password is incorrect.');
    signedIn.add(email);
    return ok({ email });
  },

  'mail:signOut': p => {
    const email = mine(p.email);
    if (email) signedIn.delete(email);
    return ok();
  },
};

export default handlers;
