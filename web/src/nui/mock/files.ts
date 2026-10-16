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
  /** 'rich' = body is a formatted document as JSON */
  format?: 'rich';
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

let nextId = 8;

/** A picture that draws offline, for the formatted document: a car in the impound lot. */
const LOT_PHOTO =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 400 225"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa9c4"/><stop offset="1" stop-color="#d9c9b0"/></linearGradient></defs><rect width="400" height="225" fill="url(#s)"/><rect y="118" width="400" height="107" fill="#4a4d55"/><rect y="112" width="400" height="8" fill="#6d7079"/><g stroke="#e9e3c8" stroke-width="2.5"><path d="M40 225 78 126M150 225 164 126M250 225 236 126M360 225 322 126"/></g><g stroke="#7f8591" stroke-width="2"><path d="M0 62H400M0 86H400"/><path d="M30 40V118M110 40V118M190 40V118M270 40V118M350 40V118"/></g><path d="M112 168c0-10 6-16 16-18l22-26c5-6 11-9 19-9h62c9 0 15 3 21 9l24 26c12 2 20 8 20 18v14c0 4-3 7-7 7H119c-4 0-7-3-7-7z" fill="#6f7f8f"/><path d="M158 149l16-20c2-3 5-4 9-4h18v24zm50 0v-24h22c4 0 7 1 9 4l17 20z" fill="#27313d"/><circle cx="150" cy="189" r="15" fill="#191b20"/><circle cx="150" cy="189" r="7" fill="#9aa1ad"/><circle cx="262" cy="189" r="15" fill="#191b20"/><circle cx="262" cy="189" r="7" fill="#9aa1ad"/><rect x="293" y="160" width="12" height="7" rx="2" fill="#f2d16b"/><rect x="113" y="160" width="9" height="7" rx="2" fill="#c0392b"/></svg>',
  );

/** A formatted document: what the editor makes of a heading, a part in its own typeface, a picture and lines to sign on. */
const RELEASE_FORM = JSON.stringify({
  v: 1,
  font: 'classic',
  blocks: [
    { t: 'h1', a: 'center', r: [{ s: '车辆放行单' }] },
    { t: 'p', a: 'center', r: [{ s: '米申罗警局 · 扣押场', i: true, c: 'grey' }] },
    { t: 'hr' },
    {
      t: 'p',
      a: 'justify',
      r: [
        { s: '下列车辆在斯卓贝里大道被扣押，现于费用缴清后放行给其登记车主 ' },
        { s: 'Daniel Okafor 先生', b: true },
        { s: '。车主已在前台出示有效驾照与保险证明。' },
      ],
    },
    { t: 'img', src: LOT_PHOTO, w: 50, cap: '14 号车位，到场时拍摄' },
    { t: 'h2', r: [{ s: '车辆' }] },
    {
      t: 'ul',
      items: [
        [{ s: 'Dinka Blista，灰色，车牌 ' }, { s: '46EEK572', f: 'mono', b: true }],
        [{ s: '因占用消防通道停车被扣押' }],
        [{ s: '放行费：' }, { s: '$450，已全额缴清', c: 'green', b: true }],
      ],
    },
    { t: 'p', r: [{ s: '到场时记录后保险杠有划痕。无警士签名不得放行。', z: 's', c: 'red' }] },
    { t: 'sign', label: '放行人（警士）' },
    { t: 'sign', label: '领取人（车主）' },
  ],
});

const files: StoredFile[] = [
  { id: 7, name: '车辆放行单 - Blista', body: RELEASE_FORM, format: 'rich', createdAt: ago(3 * HOUR), updatedAt: ago(25 * MIN) },
  {
    id: 1,
    name: '交接班 - 前台',
    body: [
      '交接 - 米申罗警局前台',
      '白班交给晚班',
      '',
      '前台待办：',
      '- Okafor 先生 18:00 会带着他被扣的 Blista 的手续回来。放行单在最上面的纸盘里，只差一位警士签字。',
      '- 有位女士打了两次电话，说在军团广场附近丢了狗。棕色梗犬，红色项圈，叫 Biscuit。号码记在便签本上。',
      '- 2 号拘留室停用，等维修看过锁再说。不要把人关进去。',
      '',
      '待跟进：',
      '- 档案科还欠我们维斯普奇抢劫案的卷宗。20:00 前没送到就去催。',
      '- 侧门的备用钥匙在 14 号车那里。他们结束巡逻时会交上来。',
      '',
      '大堂摄像头大概每小时会断几秒。已向 IT 报备，发生时记一下时间就行。',
      '',
      '- J. Hale',
    ].join('\n'),
    createdAt: ago(9 * DAY),
    updatedAt: ago(25 * MIN),
  },
  {
    id: 2,
    name: '布控 - 灰色 Sultan',
    body: [
      '注意布控',
      '',
      '车辆：灰色四门 Sultan，后窗贴膜，左后门有凹痕',
      '车牌：不完整，开头 46E，结尾 7',
      '最后目击：约 02:40 在斯卓贝里大道向北行驶',
      '涉嫌：在 Innocence Blvd 的 24/7 外肇事逃逸',
      '',
      '车内有两人。司机穿深色连帽上衣。未见武器。',
      '不要在车流中追逐。上报，保持距离跟随，等第二辆车支援。',
      '',
      '任何目击情况都报给 Moreno 警士，不分时段。',
    ].join('\n'),
    createdAt: ago(3 * HOUR + 20 * MIN),
    updatedAt: ago(3 * HOUR),
  },
  {
    id: 3,
    name: '证人陈述 - 维斯普奇抢劫案',
    body: [
      '证人陈述（草稿，尚未签字）',
      '',
      '地点：米申罗，1 号询问室',
      '证人：店员，独自值班',
      '',
      '她在后厨补货时门铃响了。进来两个男人。一个守在门口，另一个径直走到收银台，叫她打开钱箱。她没看到武器，但他全程一只手插在夹克里。',
      '',
      '他们在店里待了不到两分钟，步行往运河方向离开。片刻后她听到引擎发动，但没看到车。',
      '',
      '收银台边的男人：高瘦，左眉有一道疤，说话很轻。',
      '门口的男人：个子矮些，体格壮，始终没说话，一直在看手机。',
      '',
      '待办：念给她听、取她签名、附上收银机小票。',
    ].join('\n'),
    createdAt: ago(DAY + 6 * HOUR),
    updatedAt: ago(DAY + 2 * HOUR),
  },
  {
    id: 4,
    name: '无线电代码',
    body: [
      '我老是记不住的那些',
      '',
      '10-4   明白',
      '10-7   停止服务',
      '10-8   在岗值勤',
      '10-20  位置',
      '10-23  已到现场',
      '10-32  需要增援',
      '10-50  车辆碰撞',
      '10-76  正在前往',
      '10-97  已到达，正在报到',
      '',
      'Code 2  紧急，不开警灯',
      'Code 3  警灯与警笛',
      'Code 4  无需进一步支援',
      '',
      '先说车号。永远。',
    ].join('\n'),
    createdAt: ago(40 * DAY),
    updatedAt: ago(2 * DAY),
  },
  {
    id: 5,
    name: '证物柜登记',
    body: [
      '证物柜 - 本周进出记录',
      '',
      '周一  存入  0412 号袋  手机，屏幕碎裂          Reyes 警官',
      '周一  存入  0413 号袋  一串车钥匙，无遥控器     Reyes 警官',
      '周二  取出  0398 号袋  送检，Lin 医生签收',
      '周三  存入  0414 号袋  现金，清点两遍，$2,340   Moreno 警士',
      '周四  存入  0415 号袋  厨房刀，封入圆筒         Park 警官',
      '周四  取出  0413 号袋  归还失主，已核对证件',
      '',
      '0409 号袋还缺第二个签名。查一下当晚和 Park 搭班的是谁。',
    ].join('\n'),
    createdAt: ago(18 * DAY),
    updatedAt: ago(5 * DAY),
  },
  {
    id: 6,
    name: '新警员 - 第一周',
    body: [
      '第一周要带新警员过一遍的东西',
      '',
      '1. 这栋楼：军械库、更衣柜、囚室，还有没人告诉你的后楼梯',
      '2. 怎么把一个人走完收押流程，用真实表格从头到尾来一遍',
      '3. 对讲机：该找谁、按什么顺序找，以及什么话绝不能上无线电',
      '4. 一次清闲班次的随车，再加一次周五晚上的',
      '5. 文书。然后是更多文书。',
      '',
      '告诉他们二楼那台咖啡机是唯一还能用的。',
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
    name: '给公寓添置的东西',
    kind: 'text',
    content: [
      '给公寓添置的东西',
      '',
      '- 走廊的灯泡（螺旋口，不是卡口那种）',
      '- 浴室的一层搁板',
      '- 再跟房东提一次墙上的水渍，照片就在这上面',
      '- 给妈妈的备用钥匙',
      '- 想办法别让卧室门咣咣响',
    ].join('\n'),
    locked: false,
    signatures: [],
    createdAt: ago(8 * DAY),
    updatedAt: ago(2 * HOUR),
  },
  {
    id: 'h3v8n5w0r6pb',
    name: '租赁合同 - 阿尔塔街 4B',
    kind: 'text',
    content: [
      '租赁合同',
      '',
      '房产：洛圣都阿尔塔街 4B 号公寓',
      '房东：Marcus Webb',
      '租户：Jessica Hale',
      '',
      '月租 $1,850，每月一号支付。押金 $1,850 由房东保管，租户搬出后 14 天内退还，正常磨损以外的损坏费用从中扣除。',
      '',
      '租户保持公寓整洁，发现需要维修的地方及时告知房东。房东在合理时间内完成维修，进入前提前一天通知，紧急情况除外。',
      '',
      '任何一方均可提前一个月书面通知终止本合同。',
      '',
      '双方在下方签字后，本合同生效。',
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
    name: '水渍，卧室天花板',
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
const INVALID = '无效请求。';
const LINK_DOWN = '手机连接当前不可用。';
const MISSING = '该文档已不存在。';
const NAME_REQUIRED = '请给文档起个名字。';
const nameTaken = (name: string): string => `你已有一个名为“${name}”的文档。`;
const full = (): string => `最多只能保留 ${MAX_FILES} 份文档。删掉一份腾出空间。`;
const tooLong = (): string => `该文档太长，无法保存在这里（最多 ${MAX_BODY} 个字符）。`;
const UNTITLED = '未命名';
const PHONE_MISSING = '该文档已不在你的手机上。';
const PHONE_NO_TEXT = '该文档没有可复制的文字。';
const PHONE_REFUSED = '你的手机无法接收该文档。可能文档太长，或者手机空间已满。';

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
    const data: FileFull = { ...toRow(f), body: f.body, format: f.format ?? 'text' };
    return ok(data);
  },

  'files:save': p => {
    let id = idOf(p.id);
    if (p.id !== undefined && p.id !== null && id === null) return fail(INVALID);
    const name = cleanName(p.name);
    if (!name) return fail(NAME_REQUIRED);
    const rich = p.format === 'rich';
    const body = rich ? String(p.body ?? '') : clipChars(typeof p.body === 'string' ? p.body : '', MAX_BODY);

    let f = id !== null ? files.find(x => x.id === id) : undefined;
    if (!f) id = null;
    if (taken(name, id)) return fail(nameTaken(name));

    if (f) {
      f.name = name;
      f.body = body;
      f.format = rich ? 'rich' : undefined;
      f.updatedAt = now();
    } else {
      if (files.length >= MAX_FILES) return fail(full());
      f = { id: nextId++, name, body, format: rich ? 'rich' : undefined, createdAt: now(), updatedAt: now() };
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
