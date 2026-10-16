import type { MockHandler } from './index';
import { fail, ok } from './index';
import type { Contact, ConversationRow, IncomingPush, Thread, TextMessage } from '@/apps/messages/types';

// Browser mocks for messages:* (server/computers/phoneapps.lua over the sd-phone link, which runs
// sd-phone's server/messages/actions.lua). State lives in module variables so a dev session sticks
// until reload. Same rules as the real thing: a 1:1 thread's id is the peer's bare digits, a group's
// is 'g-<id>'; a send to a number with no thread creates one (titled with the contact's name, else
// the formatted number); ts is unix ms of whole seconds; messages:thread always reports unread 0
// (sd-phone's thread payload has no count); people you text read it and sometimes answer, and the
// answer arrives the way the game delivers it - a 'computers:phone:message' NUI push.
//
// Dev switches (browser console):
//   window.__phoneDown = true       every endpoint fails like a dropped sd-phone link
//   window.__phoneNoService = true  sends fail with "No Service" (the failed bubble + Retry)

const UNAVAILABLE = '手机连接当前不可用。';
const MY_NUMBER = '5551234';
const MY_NAME = 'Jessica Hale';
const MAX_TEXT = 1000;
const SEND_GAP_MS = 500;

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** The phone's clock: unix seconds, sent as ms. */
const nowMs = (): number => Math.floor(Date.now() / 1000) * 1000;
const T0 = nowMs();
const ago = (ms: number): number => Math.floor((T0 - ms) / 1000) * 1000;

interface DevFlags {
  __phoneDown?: boolean;
  __phoneNoService?: boolean;
}
const flags = (): DevFlags => window as unknown as DevFlags;

const fmtNumber = (d: string): string =>
  d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;

// sd-phone's colorFor: a stable colour per number for people who aren't saved contacts.
const PALETTE = ['#0f6cbd', '#c50f1f', '#ca5010', '#986f0b', '#498205', '#038387', '#5c2e91', '#881798', '#4f6bed', '#5d5a58'];
const colorFor = (key: string): string => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

// ── People ──────────────────────────────────────────────────────────────────────────────────

const person = (name: string, phone: string, color: string, initials: string): Contact => ({ id: phone, name, initials, color, phone });

const BENNY = person('Mechanic - Benny', '5558214', '#ca5010', 'MB');
const TASHA = person('Tasha Reyes', '5550117', '#c50f1f', 'TR');
const MARCO = person('Marco Bellini', '5553370', '#498205', 'MB');
const LENA = person('Lena - LSMC', '5554410', '#038387', 'LL');
const RAY = person('Ray - Tow Yard', '5557731', '#986f0b', 'RT');
const MOM = person('妈妈', '5552020', '#881798', 'M');
const ALVAREZ = person('Det. Alvarez', '5553090', '#0f6cbd', 'DA');
const VINNY = person('Vinny Castellano', '5556677', '#5c2e91', 'VC');
const KIM = person('Dr. Kim - Pillbox', '5559146', '#00727c', 'DK');
const HECTOR = person('Hector - PDM Sales', '5558870', '#b4009e', 'HP');

/** The phone's saved contacts. */
const contacts: Contact[] = [BENNY, TASHA, MARCO, LENA, RAY, MOM, ALVAREZ, VINNY, KIM, HECTOR];

/** A group member who isn't in my contacts: the phone shows their character name. */
const DWAYNE: Contact = { id: '5559902', name: 'Dwayne Price', initials: 'DP', color: colorFor('5559902'), phone: '5559902' };

/** sd-phone's resolveParticipant: my saved card, else what the group knows, else the bare number. */
function resolve(digits: string, known?: Contact): Contact {
  const saved = contacts.find(c => c.phone === digits);
  if (saved) return { ...saved };
  if (known) return { ...known };
  return { id: digits, name: fmtNumber(digits), color: colorFor(digits), phone: digits };
}

// ── Pictures (inline SVG so they draw offline; real ones are https URLs) ───────────────────

const svg = (w: number, h: number, body: string): string =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

const PHOTO_IMPOUND = svg(
  320,
  220,
  '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7a24b"/><stop offset=".62" stop-color="#e2557a"/><stop offset="1" stop-color="#3b2a5a"/></linearGradient></defs>' +
    '<rect width="320" height="220" fill="url(#s)"/><circle cx="236" cy="118" r="34" fill="#ffd27a" opacity=".9"/>' +
    '<path d="M0 150V112h46v38zm262 0V94h58v56z" fill="#2b2035"/><rect y="150" width="320" height="70" fill="#231b2d"/>' +
    '<path d="M70 168h148l-15-23c-4-6-10-9-17-9h-70c-8 0-15 4-19 10z" fill="#120d17"/><circle cx="100" cy="171" r="12" fill="#07050a"/><circle cx="188" cy="171" r="12" fill="#07050a"/>' +
    '<path d="M0 186h320" stroke="#3d3049" stroke-dasharray="14 10" stroke-width="3"/>' +
    '<text x="16" y="210" font-family="sans-serif" font-size="12" letter-spacing="2" fill="#cbb8e0">IMPOUND LOT B</text>',
);

const GIF_FRYER = svg(
  240,
  160,
  '<rect width="240" height="160" fill="#1d1a24"/><rect x="60" y="92" width="120" height="52" rx="6" fill="#8a8f99"/><rect x="70" y="100" width="100" height="12" rx="3" fill="#5b606a"/>' +
    '<g fill="#ff7a1a"><path d="M86 92c-6-18 8-26 4-42 14 10 18 26 12 42z"><animateTransform attributeName="transform" type="scale" values="1 1;1 1.12;1 1" dur=".5s" repeatCount="indefinite" additive="sum"/></path>' +
    '<path d="M118 92c-8-24 10-34 4-56 18 14 22 36 14 56z"><animate attributeName="fill" values="#ff7a1a;#ffcc33;#ff7a1a" dur=".6s" repeatCount="indefinite"/></path>' +
    '<path d="M148 92c-5-14 6-22 3-34 12 8 15 20 10 34z"/></g>' +
    '<text x="120" y="28" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="16" fill="#fff">THIS IS FINE</text>',
);

// ── Threads ─────────────────────────────────────────────────────────────────────────────────

interface StoredThread {
  id: string;
  groupName?: string;
  /** Everyone in it but me (a 1:1 resolves its one person from the id). */
  members: Contact[];
  /** Oldest first. */
  messages: TextMessage[];
}

let seq = 4100;
const newId = (): string => `msg-${(++seq).toString(36)}`;

/** A message. Mine are read; theirs are read unless `unread`. */
function m(from: string, ts: number, body: string, extra: Partial<TextMessage> & { unread?: boolean } = {}): TextMessage {
  const { unread, ...rest } = extra;
  return { id: newId(), from, body, kind: 'text', ts, read: from === 'me' || !unread, ...rest };
}

const threads = new Map<string, StoredThread>();
const add = (t: StoredThread): void => {
  threads.set(t.id, t);
};

add({
  id: BENNY.phone!,
  members: [],
  messages: [
    m('me', ago(2 * DAY + 5 * HOUR), "嘿 Benny，我的 Sultan 每次挂三挡都打齿。"),
    m(BENNY.phone!, ago(2 * DAY + 4 * HOUR + 48 * MIN), '开到店里来看看。多半是离合器，RS 那套动力特别费离合。'),
    m('me', ago(2 * DAY + 4 * HOUR + 40 * MIN), '明天能给我挤个空吗？'),
    m(BENNY.phone!, ago(DAY + 2 * HOUR), "明天上午 10 点。别迟到，你弄完还有辆 Banshee 要上架子。"),
    m(BENNY.phone!, ago(42 * MIN), "你的 Sultan 好了。新离合器、全车油液，顺手还做了轮胎动平衡。$1,850。", { unread: true }),
    m(BENNY.phone!, ago(39 * MIN), '店里 8 点关门。带现金来，不然它就成草坪摆件了。', { unread: true }),
  ],
});

add({
  id: 'g-bs01',
  groupName: 'Burgershot 小队',
  members: [TASHA, MARCO, DWAYNE],
  messages: [
    m(TASHA.phone!, ago(3 * HOUR), "6 点的班谁来值？排班表上是空的"),
    m(MARCO.phone!, ago(3 * HOUR - 2 * MIN), "不是我，我得在得来速顶到打烊"),
    m('me', ago(2 * HOUR + 50 * MIN), '要是之后有人接班，我可以顶到 9 点'),
    m(DWAYNE.phone!, ago(2 * HOUR + 46 * MIN), '9 点之后交给我 👍'),
    m(TASHA.phone!, ago(14 * MIN), '还有炸锅又在发那种怪声了。谁都别碰它。', { unread: true }),
    m(MARCO.phone!, ago(12 * MIN), '', { kind: 'gif', gifUrl: GIF_FRYER, unread: true }),
    m(DWAYNE.phone!, ago(6 * MIN), '哈哈哈哈哈又来了', { unread: true }),
  ],
});

add({
  id: '5550199',
  members: [],
  messages: [
    m('5550199', ago(65 * MIN), '那件事你还欠着我。', { unread: true }),
    m('5550199', ago(64 * MIN), '码头。午夜。一个人来。', { unread: true }),
  ],
});

add({
  id: LENA.phone!,
  members: [],
  messages: [
    m(LENA.phone!, ago(DAY + 3 * HOUR), "周五交房租，你那份没问题吧？"),
    m('me', ago(DAY + 2 * HOUR + 55 * MIN), '没问题，这就转'),
    m('me', ago(DAY + 2 * HOUR + 54 * MIN), '', { kind: 'money', amount: 1250, seenAt: ago(DAY + 2 * HOUR + 30 * MIN) }),
    m(LENA.phone!, ago(DAY + 2 * HOUR + 28 * MIN), '收到了，谢谢！！🙏'),
    m(LENA.phone!, ago(5 * HOUR), '昨晚的披萨钱 🍕', { kind: 'money', amount: 120 }),
  ],
});

add({
  id: RAY.phone!,
  members: [],
  messages: [
    m('me', ago(3 * DAY + 4 * HOUR), '格罗夫街那辆 Blista 你拖回来了吗？'),
    m(RAY.phone!, ago(3 * DAY + 3 * HOUR), '', { kind: 'image', gifUrl: PHOTO_IMPOUND }),
    m(RAY.phone!, ago(3 * DAY + 3 * HOUR - MIN), "B 扣押场。车主还有 48 小时，之后就要拍卖了。"),
    m('me', ago(3 * DAY + 2 * HOUR), '谢了 Ray', { seenAt: ago(3 * DAY + HOUR) }),
  ],
});

add({
  id: MOM.phone!,
  members: [],
  messages: [
    m(MOM.phone!, ago(6 * DAY + 3 * HOUR), '你饭吃得够吗？驾照照片上你瘦得吓人。'),
    m('me', ago(6 * DAY + 2 * HOUR), "妈，我好着呢 😅"),
    m(MOM.phone!, ago(6 * DAY + HOUR), '', { kind: 'voice', duration: 47 }),
    m(MOM.phone!, ago(6 * DAY + 59 * MIN), '回个电话！！❤️'),
    m('me', ago(5 * DAY + 20 * HOUR), '这周末就打，说好了', { seenAt: ago(5 * DAY + 19 * HOUR) }),
  ],
});

add({
  id: ALVAREZ.phone!,
  members: [],
  messages: [
    m(ALVAREZ.phone!, ago(12 * DAY), '好麦坞那件案子需要你的笔录。有空来米申罗一趟。'),
    m('me', ago(12 * DAY - 20 * MIN), '这就去'),
    m('me', ago(12 * DAY - 19 * MIN), '米申罗警局', { kind: 'location' }),
    m(ALVAREZ.phone!, ago(12 * DAY - 10 * MIN), '收到。前台，找我。'),
    m('me', ago(11 * DAY), '谢谢警官', { seenAt: ago(11 * DAY - 30 * MIN) }),
  ],
});

add({ id: 'g-pw77', groupName: '佩里托湾周末', members: [TASHA, LENA, VINNY], messages: [] });

// ── Shapes (phoneapps.lua's conversation/contact/message trimmers) ─────────────────────────

const participantsOf = (th: StoredThread): Contact[] => (th.groupName ? th.members.map(p => resolve(p.phone ?? p.id, p)) : [resolve(th.id)]);

const titleOf = (th: StoredThread, participants: Contact[]): string =>
  th.groupName || (participants.length ? participants.map(p => p.name).join(', ') : th.id);

const copy = (msg: TextMessage): TextMessage => ({ ...msg });

function rowOf(th: StoredThread): ConversationRow {
  const participants = participantsOf(th);
  const last = th.messages[th.messages.length - 1];
  const row: ConversationRow = {
    id: th.id,
    title: titleOf(th, participants),
    participants,
    group: th.groupName !== undefined,
    unread: th.messages.filter(x => x.from !== 'me' && !x.read).length,
    muted: false,
  };
  if (last) row.last = copy(last);
  return row;
}

function threadOf(th: StoredThread): Thread {
  const participants = participantsOf(th);
  return {
    id: th.id,
    title: titleOf(th, participants),
    participants,
    group: th.groupName !== undefined,
    // sd-phone's thread payload carries no unread count, so the server always sends 0.
    unread: 0,
    muted: false,
    messages: th.messages.slice(-200).map(copy),
  };
}

// ── People texting back ─────────────────────────────────────────────────────────────────────

const REPLIES: Record<string, string[]> = {
  [BENNY.phone!]: ["只收现金。刷卡机又坏了。", "行行行，我在店里到 8 点。", "趁车还在架子上，要不要我顺手看看刹车？听着挺响的。"],
  [LENA.phone!]: ['👍', '哈哈行', '这周末你还来佩里托湾吗？'],
  [RAY.phone!]: ['10-4。', 'B 场区，大门密码 0451。'],
  [MOM.phone!]: ['爱你，宝贝 ❤️', '我的语音留言你收到了吗？', '你姑妈问你好'],
  [ALVAREZ.phone!]: ['记下了。', '保持联络。可能还有后续问题。'],
  '5550199': ['时间不等人。', "别迟到。"],
};

const GROUP_REPLIES: Record<string, [string, string][]> = {
  'g-bs01': [
    [TASHA.phone!, '行吧'],
    [MARCO.phone!, '店长说谢谢 🙏'],
    [DWAYNE.phone!, '🍔🍔🍔'],
    [TASHA.phone!, '谁把番茄酱换成了芥末'],
  ],
  'g-pw77': [
    [TASHA.phone!, '上铺归我'],
    [VINNY.phone!, "船我带过来"],
  ],
};

const STRANGER = ['新号，你谁？', '你是哪位？'];
const FRIENDLY = ['👍', '收到。', '好！'];

const turn = new Map<string, number>();
const nextOf = <T>(key: string, list: T[]): T => {
  const i = turn.get(key) ?? 0;
  turn.set(key, i + 1);
  return list[i % list.length];
};

/** A text arrives on my phone: store it, then the NUI push the client would forward. */
function receive(threadId: string, from: string, body: string): void {
  const th = threads.get(threadId);
  if (!th) return; // deleted meanwhile
  const msg = m(from, nowMs(), body, { unread: true });
  th.messages.push(msg);
  const data: IncomingPush = { id: th.id, participants: participantsOf(th), messages: [copy(msg)] };
  if (th.groupName) data.groupName = th.groupName;
  window.postMessage({ action: 'computers:phone:message', data }, '*');
}

function answer(th: StoredThread, sent: TextMessage): void {
  if (th.groupName) {
    const pool = GROUP_REPLIES[th.id];
    if (!pool) return;
    const [from, body] = nextOf(th.id, pool);
    window.setTimeout(() => receive(th.id, from, body), 3500 + Math.random() * 3000);
    return;
  }
  // They open it (1:1 only - the phone has no group read receipts)...
  window.setTimeout(() => {
    sent.seenAt = nowMs();
  }, 1200 + Math.random() * 800);
  // ...and usually answer.
  const pool = REPLIES[th.id] ?? (contacts.some(c => c.phone === th.id) ? FRIENDLY : STRANGER);
  window.setTimeout(() => receive(th.id, th.id, nextOf(th.id, pool)), 3500 + Math.random() * 2500);
}

// One unprompted text a little while into the session, so a push to a thread that isn't open
// (and its toast) can be seen without sending anything.
let nudged = false;
function nudgeOnce(): void {
  if (nudged) return;
  nudged = true;
  window.setTimeout(() => receive('5550199', '5550199', '时间不等人。'), 25000);
}

// ── Handlers ────────────────────────────────────────────────────────────────────────────────

let lastSend = 0;

const handlers: Record<string, MockHandler> = {
  'messages:list': () => {
    if (flags().__phoneDown) return fail(UNAVAILABLE);
    nudgeOnce();
    const all = [...threads.values()];
    // sd-phone: threads with messages, newest first, then groups nobody has written in yet.
    const withMsgs = all.filter(x => x.messages.length > 0).map(rowOf);
    withMsgs.sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0));
    const empty = all.filter(x => x.messages.length === 0 && x.groupName !== undefined).map(rowOf);
    return ok({
      conversations: [...withMsgs, ...empty],
      contacts: [...contacts].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ ...c })),
      myNumber: MY_NUMBER,
      myName: MY_NAME,
    });
  },

  'messages:thread': p => {
    if (flags().__phoneDown) return fail(UNAVAILABLE);
    const id = p.id;
    if (typeof id !== 'string' || id === '') return fail('无效请求。');
    const th = threads.get(id);
    if (th) return ok(threadOf(th));
    // Like sd-phone: an unknown key is just an empty thread (a group nobody knows reads "Group").
    if (id.startsWith('g-')) return ok({ id, title: '群聊', participants: [], group: true, unread: 0, muted: false, messages: [] } satisfies Thread);
    return ok(threadOf({ id, members: [], messages: [] }));
  },

  'messages:send': p => {
    if (flags().__phoneDown) return fail(UNAVAILABLE);
    let conv = typeof p.conversation === 'string' ? p.conversation : String(p.conversation ?? '');
    if (!conv.startsWith('g-')) conv = conv.replace(/\D/g, '');
    if (conv === '' || conv === 'g-') return fail('请输入要发送短信的手机号。');
    const body = String(p.body ?? '').slice(0, MAX_TEXT).trim();
    if (!body) return fail('请先输入消息内容。');
    if (Date.now() - lastSend < SEND_GAP_MS) return fail('操作太快了');
    if (flags().__phoneNoService) return fail('无服务');
    if (conv === MY_NUMBER) return fail("不能给自己发消息");
    let th = threads.get(conv);
    if (!th) {
      if (conv.startsWith('g-')) return fail('找不到该会话');
      th = { id: conv, members: [], messages: [] };
      add(th);
    }
    lastSend = Date.now();
    const sent = m('me', nowMs(), body);
    th.messages.push(sent);
    if (th.messages.length > 200) th.messages.splice(0, th.messages.length - 200);
    answer(th, sent);
    return ok(copy(sent));
  },

  'messages:read': p => {
    if (flags().__phoneDown) return fail(UNAVAILABLE);
    if (typeof p.conversation !== 'string') return fail('无效请求。');
    const th = threads.get(p.conversation);
    if (th) for (const x of th.messages) if (x.from !== 'me') x.read = true;
    return ok();
  },

  'messages:delete': p => {
    if (flags().__phoneDown) return fail(UNAVAILABLE);
    if (typeof p.conversation !== 'string') return fail('无效请求。');
    threads.delete(p.conversation);
    return ok();
  },
};

export default handlers;
