import type { ReactNode } from 'react';

// A written document, as Files keeps one and a printer prints it. Not HTML: a typeface and a list
// of blocks - paragraphs, headings, quotes, lists, pictures, rules, lines to sign on - each a few
// runs of text with their marks. The server cuts whatever it is sent down to exactly this
// (server/computers/richdoc.lua); this file is the same shape on the page's side: reading one
// defensively, drawing one (RichBlock, for the printed page), and turning the editor's own markup
// into one and back (docToHtml / domToDoc). The look is src/styles/richdoc.css, under `.rd`.

export type FontKey = 'serif' | 'sans' | 'mono' | 'typewriter' | 'classic' | 'hand';
export type SizeKey = 's' | 'l' | 'xl';
export type InkKey = 'blue' | 'red' | 'green' | 'purple' | 'grey';
export type TextKind = 'p' | 'h1' | 'h2' | 'h3' | 'quote';
export type Align = 'left' | 'center' | 'right' | 'justify';

export interface Run {
  /** the text; a "\n" in it is a line break inside the block */
  s: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  /** struck through */
  x?: boolean;
  /** a typeface of its own, where it is not the document's */
  f?: FontKey;
  /** a size of its own, where it is not the usual one */
  z?: SizeKey;
  /** an ink of its own, where it is not black */
  c?: InkKey;
}

/** A signature on a printed page: whose (the server's word for it), when, and the ink itself. */
export interface Signature {
  name: string;
  /** unix seconds */
  at: number;
  /** a PNG, as a data address */
  img: string;
}

export type Block =
  | { t: TextKind; a?: Align; r: Run[] }
  | { t: 'ul' | 'ol'; items: Run[][]; /** the number its first entry carries (a list cut across two pages) */ start?: number }
  | { t: 'img'; src: string; /** share of the page's width: 25, 50, 75 or 100 */ w?: number; a?: 'left' | 'right'; cap?: string }
  | { t: 'hr' }
  | { t: 'sign'; /** whose line it is, printed under it */ label?: string; /** on a printed page only: a document's lines are empty */ sig?: Signature };

export interface RichDoc {
  v: 1;
  font: FontKey;
  blocks: Block[];
}

/** The typefaces a document can be set in. Every one is on the player's machine or in the bundle. (richdoc.css has the same list for a part set in one.) */
export const FONTS: Record<FontKey, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Inter Variable', Inter, 'Segoe UI', Arial, sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', Consolas, monospace",
  typewriter: "'Courier New', Courier, monospace",
  classic: "'Palatino Linotype', 'Book Antiqua', Palatino, 'Times New Roman', serif",
  hand: "'Segoe Print', 'Ink Free', 'Bradley Hand ITC', 'Comic Sans MS', cursive",
};
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

/** The sizes a part can be set in, as the number the browser's own size command takes (3 is the usual one). */
export const SIZES: Record<SizeKey, string> = { s: '2', l: '5', xl: '6' };
export const SIZE_KEYS = Object.keys(SIZES) as SizeKey[];
/** The size the browser's command is asked for to put a part back to the usual. */
export const SIZE_USUAL = '3';

/** The inks a part can be set in. (richdoc.css has the same list for the printed page.) */
export const INKS: Record<InkKey, string> = { blue: '#1d4f9c', red: '#b3261e', green: '#256b3c', purple: '#6a3d9a', grey: '#6d6f76' };
export const INK_KEYS = Object.keys(INKS) as InkKey[];
/** What the page is written in when a part has no ink of its own. */
export const INK_USUAL = '#1c1c1f';

/** Most lines to sign on in one document (the server's own limit). */
export const MAX_SIGNS = 8;

const TEXT_KINDS: Record<string, TextKind> = { p: 'p', h1: 'h1', h2: 'h2', h3: 'h3', quote: 'quote' };
const WIDTHS = [25, 50, 75, 100];

export type TextBlock = { t: TextKind; a?: Align; r: Run[] };
export const isText = (b: Block): b is TextBlock => b.t in TEXT_KINDS;
type ListBlock = Extract<Block, { t: 'ul' | 'ol' }>;
const isList = (b: Block): b is ListBlock => b.t === 'ul' || b.t === 'ol';

// ── Reading one ─────────────────────────────────────────────────────────────────────────────

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function normRuns(raw: unknown): Run[] {
  const out: Run[] = [];
  for (const r of list<Partial<Run>>(raw)) {
    if (!r || typeof r.s !== 'string' || r.s === '') continue;
    const run: Run = { s: r.s };
    if (r.b === true) run.b = true;
    if (r.i === true) run.i = true;
    if (r.u === true) run.u = true;
    if (r.x === true) run.x = true;
    if (typeof r.f === 'string' && r.f in FONTS) run.f = r.f;
    if (typeof r.z === 'string' && r.z in SIZES) run.z = r.z;
    if (typeof r.c === 'string' && r.c in INKS) run.c = r.c;
    out.push(run);
  }
  return out;
}

function normSig(raw: unknown): Signature | undefined {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Signature>;
  if (typeof o.name !== 'string' || typeof o.img !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(o.img)) return undefined;
  return { name: o.name, at: Number(o.at) || 0, img: o.img };
}

/** A document off the wire (or out of storage), whatever state it is in. Never throws. */
export function normDoc(raw: unknown): RichDoc {
  const o = (raw && typeof raw === 'object' ? raw : {}) as { font?: unknown; blocks?: unknown };
  const blocks: Block[] = [];
  for (const b of list<Record<string, unknown>>(o.blocks)) {
    const t = b && typeof b.t === 'string' ? b.t : '';
    if (TEXT_KINDS[t]) {
      const a = b.a === 'center' || b.a === 'right' || b.a === 'justify' ? b.a : undefined;
      blocks.push({ t: TEXT_KINDS[t], ...(a ? { a } : {}), r: normRuns(b.r) });
    } else if (t === 'ul' || t === 'ol') {
      const items = list<unknown>(b.items).map(normRuns);
      if (items.length) blocks.push({ t, items });
    } else if (t === 'img' && typeof b.src === 'string' && /^(https:\/\/|data:image\/)/i.test(b.src)) {
      const w = WIDTHS.includes(Number(b.w)) ? Number(b.w) : 50;
      const a = b.a === 'left' || b.a === 'right' ? b.a : undefined;
      blocks.push({ t: 'img', src: b.src, w, ...(a ? { a } : {}), ...(typeof b.cap === 'string' && b.cap ? { cap: b.cap } : {}) });
    } else if (t === 'hr') {
      blocks.push({ t: 'hr' });
    } else if (t === 'sign') {
      const label = typeof b.label === 'string' ? b.label.slice(0, 60) : '';
      const sig = normSig(b.sig);
      blocks.push({ t: 'sign', ...(label ? { label } : {}), ...(sig ? { sig } : {}) });
    }
  }
  const font = typeof o.font === 'string' && o.font in FONTS ? (o.font as FontKey) : 'serif';
  return { v: 1, font, blocks };
}

/** A stored body as the document it is, or null when it is not JSON at all. */
export function parseDoc(json: string): RichDoc | null {
  try {
    const raw: unknown = JSON.parse(json);
    return raw && typeof raw === 'object' ? normDoc(raw) : null;
  } catch {
    return null;
  }
}

export const emptyDoc = (font: FontKey = 'serif'): RichDoc => ({ v: 1, font, blocks: [{ t: 'p', r: [] }] });

/** Plain text as a document: a paragraph a line (what a document was before it could be formatted). */
export function fromText(text: string, font: FontKey = 'serif'): RichDoc {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return { v: 1, font, blocks: lines.map(s => ({ t: 'p' as const, r: s ? [{ s }] : [] })) };
}

const plain = (runs: Run[]): string => runs.map(r => r.s).join('');

/** How many characters of text a document holds (what the server counts against the limit). */
export function docLength(doc: RichDoc): number {
  let n = 0;
  for (const b of doc.blocks) {
    if (isText(b)) n += Array.from(plain(b.r)).length;
    else if (isList(b)) for (const it of b.items) n += Array.from(plain(it)).length;
  }
  return n;
}

/** Whether there is nothing on it at all. */
export function isBlank(doc: RichDoc): boolean {
  return doc.blocks.every(b => (isText(b) ? !plain(b.r).trim() : isList(b) ? b.items.every(it => !plain(it).trim()) : false));
}

// ── Drawing one ─────────────────────────────────────────────────────────────────────────────

function runNodes(runs: Run[]): ReactNode {
  if (runs.length === 0) return <br />;
  return runs.map((r, i) => {
    let node: ReactNode = r.s;
    if (r.x) node = <s>{node}</s>;
    if (r.u) node = <u>{node}</u>;
    if (r.i) node = <i>{node}</i>;
    if (r.b) node = <b>{node}</b>;
    return (
      <span key={i} data-f={r.f} data-z={r.z} data-c={r.c}>
        {node}
      </span>
    );
  });
}

/**
 * A line to sign on: the room over it for the ink, the line, whose it is, and - signed - who by.
 * `children` go in the room over the line (the printed page puts its "sign here" tab there).
 */
export function SignLine({ label, sig, note, children }: { label?: string; sig?: Signature; /** who signed and when, as the page words it */ note?: string; children?: ReactNode }) {
  return (
    <div className={`sig${sig ? ' is-signed' : ''}`}>
      <div className="sig-space">
        {sig && <img className="sig-ink" src={sig.img} alt="" draggable={false} />}
        {children}
      </div>
      <div className="sig-line" />
      <div className="sig-label">{label}</div>
      {sig && <div className="sig-who">{note ?? sig.name}</div>}
    </div>
  );
}

/** One block, as the printed page draws it (the same tags the editor writes, so one stylesheet does both). */
export function RichBlock({ block }: { block: Block }) {
  if (block.t === 'hr') return <hr />;
  if (block.t === 'sign') {
    return (
      <div className="sig-row">
        <SignLine label={block.label} sig={block.sig} />
      </div>
    );
  }
  if (block.t === 'img') {
    return (
      <figure data-w={block.w ?? 50} data-a={block.a ?? 'center'}>
        <img src={block.src} alt="" draggable={false} />
        {block.cap && <figcaption>{block.cap}</figcaption>}
      </figure>
    );
  }
  if (!isText(block)) {
    const items = block.items.map((it, i) => <li key={i}>{runNodes(it)}</li>);
    return block.t === 'ol' ? <ol start={block.start ?? 1}>{items}</ol> : <ul>{items}</ul>;
  }
  const style = block.a ? { textAlign: block.a } : undefined;
  const body = runNodes(block.r);
  if (block.t === 'h1') return <h1 style={style}>{body}</h1>;
  if (block.t === 'h2') return <h2 style={style}>{body}</h2>;
  if (block.t === 'h3') return <h3 style={style}>{body}</h3>;
  if (block.t === 'quote') return <blockquote style={style}>{body}</blockquote>;
  return <p style={style}>{body}</p>;
}

// ── The editor's markup ─────────────────────────────────────────────────────────────────────
// The editor is the browser's own (a contentEditable page and its editing commands), so a part in
// a typeface, a size or an ink of its own is what those commands write: a <font> element with a
// `face` (one of the keys above, which richdoc.css turns into the typeface), a `size` and a
// `color`. Only what can be read back into a run is ever kept.

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function runsHtml(runs: Run[]): string {
  if (runs.length === 0) return '<br>';
  return runs
    .map(r => {
      let h = esc(r.s).replace(/\n/g, '<br>');
      if (r.x) h = `<s>${h}</s>`;
      if (r.u) h = `<u>${h}</u>`;
      if (r.i) h = `<i>${h}</i>`;
      if (r.b) h = `<b>${h}</b>`;
      const font = [r.f && `face="${r.f}"`, r.z && `size="${SIZES[r.z]}"`, r.c && `color="${INKS[r.c]}"`].filter(Boolean).join(' ');
      return font ? `<font ${font}>${h}</font>` : h;
    })
    .join('');
}

const TAG: Record<TextKind, string> = { p: 'p', h1: 'h1', h2: 'h2', h3: 'h3', quote: 'blockquote' };

/** A picture as the editor holds one: a block that is not typed into, with what it is on its attributes. */
export const figureHtml = (src: string, w = 50, a: 'left' | 'right' | 'center' = 'center', cap = ''): string =>
  `<figure contenteditable="false" data-w="${w}" data-a="${a}"><img src="${esc(src)}" alt="" draggable="false">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;

/** A line to sign on as the editor holds one (the same pieces SignLine draws). */
export const signHtml = (label = ''): string =>
  `<div class="sig" data-label="${esc(label)}"><div class="sig-space"></div><div class="sig-line"></div><div class="sig-label">${esc(label)}</div></div>`;

/** Lines to sign on, side by side: one block that is not typed into. */
export const signRowHtml = (labels: string[]): string => `<section class="sig-row" contenteditable="false">${labels.map(signHtml).join('')}</section>`;

/** A document as the markup the editor works on. Every string in it is escaped: this is text, not markup. */
export function docToHtml(doc: RichDoc): string {
  const out: string[] = [];
  for (let i = 0; i < doc.blocks.length; i++) {
    const b = doc.blocks[i];
    if (b.t === 'hr') out.push('<hr>');
    else if (b.t === 'img') out.push(figureHtml(b.src, b.w ?? 50, b.a ?? 'center', b.cap ?? ''));
    else if (b.t === 'sign') {
      // (the lines that follow one another are one row)
      const labels = [b.label ?? ''];
      for (let next = doc.blocks[i + 1]; next && next.t === 'sign'; next = doc.blocks[i + 1]) {
        labels.push(next.label ?? '');
        i++;
      }
      out.push(signRowHtml(labels));
    } else if (!isText(b)) out.push(`<${b.t}>${b.items.map(it => `<li>${runsHtml(it)}</li>`).join('')}</${b.t}>`);
    else {
      const tag = TAG[b.t];
      out.push(`<${tag}${b.a ? ` style="text-align:${b.a}"` : ''}>${runsHtml(b.r)}</${tag}>`);
    }
  }
  return out.length ? out.join('') : '<p><br></p>';
}

interface Marks {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  x?: boolean;
  f?: FontKey;
  z?: SizeKey;
  c?: InkKey;
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'FIGURE', 'HR', 'PRE', 'SECTION']);

const squash = (s: string): string => s.replace(/["'\s]/g, '').toLowerCase();
const FAMILIES = FONT_KEYS.map(k => [squash(FONTS[k]), k] as const);

/** A colour as the browser words it (#rrggbb, or rgb(r, g, b)) as one of the inks, if it is one. */
function inkOfColour(colour: string): InkKey | undefined {
  let hex = colour.trim().toLowerCase();
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(hex);
  if (rgb) hex = `#${[rgb[1], rgb[2], rgb[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}`;
  return INK_KEYS.find(k => INKS[k] === hex);
}

/**
 * What an element says the typeface, size and ink of what is inside it are. A key that is absent
 * says nothing; one that is `null` says "the usual", over whatever is round it.
 */
export function fontOf(el: HTMLElement): { f?: FontKey; z?: SizeKey | null; c?: InkKey | null } {
  const out: { f?: FontKey; z?: SizeKey | null; c?: InkKey | null } = {};
  const face = el.getAttribute('face') ?? el.getAttribute('data-f') ?? '';
  if (face in FONTS) out.f = face as FontKey;
  else if (el.style.fontFamily) {
    const family = squash(el.style.fontFamily);
    const hit = FAMILIES.find(([stack]) => stack === family);
    if (hit) out.f = hit[1];
  }
  const size = el.getAttribute('size');
  if (size) out.z = size === '1' || size === '2' ? 's' : size === '4' || size === '5' ? 'l' : size === '6' || size === '7' ? 'xl' : null;
  const z = el.getAttribute('data-z') ?? '';
  if (z in SIZES) out.z = z as SizeKey;
  const colour = el.getAttribute('color') ?? el.style.color;
  if (colour) out.c = inkOfColour(colour) ?? null;
  const c = el.getAttribute('data-c') ?? '';
  if (c in INKS) out.c = c as InkKey;
  return out;
}

const same = (a: Marks, b: Marks): boolean => !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && !!a.x === !!b.x && a.f === b.f && a.z === b.z && a.c === b.c;

function push(runs: Run[], s: string, m: Marks): void {
  if (!s) return;
  const last = runs[runs.length - 1];
  if (last && same(last, m)) {
    last.s += s;
    return;
  }
  const run: Run = { s };
  if (m.b) run.b = true;
  if (m.i) run.i = true;
  if (m.u) run.u = true;
  if (m.x) run.x = true;
  if (m.f) run.f = m.f;
  if (m.z) run.z = m.z;
  if (m.c) run.c = m.c;
  runs.push(run);
}

/** The marks an inline element adds to what is inside it. */
function marksOf(el: HTMLElement, m: Marks): Marks {
  const out: Marks = { ...m };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') out.b = true;
  if (tag === 'I' || tag === 'EM') out.i = true;
  if (tag === 'U') out.u = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') out.x = true;
  const st = el.style;
  if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) out.b = true;
  if (st.fontStyle === 'italic') out.i = true;
  const deco = `${st.textDecoration} ${st.textDecorationLine}`;
  if (deco.includes('underline')) out.u = true;
  if (deco.includes('line-through')) out.x = true;
  const font = fontOf(el);
  if (font.f) out.f = font.f;
  if (font.z !== undefined) out.z = font.z ?? undefined;
  if (font.c !== undefined) out.c = font.c ?? undefined;
  return out;
}

/** The runs of everything inside an element, in order. */
function collect(node: Node, m: Marks, runs: Run[]): void {
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      push(runs, (child.textContent ?? '').replace(/ /g, ' ').replace(/​/g, ''), m);
    } else if (child instanceof HTMLElement) {
      if (child.tagName === 'BR') push(runs, '\n', m);
      else if (child.tagName !== 'FIGURE' && child.tagName !== 'IMG') collect(child, marksOf(child, m), runs);
    }
  });
}

/** The runs of one block. The line break a browser leaves at the end of a block is not text. */
function blockRuns(el: Node): Run[] {
  const runs: Run[] = [];
  collect(el, {}, runs);
  const last = runs[runs.length - 1];
  if (last && last.s.endsWith('\n')) {
    last.s = last.s.slice(0, -1);
    if (!last.s) runs.pop();
  }
  return runs;
}

const alignOf = (el: HTMLElement): Align | undefined => {
  const a = el.style.textAlign || el.getAttribute('align') || '';
  return a === 'center' || a === 'right' || a === 'justify' ? a : undefined;
};

const hasBlocks = (el: HTMLElement): boolean => Array.from(el.children).some(c => BLOCK_TAGS.has(c.tagName));

function figureBlock(el: HTMLElement): Block | null {
  const img = el.tagName === 'IMG' ? (el as HTMLImageElement) : el.querySelector('img');
  const src = img?.getAttribute('src') ?? '';
  if (!/^(https:\/\/|data:image\/)/i.test(src)) return null;
  const w = Number(el.getAttribute('data-w'));
  const a = el.getAttribute('data-a');
  const cap = el.querySelector('figcaption')?.textContent?.trim() ?? '';
  return { t: 'img', src, w: WIDTHS.includes(w) ? w : 50, ...(a === 'left' || a === 'right' ? { a } : {}), ...(cap ? { cap } : {}) };
}

/** What a block element is, by its tag. */
function kindOf(tag: string, inside: TextKind): TextKind {
  if (tag === 'H1') return 'h1';
  if (tag === 'H2') return 'h2';
  if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') return 'h3';
  if (tag === 'BLOCKQUOTE') return 'quote';
  return inside;
}

function walk(parent: Node, inside: TextKind, out: Block[]): void {
  /** Loose text and inline elements between two blocks are a paragraph of their own. */
  let loose: Node[] = [];
  const flush = () => {
    if (!loose.length) return;
    const holder = document.createElement('div');
    loose.forEach(n => holder.appendChild(n.cloneNode(true)));
    loose = [];
    const r = blockRuns(holder);
    if (r.length) out.push({ t: inside, r });
  };

  parent.childNodes.forEach(node => {
    if (!(node instanceof HTMLElement)) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim()) loose.push(node);
      return;
    }
    const tag = node.tagName;
    if (!BLOCK_TAGS.has(tag) && tag !== 'IMG') {
      loose.push(node);
      return;
    }
    flush();
    if (tag === 'HR') out.push({ t: 'hr' });
    else if (tag === 'SECTION') {
      // A row of lines to sign on: each is a block, and none carries a signature (those are put on paper).
      node.querySelectorAll('.sig').forEach(line => {
        const label = (line.getAttribute('data-label') ?? '').trim().slice(0, 60);
        out.push({ t: 'sign', ...(label ? { label } : {}) });
      });
    } else if (tag === 'FIGURE' || tag === 'IMG') {
      const fig = figureBlock(node);
      if (fig) out.push(fig);
    } else if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(node.children)
        .filter(c => c.tagName === 'LI')
        .map(li => blockRuns(li));
      if (items.length) out.push({ t: tag === 'OL' ? 'ol' : 'ul', items });
    } else {
      const kind = kindOf(tag, inside);
      // (a quote the browser wrapped round several paragraphs: each is a block of the quote)
      if (hasBlocks(node)) walk(node, kind, out);
      else {
        const a = alignOf(node);
        out.push({ t: kind, ...(a ? { a } : {}), r: blockRuns(node) });
        // A picture dropped into the middle of a paragraph comes out after it.
        node.querySelectorAll('figure, img').forEach(f => {
          if (f.tagName === 'IMG' && f.closest('figure')) return;
          const fig = figureBlock(f as HTMLElement);
          if (fig) out.push(fig);
        });
      }
    }
  });
  flush();
}

/** What is in the editor, as a document. */
export function domToDoc(root: HTMLElement, font: FontKey): RichDoc {
  const blocks: Block[] = [];
  walk(root, 'p', blocks);
  return { v: 1, font, blocks: blocks.length ? blocks : [{ t: 'p', r: [] }] };
}
