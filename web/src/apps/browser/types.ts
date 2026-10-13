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

/** A page on the network: either written as blocks, or the owner's real page (`url`) in a frame. */
export interface Site {
  address: string;
  title: string;
  bookmark: boolean;
  url?: string;
  blocks?: Block[];
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
  | { kind: 'missing'; address: string };

/** One tab: the addresses it has been to, and which of them it is on. */
export interface Tab {
  key: string;
  stack: string[];
  at: number;
  /** Bumped by Reload: the page is drawn again from scratch. */
  nonce: number;
}
