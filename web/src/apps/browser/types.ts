// What `browser:sites` returns (server/computers/browser.lua), and what the app makes of it.
// Change a shape here, change it there.

export type NoticeKind = 'info' | 'success' | 'warning' | 'error';

/** A row of a `links` block: another page by its address, with an optional label and small print. */
export interface SiteLink {
  to: string;
  label?: string;
  note?: string;
}

/** One piece of a built-in page, drawn top to bottom. */
export type Block =
  | { type: 'heading' | 'subheading' | 'text'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'notice'; kind: NoticeKind; title?: string; text: string }
  | { type: 'facts'; rows: { label: string; value: string }[] }
  | { type: 'links'; items: SiteLink[] }
  | { type: 'image'; src: string; caption?: string };

/** The live sites there are: one of sd-phone's public apps each (server/computers/web.lua). */
export const LIVE_KINDS = ['news', 'market', 'pages', 'directory', 'squawk', 'laws', 'stocks'] as const;
export type LiveKind = (typeof LIVE_KINDS)[number];

/**
 * A page on the network: written as blocks, the owner's real page (`url`) in a frame, or a live
 * site - an address and a name here, its pages read from the phone as they are opened (src/apps/
 * browser/live).
 */
export interface Site {
  address: string;
  title: string;
  bookmark: boolean;
  url?: string;
  blocks?: Block[];
  live?: LiveKind;
}

/** The whole network: every site, by address too, and where a new tab opens. */
export interface Network {
  home: string;
  sites: Site[];
  byAddress: Map<string, Site>;
}

/** What an address turns out to be. `missing` is anything the network does not have. */
export type View =
  | { kind: 'home' }
  | { kind: 'page'; site: Site; blocks: Block[] }
  | { kind: 'frame'; site: Site; url: string }
  /** A live site, or a page under it: `path` is what follows its address ('story', '12'). */
  | { kind: 'live'; site: Site; live: LiveKind; path: string[] }
  | { kind: 'missing'; address: string };

/** One tab: the addresses it has been to, and which of them it is on. */
export interface Tab {
  key: string;
  stack: string[];
  at: number;
  /** Bumped by Reload: the page is drawn again from scratch. */
  nonce: number;
}
