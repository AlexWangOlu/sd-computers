import { t } from '@/i18n';
import type { Block, Network, NoticeKind, Site, SiteLink, Tab, View } from './types';

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** The built-in start page's address. No site can have it (the server leaves one out that tries). */
export const HOME = 'home';
/** Tabs one window keeps: past this the strip stops offering another. */
export const MAX_TABS = 8;
/** Pages one tab remembers for Back. */
const MAX_HISTORY = 50;
const MAX_ADDRESS = 200;

/**
 * An address the way the network compares them: lower case, no scheme, no 'www.', no trailing
 * slash. The server does the same to the config's addresses (server/computers/browser.lua
 * address()) - change one, change both. Typing 'HTTPS://City.gov/' therefore finds 'city.gov', and
 * typing a real URL finds nothing: what is left is only ever looked up in the network's own list.
 */
export function normalizeAddress(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .slice(0, MAX_ADDRESS);
}

/**
 * The one test a real URL passes before it gets near an <iframe> or an <img>. The server applied
 * it already; this is the same check again at the last step.
 */
export const isHttps = (v: unknown): v is string => typeof v === 'string' && /^https:\/\/[^\s/]/i.test(v) && !/\s/.test(v);

const obj = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);

const KINDS: NoticeKind[] = ['info', 'success', 'warning', 'error'];

function asBlock(v: unknown): Block | null {
  const b = obj(v);
  if (!b) return null;
  const type = b.type;

  if (type === 'heading' || type === 'subheading' || type === 'text') {
    const text = str(b.text);
    return text ? { type, text } : null;
  }
  if (type === 'list') {
    const items = arr(b.items).filter((x): x is string => typeof x === 'string');
    return items.length ? { type, items } : null;
  }
  if (type === 'notice') {
    const text = str(b.text);
    const kind = KINDS.find(k => k === b.kind) ?? 'info';
    return text ? { type, kind, title: str(b.title), text } : null;
  }
  if (type === 'facts') {
    const rows = arr(b.rows).flatMap(r => {
      const label = str(obj(r)?.label);
      const value = str(obj(r)?.value);
      return label && value ? [{ label, value }] : [];
    });
    return rows.length ? { type, rows } : null;
  }
  if (type === 'links') {
    const items = arr(b.items).flatMap((l): SiteLink[] => {
      const o = obj(l);
      const to = typeof o?.to === 'string' ? normalizeAddress(o.to) : '';
      return to ? [{ to, label: str(o?.label), note: str(o?.note) }] : [];
    });
    return items.length ? { type, items } : null;
  }
  if (type === 'image') return isHttps(b.src) ? { type, src: b.src, caption: str(b.caption) } : null;
  return null;
}

function asSite(v: unknown): Site | null {
  const s = obj(v);
  const address = typeof s?.address === 'string' ? normalizeAddress(s.address) : '';
  const title = str(s?.title);
  if (!s || !address || address === HOME || !title) return null;

  const base = { address, title: title.trim(), bookmark: s.bookmark === true };
  if (s.url !== undefined && s.url !== null) return isHttps(s.url) ? { ...base, url: s.url } : null;
  // An empty Lua table can arrive as {} instead of []: either way it is a page with nothing on it.
  if (obj(s.blocks)) return { ...base, blocks: arr(s.blocks).map(asBlock).filter((b): b is Block => b !== null) };
  return null;
}

/** `browser:sites` -> the network. Anything the reply holds that is not a site is dropped. */
export function asNetwork(data: unknown): Network {
  const d = obj(data) ?? {};
  const sites: Site[] = [];
  const byAddress = new Map<string, Site>();
  for (const raw of arr(d.sites)) {
    const s = asSite(raw);
    if (!s || byAddress.has(s.address)) continue;
    byAddress.set(s.address, s);
    sites.push(s);
  }
  const home = typeof d.home === 'string' ? normalizeAddress(d.home) : HOME;
  return { home: byAddress.has(home) ? home : HOME, sites, byAddress };
}

/** What an address is on this network. A frame's URL can only come from here: out of the list. */
export function resolve(address: string, net: Network): View {
  if (address === HOME) return { kind: 'home' };
  const site = net.byAddress.get(address);
  if (!site) return { kind: 'missing', address };
  if (site.url) return { kind: 'frame', site, url: site.url };
  return { kind: 'page', site, blocks: site.blocks ?? [] };
}

/** What a tab (and the window's own title strip) calls a page. */
export function viewTitle(view: View): string {
  if (view.kind === 'home') return t('ui.browser.start_page');
  return view.kind === 'missing' ? view.address : view.site.title;
}

/** Sites whose title or address has `query` in it; the ones that start with it come first. */
export function searchSites(sites: Site[], query: string): Site[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const first: Site[] = [];
  const rest: Site[] = [];
  for (const s of sites) {
    const title = s.title.toLowerCase();
    if (title.startsWith(q) || s.address.startsWith(q)) first.push(s);
    else if (title.includes(q) || s.address.includes(q)) rest.push(s);
  }
  return [...first, ...rest];
}

/** What somebody who typed an address the network does not have may have meant. */
export function similarSites(net: Network, address: string, max = 4): Site[] {
  const host = address.split('/')[0];
  const sameHost = net.sites.filter(s => s.address === host || s.address.startsWith(`${host}/`));
  const out = new Set<Site>([...sameHost, ...searchSites(net.sites, address), ...searchSites(net.sites, host)]);
  return [...out].slice(0, max);
}

/** The nearest page above a sub-page ('city.gov/permits' -> 'city.gov'), when the network has one. */
export function parentOf(address: string, net: Network): Site | null {
  let a = address;
  for (;;) {
    const cut = a.lastIndexOf('/');
    if (cut <= 0) return null;
    a = a.slice(0, cut);
    const site = net.byAddress.get(a);
    if (site) return site;
  }
}

/** A site has no icon of its own: the first letter of its name stands in for one. */
export const monogram = (title: string): string => (title.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();

/** win.props.address: another app (or a relaunch) asking for a page. */
export function launchAddress(props: Record<string, unknown> | undefined): string | null {
  return typeof props?.address === 'string' ? normalizeAddress(props.address) || null : null;
}

// ── Tabs ───────────────────────────────────────────────────────────────────────────────────

let tabSeq = 0;

export const makeTab = (address: string): Tab => ({ key: `tab${++tabSeq}`, stack: [address], at: 0, nonce: 0 });

export const currentAddress = (tab: Tab): string => tab.stack[tab.at];

/** Go somewhere new: what was ahead of this page (Forward) is dropped, like in any browser. */
export function visit(tab: Tab, address: string): Tab {
  if (address === currentAddress(tab)) return { ...tab, nonce: tab.nonce + 1 };
  const stack = [...tab.stack.slice(0, tab.at + 1), address].slice(-MAX_HISTORY);
  return { ...tab, stack, at: stack.length - 1, nonce: 0 };
}

/** Back (-1) or Forward (+1), as far as the tab's history goes. */
export function step(tab: Tab, by: -1 | 1): Tab {
  const at = Math.max(0, Math.min(tab.stack.length - 1, tab.at + by));
  return at === tab.at ? tab : { ...tab, at, nonce: 0 };
}
