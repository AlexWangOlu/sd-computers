import type { MockHandler } from './index';
import { fail, ok } from './index';

// Browser mocks for the live sites (server/computers/web.lua): what the phone would answer, kept
// here in memory so an ad can be put up, a story filed and the breaking line changed without a
// game. The shapes are the ones the server sends. In dev the player is Weazel staff (the newsroom
// is there to be seen) and owns a couple of the ads. ?web=guest makes them neither.

const guest = new URLSearchParams(window.location.search).get('web') === 'guest';
const img = (seed: string, w = 640, h = 420): string => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const now = (): number => Math.floor(Date.now() / 1000);

// ── Marketplace / Yellow Pages ─────────────────────────────────────────────────────────────

interface Ad {
  id: string;
  title: string;
  body: string;
  price?: number;
  images?: string[];
  number?: string;
  email?: string;
  date: string;
  mine: boolean;
  publishAt?: number;
}

let adSeq = 100;
const boards: Record<string, Ad[]> = {
  market: [
    { id: '41', title: 'Sultan RS，里程很低', body: '一直停在车库，保养记录齐全。两把钥匙。\n不换车，也别来浪费彼此时间。', price: 48500, images: [img('sultan'), img('sultan2')], number: '5550147', date: '今天 14:02', mine: false },
    { id: '40', title: '山地自行车', body: 'Scorcher，几乎没怎么骑过。到镜湖公园自取。', price: 350, images: [img('bike')], number: '5550199', email: 'jess.rodriguez@lsmail.com', date: '今天 11:40', mine: !guest },
    { id: '39', title: '求购：钓鱼竿', body: '想收一根像样的鱼竿和一个钓具箱。今天可以现金付款。', number: '5550123', date: '昨天 19:15', mine: false },
    { id: '38', title: '真皮沙发', body: '三人座，棕色。一侧扶手有一道小划痕。买家自取。', price: 0, images: [img('sofa')], email: 'dana.w@lsmail.com', date: '昨天 09:03', mine: false },
    { id: '37', title: '游戏电脑', body: '什么都能跑。卖是因为我反正从不离开车库。', price: 1200, images: [img('pc'), img('pc2'), img('pc3')], number: '5550170', date: '2026 年 10 月 11 日', mine: false },
    { id: '36', title: '下周车库清仓', body: '工具、轮胎、一张工作台。周一上架。', price: 100, number: '5550199', date: '今天 12:00', mine: !guest, publishAt: now() + 3 * 86400 },
  ],
  pages: [
    { id: '21', title: "Benny's - 改车活儿，价格公道", body: '喷漆、换发动机、外观套件。多数晚上营业到很晚。\n找 Leon。', images: [img('garage')], number: '5550110', date: '今天 13:20', mine: false },
    { id: '20', title: '活动私人安保', body: '持证、低调、准时。婚礼、开业、家庭派对都接。', number: '5550188', email: 'bookings@shieldls.com', date: '今天 08:45', mine: false },
    { id: '19', title: '吉他课，零基础到进阶', body: '第一节课免费。我上门，城里哪都行。', images: [img('guitar')], number: '5550199', date: '昨天 17:30', mine: !guest },
    { id: '18', title: '搬家，连人带车', body: '单件搬运到整屋搬家都做。能当天就当天。', number: '5550133', date: '2026 年 10 月 10 日', mine: false },
  ],
};

const limits = (board: string) => ({ title: 60, body: 500, images: 3, contact: 20, perPlayer: 15, ...(board === 'market' ? { price: 999999999 } : {}) });

// ── Weazel News ────────────────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  category: string;
  headline: string;
  dek: string;
  body: string[];
  author: string;
  time: string;
  views: number;
  image?: string;
  featured: boolean;
  publishAt?: number;
}

let newsSeq = 60;
let ticker = ['德尔佩罗码头风暴受损后重新开放', '奥林匹克高速北向车流缓慢', '市议会今晚就停车收费表决'];
let articles: Article[] = [
  {
    id: '55',
    category: 'Local',
    headline: '码头维修一个月后重新开放，人潮涌来',
    dek: '摊主们说，重新开张的第一个周末是全年最忙的。',
    body: [
      '德尔佩罗码头周六重新开门，此时距离风暴损毁木板路和大部分游乐设施已经过去四周。',
      '摊主们说上午刚过半就排起了队。“我们本来还担心没人记得我们了，”一位摊主说，“他们记得。”',
      '市政府表示，摩天轮将在本月底前恢复运行，只等检验签字。',
    ],
    author: 'Maya Chen',
    time: '38m',
    views: 412,
    image: img('pier', 900, 520),
    featured: true,
  },
  {
    id: '54',
    category: 'Crime',
    headline: '追逐在斯卓贝里结束，三人被捕',
    dek: '警方称一辆被盗车辆被跟踪 11 分钟后被截停。',
    body: ['周五夜里，三人在城南一场追车后落网。', '无人受伤。那辆车当天下午报失，现已找回。'],
    author: 'Tom Okafor',
    time: '2h',
    views: 968,
    image: img('chase', 900, 520),
    featured: false,
  },
  {
    id: '53',
    category: 'Business',
    headline: '新修理厂为拉梅萨带来二十个岗位',
    dek: '',
    body: ['一家知名改装店的第二家分店下周开业，正在招人。'],
    author: 'Maya Chen',
    time: '5h',
    views: 233,
    featured: false,
  },
  {
    id: '52',
    category: 'Sports',
    headline: '街头赛车组织方承诺“一个干净的赛季”',
    dek: '首场获批聚会定在码头。',
    body: ['组织方表示，靠引导员和封闭赛道，今年的活动会走在法律这一边。'],
    author: 'Ricky Vale',
    time: '1d',
    views: 1502,
    image: img('race', 900, 520),
    featured: false,
  },
  {
    id: '51',
    category: 'Weather',
    headline: '本周以晴为主，周四沿海起雾',
    dek: '',
    body: ['周中前后天空晴朗。周四早上走大海洋公路的司机要留意能见度很低。'],
    author: '威泽尔天气',
    time: '1d',
    views: 180,
    featured: false,
  },
];
let scheduled: Article[] = [
  { id: '56', category: 'Politics', headline: '市议会将就深夜停车收费表决', dek: '会议结束前禁止发布。', body: ['草稿。'], author: 'Tom Okafor', time: 'now', views: 0, featured: false, publishAt: now() + 2 * 3600 },
];
const CATEGORIES = ['Local', 'Crime', 'Politics', 'Business', 'Sports', 'Entertainment', 'Tech', 'Weather'];

// ── Squawk ─────────────────────────────────────────────────────────────────────────────────

const people = {
  maya: { name: 'Maya Chen', handle: 'mayachen', verified: true, badge: 'blue', avatar: img('maya', 96, 96) },
  lspd: { name: 'LSPD', handle: 'lspd', verified: true, badge: 'grey' },
  leon: { name: 'Leon at Benny’s', handle: 'bennys_leon', verified: false },
  dana: { name: 'dana', handle: 'dana_w', verified: false, avatar: img('dana', 96, 96) },
};
const ms = (minutesAgo: number): number => Date.now() - minutesAgo * 60000;
const squawks = [
  { id: 'a1', author: people.maya, body: '码头开了！去吃点油炸的吧。#delperro #lossantos', images: [img('pier2', 800, 500)], at: ms(12), replies: 14, reposts: 22, likes: 180, views: 2400 },
  { id: 'a2', author: people.lspd, body: '斯卓贝里大道封路至 18:00，请改走 Carson。#traffic', at: ms(55), replies: 3, reposts: 41, likes: 60, views: 5100 },
  { id: 'a3', author: people.leon, body: '本周喷漆还剩两个名额。先到先得，找我。@mayachen 你还欠我一篇报道', at: ms(130), replies: 5, reposts: 1, likes: 17, views: 640 },
  {
    id: 'a4',
    author: people.dana,
    body: '城里最好吃的塔可在哪？',
    at: ms(260),
    replies: 31,
    reposts: 2,
    likes: 44,
    views: 1900,
    poll: { total: 120, ended: false, options: [{ label: '维斯普奇那辆餐车', votes: 66 }, { label: 'Cluckin’ Bell（说实话）', votes: 30 }, { label: '我家厨房', votes: 24 }] },
  },
  { id: 'a1', author: people.maya, body: '码头开了！去吃点油炸的吧。#delperro #lossantos', images: [img('pier2', 800, 500)], at: ms(12), replies: 14, reposts: 22, likes: 180, views: 2400, repostedBy: { name: 'LSPD', handle: 'lspd' } },
];
const tags = [
  { tag: '#lossantos', count: 48 },
  { tag: '#delperro', count: 21 },
  { tag: '#traffic', count: 9 },
];

// ── Laws / stocks / directory ──────────────────────────────────────────────────────────────

const offences = [
  { code: 'PC 101', label: '一级谋杀', class: 'felony', months: 300, fine: 50000, description: '非法且有预谋地杀害他人。' },
  { code: 'PC 110', label: '持械抢劫', class: 'felony', months: 60, fine: 12000, description: '持械以暴力或胁迫夺取他人财物。' },
  { code: 'PC 118', label: '盗窃机动车', class: 'felony', months: 30, fine: 6000, description: '未经车主同意开走他人机动车。' },
  { code: 'PC 204', label: '轻微盗窃', class: 'misdemeanor', months: 5, fine: 800, description: '窃取价值低于重窃罪标准的财物。' },
  { code: 'PC 211', label: '抗拒逮捕', class: 'misdemeanor', months: 10, fine: 1500, description: '故意抗拒、拖延或妨碍执法人员。' },
  { code: 'PC 230', label: '妨害治安', class: 'misdemeanor', months: 0, fine: 600, description: '在公共场所斗殴、制造过大噪音或使用冒犯性言语。' },
  { code: 'VC 301', label: '超速', class: 'infraction', months: 0, fine: 250, description: '以超过限速标志的速度行驶。' },
  { code: 'VC 305', label: '闯红灯', class: 'infraction', months: 0, fine: 300, description: '' },
  { code: 'VC 312', label: '违章停车', class: 'infraction', months: 0, fine: 120, description: '在禁止停车处停放车辆。' },
];

const walk = (base: number, seed: number, drift: number): number[] => {
  const out: number[] = [];
  let p = base;
  for (let i = 0; i < 48; i++) {
    p = Math.max(base * 0.5, p * (1 + drift + Math.sin(i * 0.7 + seed) * 0.012 + Math.cos(i * 1.9 + seed * 3) * 0.008));
    out.push(Number(p.toFixed(4)));
  }
  return out;
};
const asset = (symbol: string, name: string, kind: string, color: string, base: number, seed: number, drift: number) => {
  const history = walk(base, seed, drift);
  const price = history[history.length - 1];
  return { symbol, name, kind, color, price, change: (price - history[0]) / history[0], history };
};
const assets = [
  asset('MAZE', 'Maze Bank', 'stock', '#b3261e', 412.5, 1, 0.002),
  asset('LIFE', 'Lifeinvader', 'stock', '#d93025', 88.2, 2, -0.003),
  asset('FLEE', 'Fleeca', 'stock', '#1e8e3e', 61.75, 3, 0.001),
  asset('GOPO', 'GoPostal', 'stock', '#b06000', 24.1, 4, -0.001),
  asset('AUGY', 'Augury Insurance', 'stock', '#1967d2', 133.0, 5, 0.0015),
  asset('BTC', 'Bitcoin', 'crypto', '#f7931a', 61250, 6, 0.003),
  asset('ETH', 'Ethereum', 'crypto', '#627eea', 3120, 7, -0.002),
  asset('KFLM', 'Kifflom Coin', 'crypto', '#00a8a8', 0.0421, 8, 0.004),
];

const companies = [
  { id: 'police', name: '洛圣都警察局', location: '米申罗', color: '#1e63d6', emoji: '🚓', callNumber: '911', onDuty: true },
  { id: 'ambulance', name: '紧急医疗服务', location: '圆堡山', color: '#e03131', emoji: '🚑', callNumber: '912', onDuty: true },
  { id: 'mechanic', name: 'LS Customs', location: '伯顿', color: '#f08c00', emoji: '🔧', onDuty: false },
  { id: 'taxi', name: '市中心出租车公司', location: '东好麦坞', color: '#fab005', emoji: '🚕', onDuty: false },
];

// ── Handlers ───────────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const handlers: Record<string, MockHandler> = {
  'web:ads': ({ board }) => (boards[str(board)] ? ok({ items: boards[str(board)].map(a => ({ ...a })), limits: limits(str(board)), number: '5550199' }) : fail('该功能当前不可用。')),

  'web:ads:save': p => {
    const list = boards[str(p.board)];
    if (!list) return fail('该功能当前不可用。');
    const title = str(p.title).trim();
    const body = str(p.body).trim();
    if (!title) return fail('请填写标题');
    if (!body) return fail('请填写描述');
    if (!str(p.number) && !str(p.email)) return fail('请填写手机号码或邮箱');
    const fields = { title, body, price: typeof p.price === 'number' ? p.price : undefined, images: Array.isArray(p.images) ? (p.images as string[]) : [], number: str(p.number) || undefined, email: str(p.email) || undefined };
    if (p.id !== undefined && p.id !== null) {
      const at = list.findIndex(a => a.id === p.id && a.mine);
      if (at < 0) return fail('这不是你发布的内容');
      list[at] = { ...list[at], ...fields };
      return ok({ item: { ...list[at] } });
    }
    if (list.filter(a => a.mine).length >= 15) return fail('你发布的内容太多了');
    const item: Ad = { id: String(++adSeq), ...fields, date: '今天，刚刚', mine: true };
    list.unshift(item);
    return ok({ item: { ...item } });
  },

  'web:ads:delete': p => {
    const list = boards[str(p.board)];
    const at = list ? list.findIndex(a => a.id === p.id && a.mine) : -1;
    if (!list || at < 0) return fail('这不是你发布的内容');
    list.splice(at, 1);
    return ok({ id: p.id });
  },

  'web:news': () =>
    ok({
      articles: articles.map(a => ({ ...a })),
      ticker: [...ticker],
      canManage: !guest,
      scheduled: guest ? [] : scheduled.map(a => ({ ...a })),
      categories: guest ? undefined : CATEGORIES,
      limits: guest ? undefined : { headline: 140, dek: 240, body: 8000, tickerLines: 8, tickerLine: 200 },
    }),

  'web:news:view': ({ id }) => {
    const a = articles.find(x => x.id === id);
    if (!a) return fail('找不到这篇报道');
    a.views += 1;
    return ok({ id, views: a.views });
  },

  'web:news:save': p => {
    if (guest) return fail('只有威泽尔新闻员工才能发布');
    if (!CATEGORIES.includes(str(p.category))) return fail('请选择有效的版面');
    const headline = str(p.headline).trim();
    if (!headline) return fail('请填写标题');
    const fields = { category: str(p.category), headline, dek: str(p.dek).trim(), body: str(p.body).split(/\n\s*\n/).map(s => s.trim()).filter(Boolean), image: str(p.image) || undefined, featured: p.featured === true };
    const publishAt = typeof p.publishAt === 'number' ? p.publishAt : undefined;
    if (p.id !== undefined && p.id !== null) {
      const live = articles.find(a => a.id === p.id);
      const queued = scheduled.find(a => a.id === p.id);
      if (live) {
        if (publishAt) return fail('这篇报道已经发布了');
        Object.assign(live, fields);
        if (fields.featured) articles.forEach(a => (a.featured = a === live));
        return ok({ article: { ...live } });
      }
      if (!queued) return fail('找不到这篇报道');
      Object.assign(queued, fields);
      if (publishAt) {
        queued.publishAt = publishAt;
        return ok({ article: { ...queued } });
      }
      scheduled = scheduled.filter(a => a !== queued);
      queued.publishAt = undefined;
      articles.unshift(queued);
      return ok({ article: { ...queued } });
    }
    const a: Article = { id: String(++newsSeq), ...fields, author: 'Jessica Hale', time: 'now', views: 0, publishAt };
    if (publishAt) scheduled.push(a);
    else {
      if (a.featured) articles.forEach(x => (x.featured = false));
      articles.unshift(a);
    }
    return ok({ article: { ...a } });
  },

  'web:news:publish': ({ id }) => {
    const a = scheduled.find(x => x.id === id);
    if (!a) return fail('这篇报道已经发布了');
    scheduled = scheduled.filter(x => x !== a);
    a.publishAt = undefined;
    articles.unshift(a);
    return ok({ article: { ...a } });
  },

  'web:news:delete': ({ id }) => {
    articles = articles.filter(a => a.id !== id);
    scheduled = scheduled.filter(a => a.id !== id);
    return ok({ id });
  },

  'web:news:ticker': ({ lines }) => {
    if (guest) return fail('只有威泽尔新闻员工才能修改');
    ticker = (Array.isArray(lines) ? (lines as unknown[]) : []).filter((l): l is string => typeof l === 'string' && l.trim() !== '').slice(0, 8);
    return ok({ ticker: [...ticker] });
  },

  'web:directory': () => ok({ companies }),
  'web:directory:message': ({ body }) => (str(body).trim() ? ok() : fail('无效请求。')),

  'web:squawk': p => {
    if (p.view === 'tag') {
      const tag = `#${str(p.tag).toLowerCase()}`;
      return ok({ posts: squawks.filter(s => !('repostedBy' in s) && s.body.toLowerCase().includes(tag)) });
    }
    if (p.view === 'profile') {
      const who = Object.values(people).find(x => x.handle === str(p.handle).toLowerCase());
      if (!who) return fail('找不到该账号');
      return ok({
        profile: { ...who, bio: who.handle === 'mayachen' ? '威泽尔新闻记者。欢迎爆料，观点仅代表本人。' : '', joined: '2026 年 3 月', protected: who.handle === 'dana_w', banner: who.handle === 'mayachen' ? img('banner', 900, 260) : undefined, following: 182, followers: 4310 },
        posts: who.handle === 'dana_w' ? [] : squawks.filter(s => s.author.handle === who.handle && !('repostedBy' in s)),
      });
    }
    return ok({ posts: squawks, tags });
  },

  'web:laws': () => ok({ offences }),
  'web:stocks': () => ok({ assets }),
};

export default handlers;
