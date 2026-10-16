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
      'Fleeca 行动 - Great Ocean Hwy',
      '',
      '人手：我、Dex（开车）、Kira（电脑）',
      '需要：铝热剂 x2、钻机、笔记本电脑、3 部一次性手机',
      '动手时机：换班时，21:00 整',
      '撤离路线：佩里托湾后路 -> Procopio 上船',
      '',
      '对讲里不许提名字。用完的一次性手机扔海里。',
    ].join('\n'),
    images: ['https://picsum.photos/seed/fleeca/600/400', 'https://picsum.photos/seed/procopio/600/400'],
    sketches: [ROUTE_SKETCH],
    createdAt: iso(3 * DAY),
    updatedAt: iso(14 * MIN),
  },
  {
    id: 'p8d2w6r4t0yb',
    body: [
      '采购清单',
      '- 给 Mia 的生日礼品卡（Burger Shot）',
      '- Sultan 的新轮胎，找 Benny 问个折扣',
      '- 手机壳，Digital Den',
      '- 洗衣液',
      '- 狗粮（要好的那种）',
    ].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(2 * DAY),
    updatedAt: iso(3 * HOUR),
  },
  {
    id: 'g5n1c7h3j9ue',
    body: ['采购 - Innocence Blvd 的 24/7', '鸡蛋', '面包', '燕麦奶', '咖啡豆', '冷冻披萨 x3', '猫粮！！'].join('\n'),
    images: ['https://picsum.photos/seed/receipt/600/400'],
    sketches: [],
    createdAt: iso(DAY + 5 * HOUR),
    updatedAt: iso(DAY + 2 * HOUR),
  },
  {
    id: 'b2x8m4q6s0lf',
    body: [
      '电话号码',
      'Benny（修车）555-0142',
      'Sato 医生，圆堡山 555-0177',
      'Hale & Partners（律师）555-0109',
      'Davis 拖车 555-0163',
      'Pizza This 555-0120',
      '',
      "别存 Kira 的号码。记在脑子里。",
    ].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(20 * DAY),
    updatedAt: iso(3 * DAY),
  },
  {
    id: 'r7t3y9u1i5oc',
    body: [
      '好麦坞之夜（草稿）',
      '',
      '大道上的霓虹，雨里的警笛',
      '我把你的号码写在罚单上，如今又欠这座城市两回',
      '从德尔佩罗开到山丘再折返，电台放着我们的歌',
      "满城灯火都在说走吧，我们怎么就走岔了",
      '',
      '副歌？？写点和码头有关的',
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
      '开庭 - 周二 10:00',
      '米申罗法院，2 号庭',
      '带：身份证件、保险证明、保释金收据（$2,500）',
      '前一天给 Hale 打个电话。穿灰西装，别穿运动服。',
    ].join('\n'),
    images: [],
    sketches: [],
    createdAt: iso(16 * DAY),
    updatedAt: iso(12 * DAY),
  },
  {
    id: 'm1q7w3e9r5th',
    body: ['车聚 - 周六', 'LS Customs 停车场，22:00', '开 Elegy 来，车牌要干净', '别戴面罩，警察总会来转一圈'].join('\n'),
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
const LINK_DOWN = '手机连接当前不可用。';

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
    if (typeof p.id !== 'string') return fail('无效请求。');
    const n = notes.find(x => x.id === p.id);
    if (!n) return fail('该便签已不存在。');
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
    if (notes.length >= MAX_NOTES) return fail('你已达到便签数量上限。');
    notes.push({ id, body, images: [], sketches: [], createdAt: now, updatedAt: now });
    const res: SaveData = { id, createdAt: now, updatedAt: now };
    return ok(res);
  },

  'phonenotes:delete': p => {
    if (linkDown()) return fail(LINK_DOWN);
    if (typeof p.id !== 'string' || p.id === '') return fail('无效的便签 ID');
    const i = notes.findIndex(x => x.id === p.id);
    if (i >= 0) notes.splice(i, 1);
    return ok();
  },
};

export default handlers;
