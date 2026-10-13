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
    { id: '41', title: 'Sultan RS, low miles', body: 'Garage kept, full service history. Two keys.\nNo swaps, no time wasters.', price: 48500, images: [img('sultan'), img('sultan2')], number: '5550147', date: 'Today, 14:02', mine: false },
    { id: '40', title: 'Mountain bike', body: 'Scorcher, barely ridden. Collect from Mirror Park.', price: 350, images: [img('bike')], number: '5550199', email: 'jess.rodriguez@lsmail.com', date: 'Today, 11:40', mine: !guest },
    { id: '39', title: 'Wanted: fishing rod', body: 'Looking for a decent rod and tackle box. Can pay cash today.', number: '5550123', date: 'Yesterday, 19:15', mine: false },
    { id: '38', title: 'Leather sofa', body: 'Three seater, brown. Small scratch on one arm. Buyer collects.', price: 0, images: [img('sofa')], email: 'dana.w@lsmail.com', date: 'Yesterday, 09:03', mine: false },
    { id: '37', title: 'Gaming PC', body: 'Runs everything. Selling because I never leave the garage anyway.', price: 1200, images: [img('pc'), img('pc2'), img('pc3')], number: '5550170', date: 'October 11th, 2026', mine: false },
    { id: '36', title: 'Garage clear-out next week', body: 'Tools, tyres, a workbench. Listing goes up Monday.', price: 100, number: '5550199', date: 'Today, 12:00', mine: !guest, publishAt: now() + 3 * 86400 },
  ],
  pages: [
    { id: '21', title: "Benny's - custom work, fair prices", body: 'Resprays, engine swaps, body kits. Open late most nights.\nAsk for Leon.', images: [img('garage')], number: '5550110', date: 'Today, 13:20', mine: false },
    { id: '20', title: 'Private security for events', body: 'Licensed, discreet, punctual. Weddings, openings, house parties.', number: '5550188', email: 'bookings@shieldls.com', date: 'Today, 08:45', mine: false },
    { id: '19', title: 'Guitar lessons, all levels', body: 'First lesson free. I come to you, anywhere in the city.', images: [img('guitar')], number: '5550199', date: 'Yesterday, 17:30', mine: !guest },
    { id: '18', title: 'Removals and man with a van', body: 'Single items to full house moves. Same day when I can.', number: '5550133', date: 'October 10th, 2026', mine: false },
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
let ticker = ['Del Perro pier reopens after storm damage', 'Traffic slow on the Olympic Freeway northbound', 'City council votes on parking charges tonight'];
let articles: Article[] = [
  {
    id: '55',
    category: 'Local',
    headline: 'Pier reopens to crowds after a month of repairs',
    dek: 'Stallholders say the first weekend back was their busiest of the year.',
    body: [
      'The Del Perro pier opened its gates again on Saturday, four weeks after storm damage closed the boardwalk and most of the rides.',
      'Stallholders reported queues from mid-morning. "We were not sure anybody would remember us," one said. "They remembered."',
      'The city says the Ferris wheel will follow by the end of the month, once its inspection is signed off.',
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
    headline: 'Three arrested after chase ends in Strawberry',
    dek: 'Police say a stolen car was followed for eleven minutes before it was stopped.',
    body: ['Three people are in custody after a pursuit through the south of the city on Friday night.', 'Nobody was hurt. The car, reported stolen that afternoon, was recovered.'],
    author: 'Tom Okafor',
    time: '2h',
    views: 968,
    image: img('chase', 900, 520),
    featured: false,
  },
  {
    id: '53',
    category: 'Business',
    headline: 'New garage brings twenty jobs to La Mesa',
    dek: '',
    body: ['A second branch of a well-known custom shop opens next week, and it is hiring.'],
    author: 'Maya Chen',
    time: '5h',
    views: 233,
    featured: false,
  },
  {
    id: '52',
    category: 'Sports',
    headline: 'Street race organisers promise "a clean season"',
    dek: 'The first sanctioned meet is set for the docks.',
    body: ['Organisers say marshals and a closed course will keep this year’s events on the right side of the law.'],
    author: 'Ricky Vale',
    time: '1d',
    views: 1502,
    image: img('race', 900, 520),
    featured: false,
  },
  {
    id: '51',
    category: 'Weather',
    headline: 'Dry week ahead, fog on the coast by Thursday',
    dek: '',
    body: ['Clear skies through midweek. Drivers on the Great Ocean Highway should expect poor visibility on Thursday morning.'],
    author: 'Weazel Weather',
    time: '1d',
    views: 180,
    featured: false,
  },
];
let scheduled: Article[] = [
  { id: '56', category: 'Politics', headline: 'Council to vote on late-night parking charges', dek: 'Embargoed until the meeting closes.', body: ['Draft.'], author: 'Tom Okafor', time: 'now', views: 0, featured: false, publishAt: now() + 2 * 3600 },
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
  { id: 'a1', author: people.maya, body: 'The pier is OPEN. Go eat something fried. #delperro #lossantos', images: [img('pier2', 800, 500)], at: ms(12), replies: 14, reposts: 22, likes: 180, views: 2400 },
  { id: 'a2', author: people.lspd, body: 'Road closure on Strawberry Ave until 6pm. Use Carson instead. #traffic', at: ms(55), replies: 3, reposts: 41, likes: 60, views: 5100 },
  { id: 'a3', author: people.leon, body: 'Two slots left this week for resprays. First come first served, ask for me. @mayachen you still owe me a write-up', at: ms(130), replies: 5, reposts: 1, likes: 17, views: 640 },
  {
    id: 'a4',
    author: people.dana,
    body: 'Best taco in the city?',
    at: ms(260),
    replies: 31,
    reposts: 2,
    likes: 44,
    views: 1900,
    poll: { total: 120, ended: false, options: [{ label: 'The truck on Vespucci', votes: 66 }, { label: 'Cluckin’ Bell (be honest)', votes: 30 }, { label: 'My own kitchen', votes: 24 }] },
  },
  { id: 'a1', author: people.maya, body: 'The pier is OPEN. Go eat something fried. #delperro #lossantos', images: [img('pier2', 800, 500)], at: ms(12), replies: 14, reposts: 22, likes: 180, views: 2400, repostedBy: { name: 'LSPD', handle: 'lspd' } },
];
const tags = [
  { tag: '#lossantos', count: 48 },
  { tag: '#delperro', count: 21 },
  { tag: '#traffic', count: 9 },
];

// ── Laws / stocks / directory ──────────────────────────────────────────────────────────────

const offences = [
  { code: 'PC 101', label: 'Murder in the First Degree', class: 'felony', months: 300, fine: 50000, description: 'The unlawful, premeditated killing of another person.' },
  { code: 'PC 110', label: 'Armed Robbery', class: 'felony', months: 60, fine: 12000, description: 'Taking property from another by force or fear while armed with a weapon.' },
  { code: 'PC 118', label: 'Grand Theft Auto', class: 'felony', months: 30, fine: 6000, description: 'Taking a motor vehicle that belongs to another without their consent.' },
  { code: 'PC 204', label: 'Petty Theft', class: 'misdemeanor', months: 5, fine: 800, description: 'Taking property worth less than the grand theft threshold.' },
  { code: 'PC 211', label: 'Resisting Arrest', class: 'misdemeanor', months: 10, fine: 1500, description: 'Wilfully resisting, delaying or obstructing an officer.' },
  { code: 'PC 230', label: 'Disorderly Conduct', class: 'misdemeanor', months: 0, fine: 600, description: 'Fighting, causing excessive noise or using offensive words in public.' },
  { code: 'VC 301', label: 'Speeding', class: 'infraction', months: 0, fine: 250, description: 'Driving faster than the posted limit.' },
  { code: 'VC 305', label: 'Running a Red Light', class: 'infraction', months: 0, fine: 300, description: '' },
  { code: 'VC 312', label: 'Illegal Parking', class: 'infraction', months: 0, fine: 120, description: 'Leaving a vehicle where stopping is not allowed.' },
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
  { id: 'police', name: 'Los Santos Police Department', location: 'Mission Row', color: '#1e63d6', emoji: '🚓', callNumber: '911', onDuty: true },
  { id: 'ambulance', name: 'Emergency Medical Services', location: 'Pillbox Hill', color: '#e03131', emoji: '🚑', callNumber: '912', onDuty: true },
  { id: 'mechanic', name: 'LS Customs', location: 'Burton', color: '#f08c00', emoji: '🔧', onDuty: false },
  { id: 'taxi', name: 'Downtown Cab Co.', location: 'East Vinewood', color: '#fab005', emoji: '🚕', onDuty: false },
];

// ── Handlers ───────────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const handlers: Record<string, MockHandler> = {
  'web:ads': ({ board }) => (boards[str(board)] ? ok({ items: boards[str(board)].map(a => ({ ...a })), limits: limits(str(board)), number: '5550199' }) : fail('That is not available right now.')),

  'web:ads:save': p => {
    const list = boards[str(p.board)];
    if (!list) return fail('That is not available right now.');
    const title = str(p.title).trim();
    const body = str(p.body).trim();
    if (!title) return fail('Title required');
    if (!body) return fail('Description required');
    if (!str(p.number) && !str(p.email)) return fail('Add a phone number or email');
    const fields = { title, body, price: typeof p.price === 'number' ? p.price : undefined, images: Array.isArray(p.images) ? (p.images as string[]) : [], number: str(p.number) || undefined, email: str(p.email) || undefined };
    if (p.id !== undefined && p.id !== null) {
      const at = list.findIndex(a => a.id === p.id && a.mine);
      if (at < 0) return fail('Not your post');
      list[at] = { ...list[at], ...fields };
      return ok({ item: { ...list[at] } });
    }
    if (list.filter(a => a.mine).length >= 15) return fail('You have too many active posts');
    const item: Ad = { id: String(++adSeq), ...fields, date: 'Today, now', mine: true };
    list.unshift(item);
    return ok({ item: { ...item } });
  },

  'web:ads:delete': p => {
    const list = boards[str(p.board)];
    const at = list ? list.findIndex(a => a.id === p.id && a.mine) : -1;
    if (!list || at < 0) return fail('Not your post');
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
    if (!a) return fail('Article not found');
    a.views += 1;
    return ok({ id, views: a.views });
  },

  'web:news:save': p => {
    if (guest) return fail('Only Weazel News staff can publish');
    if (!CATEGORIES.includes(str(p.category))) return fail('Pick a valid category');
    const headline = str(p.headline).trim();
    if (!headline) return fail('Headline is required');
    const fields = { category: str(p.category), headline, dek: str(p.dek).trim(), body: str(p.body).split(/\n\s*\n/).map(s => s.trim()).filter(Boolean), image: str(p.image) || undefined, featured: p.featured === true };
    const publishAt = typeof p.publishAt === 'number' ? p.publishAt : undefined;
    if (p.id !== undefined && p.id !== null) {
      const live = articles.find(a => a.id === p.id);
      const queued = scheduled.find(a => a.id === p.id);
      if (live) {
        if (publishAt) return fail('That story is already published');
        Object.assign(live, fields);
        if (fields.featured) articles.forEach(a => (a.featured = a === live));
        return ok({ article: { ...live } });
      }
      if (!queued) return fail('Article not found');
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
    if (!a) return fail('That story is already published');
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
    if (guest) return fail('Only Weazel News staff can edit this');
    ticker = (Array.isArray(lines) ? (lines as unknown[]) : []).filter((l): l is string => typeof l === 'string' && l.trim() !== '').slice(0, 8);
    return ok({ ticker: [...ticker] });
  },

  'web:directory': () => ok({ companies }),
  'web:directory:message': ({ body }) => (str(body).trim() ? ok() : fail('Invalid request.')),

  'web:squawk': p => {
    if (p.view === 'tag') {
      const tag = `#${str(p.tag).toLowerCase()}`;
      return ok({ posts: squawks.filter(s => !('repostedBy' in s) && s.body.toLowerCase().includes(tag)) });
    }
    if (p.view === 'profile') {
      const who = Object.values(people).find(x => x.handle === str(p.handle).toLowerCase());
      if (!who) return fail('Profile not found');
      return ok({
        profile: { ...who, bio: who.handle === 'mayachen' ? 'Reporter at Weazel News. Tips welcome, opinions my own.' : '', joined: 'March 2026', protected: who.handle === 'dana_w', banner: who.handle === 'mayachen' ? img('banner', 900, 260) : undefined, following: 182, followers: 4310 },
        posts: who.handle === 'dana_w' ? [] : squawks.filter(s => s.author.handle === who.handle && !('repostedBy' in s)),
      });
    }
    return ok({ posts: squawks, tags });
  },

  'web:laws': () => ok({ offences }),
  'web:stocks': () => ok({ assets }),
};

export default handlers;
