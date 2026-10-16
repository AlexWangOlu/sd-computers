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
  'lspd.records@lsmail.com': { name: '洛圣都警局档案科', password: 'records1' },
  'dispatch@lsmail.com': { name: '洛圣都警局调度', password: 'dispatch-9' },
  'hr@lsmail.com': { name: '洛圣都市人事部', password: 'hr-portal' },
  'mike.r@lsmail.com': { name: 'Mike Rodriguez', password: 'mikerod' },
  'mailer-daemon@lsmail.com': { name: '邮件投递子系统', password: 'daemon-x' },
};

const signedIn = new Set<string>(['jessica.hale@lsmail.com']);
let created = 0;
let seq = 1000;

const JH = { email: 'jessica.hale@lsmail.com', name: 'Jessica Hale' };
const DISPATCH = { email: 'dispatch@lsmail.com', name: '洛圣都警局调度' };
const HR = { email: 'hr@lsmail.com', name: '洛圣都市人事部' };
const MIKE = { email: 'mike.r@lsmail.com', name: 'Mike Rodriguez' };
const RECORDS = { email: 'lspd.records@lsmail.com', name: '洛圣都警局档案科' };
const DAEMON = { email: 'mailer-daemon@lsmail.com', name: '邮件投递子系统' };

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
  seed(J, 'inbox', HR, [J], '欢迎加入洛圣都警察局',
    `Hale 警官，\n\n欢迎加入。你的警号是 1031，被分配到米申罗（MRPD）B 班。\n\n首次巡逻之前，请：\n  1. 到军械库领取执勤装备（带上这封邮件）。\n  2. 与 Sgt. Collins 完成 MDT 入门培训。\n  3. 在前台签阅使用武力政策确认书。\n\n你的 LSMail 地址现已启用。请勿外泄密码——地址是共享资源，知道密码的人都能登录。\n\n洛圣都市人事部`,
    21 * DAY),
  seed(J, 'inbox', { email: 'no-reply@fleeca.com', name: 'Fleeca 银行' }, [J], '你的月度对账单已就绪',
    `Jessica 你好，\n\n你尾号 ****4471 的支票账户对账单已可查看。\n\n期初余额：$4,812.20\n期末余额：$6,143.75\n\n到任意 Fleeca 分行或 ATM 登录即可查看完整对账单。\n\nFleeca - 与你同行的银行。\n本邮件为系统自动发送，请勿回复。`,
    5 * DAY + 2 * HOUR),
  seed(J, 'sent', JH, [MIKE.email], '维斯普奇巡逻区换班',
    `Mike，\n\n周四能不能拿你的维斯普奇巡逻区换我的镜湖公园？我 14:00 要出庭，镜湖公园离法院近得多。\n\n作为交换，我很乐意替你值周六的班。\n\nJess`,
    4 * DAY + 3 * HOUR),
  seed(J, 'inbox', DISPATCH, [J, 'patrol.b@lsmail.com'], '排班表：第 41 周',
    `第 41 周 B 班排班表见下。\n\n周一  Hale / Rodriguez    1-ADAM-12 号车    米申罗\n周二  Hale / Rodriguez    1-ADAM-12 号车    好麦坞\n周三  休息\n周四  Hale / Collins      1-LINCOLN-4 号车  镜湖公园\n周五  Hale / Rodriguez    1-ADAM-12 号车    维斯普奇\n\n调班须提前 24 小时经值班指挥官批准。\n\n洛圣都警局调度`,
    6 * DAY, { flagged: true }),
  seed(J, 'inbox', MIKE, [J], '回复：维斯普奇巡逻区换班',
    `成交。周四归你，周六归我——别忘了那周我上夜班，所以是 22:00 开始。\n\n还有巡逻车的空调还是坏的，自带水。\n\n- Mike`,
    3 * DAY + 5 * HOUR),
  seed(J, 'sent', JH, [R], '档案调取请求 - 案件 26-1187',
    `档案科你好，\n\n能否调取车牌 46EEK572 的完整记录，以及登记车主的全部前科？用于案件 26-1187（德尔佩罗高速追车）。\n\n谢谢，\nJ. Hale 警官 #1031`,
    2 * DAY + 6 * HOUR),
  seed(J, 'inbox', RECORDS, [J], '档案调取请求 #4471 已完成',
    `Hale 警官，\n\n你对案件 26-1187 的调取请求已完成。\n\n车牌 46EEK572 - 黑色 Ubermacht Sentinel XS\n登记车主：Trevor P.（地址在档，沙丘海岸）\n前科：3 次危险驾驶、1 次逃避执法、1 次未缴拖车费（Davis 大型商场停车场）\n\n完整材料在档案室 4 号抽屉。\n\n洛圣都警局档案科`,
    2 * DAY),
  seed(J, 'inbox', { email: 'newsletter@lifeinvader.com', name: 'LifeInvader' }, [J], '你的每周 LifeInvader 摘要：14 个新戳一戳',
    `嘿 Jessica！\n\n这是你本周在 LifeInvader 上错过的内容：\n\n- 14 个人戳了你\n- Lester Crest 看了你的资料（又看了）\n- 3 位好友在 Bahama Mamas West 打卡\n- 热门话题：“好麦坞标志其实闹鬼吗？”\n\n记住：隐私早过时了。多分享！\n\nLifeInvader - 自 2008 年起入侵你的生活。\n想退订？哈。`,
    1 * DAY + 4 * HOUR, { read: false }),
  seed(J, 'inbox', DAEMON, [J], '投递失败：邮件无法送达',
    `你的邮件无法送达以下收件人，因为该地址不存在：\n\nsgt.colins@lsmail.com\n\n原始主题：MDT 入门培训 - 周五行吗？`,
    1 * DAY + 1 * HOUR),
  seed(J, 'inbox', HR, [J], '需要处理：第四季度枪械复训',
    `Hale 警官，\n\n记录显示你的枪械资格将于 10/31 到期。复训场次安排在圆堡山靶场：\n\n  - 周二 10/13，09:00\n  - 周四 10/15，14:00\n  - 周六 10/17，10:00\n\n请回复你想参加的场次。截止日期前未完成复训的警官将被安排内勤。\n\n洛圣都市人事部`,
    3 * HOUR, { flagged: true }),
  seed(J, 'drafts', JH, [HR.email], '请假申请：10 月 18-20 日',
    `人事部你好，\n\n我想申请 10/18（周日）至 10/20（周二）的年假，共 3 天。Mike Rodriguez 已经答应`,
    90 * MIN),
  seed(J, 'inbox', MIKE, [J], '去 Bean Machine 吃午饭？',
    `1 点在好麦坞大道的 Bean Machine？上周你帮我顶了报告，我欠你一杯咖啡。\n\n要是来了警情，我们就打包带走。`,
    40 * MIN, { read: false }),
  seed(J, 'inbox', DISPATCH, [J, 'patrol.b@lsmail.com', MIKE.email], '布控：黑色 Sultan RS，车牌 46EEK572',
    `全体单位 - 注意布控\n\n车辆：黑色 Karin Sultan RS，车窗贴膜，改装尾翼\n车牌：46EEK572（可能已更换）\n最后目击：14:52 德尔佩罗高速北向，靠近码头出口\n涉嫌：持械抢劫 - 24/7 超市，Innocence Blvd\n\n车内人员：2 名男性，其中一人穿绿色连帽衫。认定为持械。切勿单独拦截 - 立即上报并等待增援。\n\n洛圣都警局调度`,
    12 * MIN, { read: false, flagged: true }),
  seed(J, 'bin', { email: 'warranty@autoexotics.com', name: 'Auto Exotics' }, [J], "我们一直在联系你，关于你汽车的延保",
    `尊敬的车主：\n\n这是关于你车辆延保的最终通知。请立即致电 1-800-AUTO-EXO，以免你的 Vapid Stanier 失去保障。\n\n（你的车是警用巡逻车。我们知道。还是请来电。）`,
    4 * DAY, { prevFolder: 'inbox' }),

  seed(R, 'inbox', HR, [R], '档案保留政策更新',
    `档案组：\n\n自 11 月 1 日起，事故报告须保留 7 年（原为 5 年）。请相应更新归档计划。\n\n洛圣都市人事部`,
    9 * DAY),
  seed(R, 'inbox', DISPATCH, [R], '事故报告 IR-26-3310 已归档',
    `事故报告 IR-26-3310（交通事故，阿尔塔街 / Las Lagunas Blvd）已由 1-ADAM-12 号车归档，可以进行编目。\n\n洛圣都警局调度`,
    3 * DAY, { read: false }),
  seed(R, 'inbox', JH, [R], '档案调取请求 - 案件 26-1187',
    `档案科你好，\n\n能否调取车牌 46EEK572 的完整记录，以及登记车主的全部前科？用于案件 26-1187（德尔佩罗高速追车）。\n\n谢谢，\nJ. Hale 警官 #1031`,
    2 * DAY + 6 * HOUR),
  seed(R, 'sent', RECORDS, [J], '档案调取请求 #4471 已完成',
    `Hale 警官，\n\n你对案件 26-1187 的调取请求已完成。\n\n（完整材料见 4 号抽屉）\n\n洛圣都警局档案科`,
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

const NOT_SIGNED_IN = '你未登录该邮箱。';

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
        '投递失败：邮件无法送达',
        `你的邮件无法送达以下收件人，因为该地址不存在：\n\n${failed.join('\n')}\n\n原始主题：${subject}`,
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
    deliver(MIKE, [JH.email], '1 点还来吗？', "我占了靠窗的桌子。还是老样子，还是你终于要试南瓜香料的 Liberty 了？\n\n- Mike", false);
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
    if (!r) return fail('该邮件已不存在。');
    r.read = true;
    return ok(shape(r, true));
  },

  'mail:send': p => {
    const from = mine(p.from);
    if (!from) return fail(NOT_SIGNED_IN);
    const to = recipients(p.to);
    if (!to) return fail(`请输入 1 到 ${MAX_RECIPIENTS} 个有效收件人地址。`);
    const [subject, body] = clip(p.subject, p.body);
    if (!subject && !body) return fail('请先填写主题或正文。');
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
    if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(user)) return fail('用户名需为 2-32 个字符：字母、数字、点、短划线和下划线。');
    const pw = p.password;
    if (typeof pw !== 'string' || pw.length < MIN_PASSWORD || pw.length > 64) return fail(`密码至少需要 ${MIN_PASSWORD} 个字符。`);
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || name.length > MAX_DISPLAY_NAME) return fail(`请输入显示名称（最多 ${MAX_DISPLAY_NAME} 个字符）。`);
    if (created >= MAX_CREATED) return fail(`你最多只能创建 ${MAX_CREATED} 个邮件账户。`);
    if (signedIn.size >= MAX_SIGNED_IN) return fail(`你最多只能同时登录 ${MAX_SIGNED_IN} 个账户。`);
    const email = `${user}@${DOMAIN}`;
    if (accounts[email]) return fail('该地址已被占用。');
    accounts[email] = { name, password: pw };
    created++;
    signedIn.add(email);
    return ok({ email });
  },

  'mail:signIn': p => {
    const email = normalize(p.email);
    if (!email || typeof p.password !== 'string') return fail('地址或密码不正确。');
    if (signedIn.size >= MAX_SIGNED_IN) return fail(`你最多只能同时登录 ${MAX_SIGNED_IN} 个账户。`);
    const acct = accounts[email];
    if (!acct || acct.password !== p.password) return fail('地址或密码不正确。');
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
