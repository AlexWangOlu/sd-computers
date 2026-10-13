import { isHttps } from '../model';

// What the live sites' endpoints answer (server/computers/web.lua), and the readers that turn a
// reply into it. Change a shape there, change it here. The readers are not about distrust of the
// server: a Lua table with nothing in it arrives as {} where a list was meant, a number can come
// as a string, and a page drawn from that should not have to care.

const obj = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const opt = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const pic = (v: unknown): string | undefined => (isHttps(v) ? v : undefined);
const pics = (v: unknown): string[] => list(v).filter(isHttps);

// ── Marketplace / Yellow Pages ─────────────────────────────────────────────────────────────

export type BoardKind = 'market' | 'pages';

export interface Ad {
  id: string;
  title: string;
  body: string;
  /** Marketplace only; none = "wanted". */
  price?: number;
  images: string[];
  number?: string;
  email?: string;
  /** As the phone words it: 'Today, 14:02'. */
  date: string;
  mine: boolean;
  /** Unix seconds a queued ad (made on the phone) goes up at. Only ever on the player's own. */
  publishAt?: number;
}

export interface BoardLimits {
  title: number;
  body: number;
  images: number;
  contact: number;
  perPlayer: number;
  price: number;
}

export interface Board {
  items: Ad[];
  limits: BoardLimits;
  /** The player's own phone number, when they have one: what a new ad's contact starts as. */
  number?: string;
}

export function asAd(raw: unknown): Ad {
  const a = obj(raw);
  return {
    id: str(a.id),
    title: str(a.title),
    body: str(a.body),
    price: typeof a.price === 'number' ? a.price : undefined,
    images: pics(a.images),
    number: opt(a.number),
    email: opt(a.email),
    date: str(a.date),
    mine: a.mine === true,
    publishAt: typeof a.publishAt === 'number' ? a.publishAt : undefined,
  };
}

export function asBoard(raw: unknown): Board {
  const d = obj(raw);
  const l = obj(d.limits);
  return {
    items: list(d.items).map(asAd).filter(a => a.id !== ''),
    limits: { title: num(l.title, 60), body: num(l.body, 500), images: num(l.images, 3), contact: num(l.contact, 20), perPlayer: num(l.perPlayer, 15), price: num(l.price, 999999999) },
    number: opt(d.number),
  };
}

// ── Weazel News ────────────────────────────────────────────────────────────────────────────

export interface Article {
  id: string;
  category: string;
  headline: string;
  dek: string;
  body: string[];
  author: string;
  /** As the phone words it: '38m', '2h'. */
  time: string;
  views: number;
  image?: string;
  featured: boolean;
  /** Unix seconds a waiting story goes out at (newsroom only). */
  publishAt?: number;
}

export interface NewsLimits {
  headline: number;
  dek: number;
  body: number;
  tickerLines: number;
  tickerLine: number;
}

export interface News {
  articles: Article[];
  ticker: string[];
  /** The player is Weazel staff, by the phone's own rule: the newsroom is theirs. */
  canManage: boolean;
  scheduled: Article[];
  categories: string[];
  limits: NewsLimits;
}

export function asArticle(raw: unknown): Article {
  const a = obj(raw);
  return {
    id: str(a.id),
    category: str(a.category),
    headline: str(a.headline),
    dek: str(a.dek),
    body: list(a.body).map(str).filter(p => p !== ''),
    author: str(a.author),
    time: str(a.time),
    views: num(a.views),
    image: pic(a.image),
    featured: a.featured === true,
    publishAt: typeof a.publishAt === 'number' ? a.publishAt : undefined,
  };
}

export function asNews(raw: unknown): News {
  const d = obj(raw);
  const l = obj(d.limits);
  return {
    articles: list(d.articles).map(asArticle).filter(a => a.id !== ''),
    ticker: list(d.ticker).map(str).filter(s => s !== ''),
    canManage: d.canManage === true,
    scheduled: list(d.scheduled).map(asArticle).filter(a => a.id !== ''),
    categories: list(d.categories).map(str).filter(s => s !== ''),
    limits: { headline: num(l.headline, 140), dek: num(l.dek, 240), body: num(l.body, 8000), tickerLines: num(l.tickerLines, 8), tickerLine: num(l.tickerLine, 200) },
  };
}

// ── Company directory ──────────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  location?: string;
  color?: string;
  emoji?: string;
  /** A number to ring them on, when the phone gives them one (911). */
  callNumber?: string;
  onDuty: boolean;
}

export function asDirectory(raw: unknown): { companies: Company[] } {
  return {
    companies: list(obj(raw).companies)
      .map((v): Company => {
        const c = obj(v);
        return { id: str(c.id), name: str(c.name), location: opt(c.location), color: opt(c.color), emoji: opt(c.emoji), callNumber: opt(c.callNumber), onDuty: c.onDuty === true };
      })
      .filter(c => c.id !== ''),
  };
}

// ── Squawk ─────────────────────────────────────────────────────────────────────────────────

export interface SquawkAuthor {
  name: string;
  handle: string;
  verified: boolean;
  /** 'blue' | 'gold' | 'grey' */
  badge?: string;
  avatar?: string;
}

export interface Squawk {
  id: string;
  author: SquawkAuthor;
  body: string;
  images: string[];
  /** ms */
  at: number;
  replies: number;
  reposts: number;
  likes: number;
  views: number;
  poll?: { total: number; ended: boolean; options: { label: string; votes: number }[] };
  repostedBy?: { name: string; handle: string };
}

export interface SquawkProfile extends SquawkAuthor {
  bio: string;
  joined: string;
  protected: boolean;
  banner?: string;
  following: number;
  followers: number;
}

const asAuthor = (raw: unknown): SquawkAuthor => {
  const a = obj(raw);
  return { name: str(a.name) || str(a.handle), handle: str(a.handle), verified: a.verified === true, badge: opt(a.badge), avatar: pic(a.avatar) };
};

export function asSquawk(raw: unknown): Squawk {
  const p = obj(raw);
  const poll = p.poll ? obj(p.poll) : null;
  const by = p.repostedBy ? obj(p.repostedBy) : null;
  return {
    id: str(p.id),
    author: asAuthor(p.author),
    body: str(p.body),
    images: pics(p.images),
    at: num(p.at),
    replies: num(p.replies),
    reposts: num(p.reposts),
    likes: num(p.likes),
    views: num(p.views),
    poll: poll ? { total: num(poll.total), ended: poll.ended === true, options: list(poll.options).map(o => ({ label: str(obj(o).label), votes: num(obj(o).votes) })) } : undefined,
    repostedBy: by ? { name: str(by.name) || str(by.handle), handle: str(by.handle) } : undefined,
  };
}

export interface SquawkFeed {
  posts: Squawk[];
  tags: { tag: string; count: number }[];
}

export function asSquawkFeed(raw: unknown): SquawkFeed {
  const d = obj(raw);
  return {
    posts: list(d.posts).map(asSquawk),
    tags: list(d.tags)
      .map(t => ({ tag: str(obj(t).tag), count: num(obj(t).count) }))
      .filter(t => t.tag !== ''),
  };
}

export function asSquawkProfile(raw: unknown): { profile: SquawkProfile; posts: Squawk[] } {
  const d = obj(raw);
  const p = obj(d.profile);
  return {
    profile: { ...asAuthor(p), bio: str(p.bio), joined: str(p.joined), protected: p.protected === true, banner: pic(p.banner), following: num(p.following), followers: num(p.followers) },
    posts: list(d.posts).map(asSquawk),
  };
}

// ── Laws and fines ─────────────────────────────────────────────────────────────────────────

export type OffenceClass = 'felony' | 'misdemeanor' | 'infraction';

export interface Offence {
  code: string;
  label: string;
  class: OffenceClass;
  months: number;
  fine: number;
  description: string;
}

export function asLaws(raw: unknown): { offences: Offence[] } {
  return {
    offences: list(obj(raw).offences).map((v): Offence => {
      const o = obj(v);
      const c = str(o.class);
      return { code: str(o.code), label: str(o.label), class: c === 'felony' || c === 'misdemeanor' ? c : 'infraction', months: num(o.months), fine: num(o.fine), description: str(o.description) };
    }),
  };
}

// ── Stock market ───────────────────────────────────────────────────────────────────────────

export interface Asset {
  symbol: string;
  name: string;
  kind: 'stock' | 'crypto';
  color?: string;
  price: number;
  /** Since the oldest point in `history`, as a fraction (0.02 = 2%). */
  change: number;
  /** Oldest first. */
  history: number[];
}

export function asStocks(raw: unknown): { assets: Asset[] } {
  return {
    assets: list(obj(raw).assets)
      .map((v): Asset => {
        const a = obj(v);
        return {
          symbol: str(a.symbol),
          name: str(a.name),
          kind: a.kind === 'crypto' ? 'crypto' : 'stock',
          color: opt(a.color),
          price: num(a.price),
          change: num(a.change),
          history: list(a.history).filter((n): n is number => typeof n === 'number'),
        };
      })
      .filter(a => a.symbol !== ''),
  };
}
