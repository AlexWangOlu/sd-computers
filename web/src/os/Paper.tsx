import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type WheelEvent } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import { useExitFx } from '@/hooks/useExitFx';
import { t } from '@/i18n';
import { FONTS, RichBlock, SignLine, isText, normDoc, type Block, type FontKey, type RichDoc, type Run, type Signature } from '@/lib/richdoc';
import { SignDialog } from './SignDialog';

// A printed page, in the hand: what using a printout (the item) opens. Sheets of A4 over the game,
// with no computer open - the server looked the page up and client Lua sent it here
// (client/computers/paper.lua). It belongs to no desktop style: paper looks like paper.
//
// The sheet is always A4, whatever is on it. It is laid out at one fixed size in its own pixels
// (A4 at 96 to the inch) and scaled to the display, so a line breaks in the same place on every
// screen; what does not fit on one sheet goes on to the next, and the sheets are turned like
// pages. The cutting is done by measuring: every piece of the page is drawn once out of sight at
// the sheet's width, and the pieces are dealt on to sheets by their heights.
//
// What kind of page it is only changes the stock it is on (src/styles/paper.css): a document is
// set in its own typeface, a system log comes on green-bar listing paper.
//
// A document can have lines to sign on. Whoever holds the page signs one from here (SignDialog),
// and the server answers with the page as it then is: the name and the time under a signature are
// its own, and so is whether this player is holding the sheet at all.

/** A page as it is kept (server/computers/printing.lua > PrintDoc). */
export interface PaperDoc {
  kind: string;
  title: string;
  letterhead?: string;
  subhead?: string;
  fields?: { label: string; value: string }[];
  body?: string;
  /** a formatted document (Files) */
  rich?: unknown;
  table?: { head: string[]; rows: string[][] };
  image?: string;
  footer?: string;
}

/** What the item opened: the page, and who printed it, from which machine and when. */
export interface PaperPage {
  id?: number;
  doc?: PaperDoc;
  by?: string | null;
  from?: string | null;
  /** unix seconds */
  at?: number;
  /** there are lines on it to sign, and this is who the player holding it would sign as */
  signing?: { name: string } | null;
  /** thrown away since (configs/shared/printers.lua > KeepDays): there is nothing left to read */
  faded?: boolean;
  title?: string | null;
}

/** A4 at 96 to the inch, and the part of it that is printed on. */
const PAGE_W = 794;
const PAGE_H = 1123;
const TOP = 74;
const BOTTOM = 86;
const INNER_H = PAGE_H - TOP - BOTTOM;
/** Characters past which a run of text is cut into pieces, so no one piece is taller than a sheet. */
const PIECE = 1500;
const TURN_MS = 620;

/** One piece of a page: something that is never cut in two. */
type Piece =
  | { k: 'head'; letterhead: string; subhead?: string }
  | { k: 'title'; text: string }
  | { k: 'fields'; fields: { label: string; value: string }[] }
  | { k: 'block'; block: Block; tight?: boolean }
  /** lines to sign on that follow one another: a row of them (`n` is which line of the document each is) */
  | { k: 'signs'; lines: { n: number; label?: string; sig?: Signature }[] }
  | { k: 'text'; text: string; tight?: boolean }
  | { k: 'image'; src: string }
  | { k: 'row'; cells: string[] }
  | { k: 'note'; text: string };

/** An empty Lua table can arrive as {} rather than []: every list on a page is made a list here. */
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const two = (n: number): string => String(n).padStart(2, '0');
const stamp = (at?: number): string => {
  if (!at) return '';
  const d = new Date(at * 1000);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** A long string in pieces of about PIECE characters, cut where a word ends. */
function cut(s: string): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > PIECE) {
    let at = rest.lastIndexOf(' ', PIECE);
    if (at < PIECE * 0.6) at = PIECE;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^ /, '');
  }
  out.push(rest);
  return out;
}

/** The runs of a block in pieces, each no longer than PIECE. */
function cutRuns(runs: Run[]): Run[][] {
  const total = runs.reduce((n, r) => n + r.s.length, 0);
  if (total <= PIECE) return [runs];
  const out: Run[][] = [[]];
  let used = 0;
  for (const r of runs) {
    for (const part of cut(r.s)) {
      if (used > 0 && used + part.length > PIECE) {
        out.push([]);
        used = 0;
      }
      out[out.length - 1].push({ ...r, s: part });
      used += part.length;
    }
  }
  return out;
}

/** Everything on a page, in the order it reads, as pieces that are never cut in two. */
function piecesOf(doc: PaperDoc, rich: RichDoc | null): Piece[] {
  const out: Piece[] = [];
  if (doc.letterhead) out.push({ k: 'head', letterhead: doc.letterhead, subhead: doc.subhead });
  // (what was written is its own heading: a typed page and a document do not get their file name printed on them)
  if (doc.kind !== 'text' && doc.kind !== 'document') out.push({ k: 'title', text: doc.title });
  const fields = list<{ label: string; value: string }>(doc.fields);
  if (fields.length) out.push({ k: 'fields', fields });
  if (doc.image) out.push({ k: 'image', src: doc.image });

  let signs = 0;
  for (const b of rich?.blocks ?? []) {
    if (b.t === 'sign') {
      const line = { n: signs++, label: b.label, sig: b.sig };
      const last = out[out.length - 1];
      if (last && last.k === 'signs') last.lines.push(line);
      else out.push({ k: 'signs', lines: [line] });
    } else if (isText(b)) {
      const parts = cutRuns(b.r);
      parts.forEach((r, i) => out.push({ k: 'block', block: { ...b, r }, tight: i < parts.length - 1 }));
    } else if (b.t === 'ul' || b.t === 'ol') {
      // An entry a piece, so a long list runs on to the next sheet (each carries the number it is).
      b.items.forEach((it, i) => out.push({ k: 'block', block: { t: b.t, items: [it], start: i + 1 }, tight: i < b.items.length - 1 }));
    } else out.push({ k: 'block', block: b });
  }

  if (doc.body) {
    for (const para of doc.body.replace(/\r\n?/g, '\n').split('\n')) {
      const parts = cut(para);
      parts.forEach((text, i) => out.push({ k: 'text', text, tight: i < parts.length - 1 }));
    }
  }

  const head = list<string>(doc.table?.head);
  if (head.length) for (const r of list<string[]>(doc.table?.rows)) out.push({ k: 'row', cells: head.map((_, c) => list<string>(r)[c] ?? '') });
  if (doc.footer) out.push({ k: 'note', text: doc.footer });
  return out;
}

/** A piece that must not be left alone at the foot of a sheet. */
const leads = (p: Piece): boolean => p.k === 'title' || p.k === 'head' || (p.k === 'block' && (p.block.t === 'h1' || p.block.t === 'h2' || p.block.t === 'h3'));

/** Whether the player holding the page can sign it, and what signing a line does. */
const Signing = createContext<{ can: boolean; sign: (line: number) => void }>({ can: false, sign: () => undefined });

/** A row of lines to sign on: the signed ones with their ink, the others with a tab to sign at. */
function SignRow({ lines }: { lines: { n: number; label?: string; sig?: Signature }[] }) {
  const { can, sign } = useContext(Signing);
  return (
    <div className="sig-row">
      {lines.map(l => (
        <SignLine key={l.n} label={l.label} sig={l.sig} note={l.sig ? t('ui.print.signed_note', l.sig.name, stamp(l.sig.at)) : undefined}>
          {!l.sig && can && (
            <button type="button" className="sig-flag" onClick={() => sign(l.n)}>
              {t('ui.print.sign_here')}
            </button>
          )}
        </SignLine>
      ))}
    </div>
  );
}

/** One piece, drawn. A row is drawn by the table it is in (Rows). */
function PieceView({ piece }: { piece: Exclude<Piece, { k: 'row' }> }): ReactNode {
  switch (piece.k) {
    case 'signs':
      return <SignRow lines={piece.lines} />;
    case 'head':
      return (
        <header className="paper-head">
          <div className="paper-letterhead">{piece.letterhead}</div>
          {piece.subhead && <div className="paper-subhead">{piece.subhead}</div>}
        </header>
      );
    case 'title':
      return <h1 className="paper-title">{piece.text}</h1>;
    case 'fields':
      return (
        <dl className="paper-fields">
          {piece.fields.map((f, i) => (
            <div key={i} className="paper-field">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'block':
      return <RichBlock block={piece.block} />;
    case 'text':
      return <p className="paper-line">{piece.text || ' '}</p>;
    case 'image':
      return <img className="paper-image" src={piece.src} alt="" draggable={false} />;
    case 'note':
      return <div className="paper-note">{piece.text}</div>;
  }
}

/** Rows of the table, with its heading over them (it is printed again at the top of every sheet). */
function Rows({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="paper-table">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, n) => (
              <td key={n}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The pieces of one sheet, drawn: runs of rows gathered into their table. */
function Flow({ pieces, head }: { pieces: Piece[]; head: string[] }) {
  const out: ReactNode[] = [];
  let rows: string[][] = [];
  const flush = (key: string) => {
    if (!rows.length) return;
    out.push(
      <div key={key} className="paper-piece">
        <Rows head={head} rows={rows} />
      </div>,
    );
    rows = [];
  };
  pieces.forEach((p, i) => {
    if (p.k === 'row') {
      rows.push(p.cells);
      return;
    }
    flush(`t${i}`);
    out.push(
      <div key={i} className={`paper-piece${'tight' in p && p.tight ? ' is-tight' : ''}`}>
        <PieceView piece={p} />
      </div>,
    );
  });
  flush('tend');
  return <>{out}</>;
}

/** Deal the pieces on to sheets by their measured heights. */
function paginate(pieces: Piece[], heights: number[], headH: number): Piece[][] {
  const pages: Piece[][] = [[]];
  let used = 0;
  let inTable = false;
  pieces.forEach((p, i) => {
    let h = heights[i] ?? 0;
    // (the first row of a run on a sheet brings the table's heading with it)
    if (p.k === 'row' && !inTable) h += headH;
    const page = pages[pages.length - 1];
    if (page.length > 0 && used + h > INNER_H) {
      // A heading is not left at the foot of a sheet with nothing under it.
      const last = page[page.length - 1];
      const carried = page.length > 1 && leads(last) ? page.pop() : undefined;
      pages.push(carried ? [carried] : []);
      used = carried ? heights[i - 1] ?? 0 : 0;
      if (p.k === 'row') h = (heights[i] ?? 0) + headH;
    }
    pages[pages.length - 1].push(p);
    used += h;
    inTable = p.k === 'row';
  });
  return pages;
}

/** How big a sheet can be drawn on this display, and at "read" size. */
function useScale(zoomed: boolean): number {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const fit = Math.min((size.h - 132) / PAGE_H, (size.w - 220) / PAGE_W);
  const s = zoomed ? Math.max(fit * 1.45, Math.min(1.1, (size.w - 220) / PAGE_W)) : fit;
  return Math.max(0.3, Math.min(1.5, s));
}

/** The page signed in the browser preview, where there is no server to do it. */
function previewSigned(page: PaperPage, line: number, image: string | undefined, name: string): PaperPage | null {
  const rich = page.doc?.rich as { blocks?: { t?: string; sig?: Signature }[] } | undefined;
  const fields = (rich?.blocks ?? []).filter(b => b.t === 'sign');
  const img = image ?? fields.find(b => b.sig)?.sig?.img;
  if (!page.doc || !rich?.blocks || !fields[line] || !img) return null;
  const target = fields[line];
  const blocks = rich.blocks.map(b => (b === target ? { ...b, sig: { name, at: Math.floor(Date.now() / 1000), img } } : b));
  return { ...page, doc: { ...page.doc, rich: { ...rich, blocks } } };
}

export default function Paper({ page, onClose, onPage }: { page: PaperPage; onClose: () => void; /** the page changed under the reader: a line of it was signed */ onPage: (page: PaperPage) => void }) {
  const exitRef = useExitFx('fade-out');
  const tilt = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const scale = useScale(zoomed);

  const doc = page.faded ? undefined : page.doc;
  const kind = (doc?.kind ?? 'faded').replace(/[^a-z0-9-]/gi, '');
  const rich = useMemo(() => (doc?.rich ? normDoc(doc.rich) : null), [doc]);
  const head = useMemo(() => list<string>(doc?.table?.head), [doc]);
  const pieces = useMemo(() => (doc ? piecesOf(doc, rich) : []), [doc, rich]);
  const font: FontKey = rich?.font ?? (kind === 'logs' ? 'mono' : 'typewriter');
  const fontStyle: CSSProperties = { fontFamily: FONTS[font] };

  // Every piece is drawn once out of sight at the sheet's width, and dealt on to sheets by its height.
  // A picture has no height until it has loaded: each one that loads has the pieces measured again.
  const [loaded, setLoaded] = useState(0);
  const [pages, setPages] = useState<Piece[][]>([pieces]);
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const heights = Array.from(el.querySelectorAll<HTMLElement>(':scope > .paper-piece')).map(n => n.offsetHeight);
    const headH = el.querySelector<HTMLElement>('.paper-measure-head thead')?.offsetHeight ?? 0;
    setPages(paginate(pieces, heights, headH));
  }, [pieces, loaded]);
  // (a picture's load is not an event that travels up the page: it is caught on its way down)
  useEffect(() => {
    const el = measure.current;
    if (!el) return;
    const bump = () => setLoaded(n => n + 1);
    el.addEventListener('load', bump, true);
    el.addEventListener('error', bump, true);
    return () => {
      el.removeEventListener('load', bump, true);
      el.removeEventListener('error', bump, true);
    };
  }, []);

  const count = pages.length;
  const [at, setAt] = useState(0);
  /** The sheet being turned: from one page to another, until the leaf has come down. */
  const [turn, setTurn] = useState<{ from: number; to: number } | null>(null);
  const timer = useRef(0);
  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= count || to === at || turn) return;
      setTurn({ from: at, to });
      setAt(to);
      timer.current = window.setTimeout(() => setTurn(null), TURN_MS);
    },
    [at, count, turn],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // (a picture loading can take a page away from under the one showing)
  useEffect(() => {
    if (at > count - 1) setAt(Math.max(0, count - 1));
  }, [at, count]);

  const close = useCallback(() => {
    if (!isEnvBrowser()) void fetchNui('computers:paper:close');
    onClose();
  }, [onClose]);

  /** The line being signed (which line of the document), while the dialog for it is up. */
  const [signLine, setSignLine] = useState<number | null>(null);
  const signer = page.signing?.name ?? '';
  const signing = useMemo(() => ({ can: !!page.signing && !page.faded, sign: (line: number) => setSignLine(line) }), [page.signing, page.faded]);
  const sign = useCallback(
    async (image?: string): Promise<string | null> => {
      if (signLine === null) return null;
      if (isEnvBrowser()) {
        const next = previewSigned(page, signLine, image, signer);
        if (next) onPage(next);
        return next ? null : t('ui.print.sign_failed');
      }
      const r = await fetchNui<{ ok?: boolean; page?: PaperPage; error?: string }>('computers:paper:sign', { field: signLine, image });
      if (r?.ok && r.page) {
        onPage(r.page);
        return null;
      }
      return r?.error ?? t('ui.print.sign_failed');
    },
    [signLine, page, signer, onPage],
  );

  useEffect(() => {
    // (the dialog has the keys while it is up: Backspace there takes a letter back, not the page down)
    if (signLine !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') close();
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') go(at + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(at - 1);
      else if (e.key === 'z' || e.key === 'Z' || e.key === '+' || e.key === '=' || e.key === '-') setZoomed(z => (e.key === '-' ? false : e.key === '+' || e.key === '=' ? true : !z));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, go, at, signLine]);

  // The sheet leans towards the pointer, the way a page held in the hand catches the light.
  useEffect(() => {
    const el = tilt.current;
    if (!el) return;
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty('--rx', `${(2.5 - y * 7).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
        el.style.setProperty('--sheen', (x * 60).toFixed(1));
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  // The wheel turns the pages while the whole sheet is in view (zoomed in, it scrolls the sheet).
  const wheelAt = useRef(0);
  const onWheel = (e: WheelEvent) => {
    if (zoomed || count < 2 || Math.abs(e.deltaY) < 8) return;
    const now = Date.now();
    if (now - wheelAt.current < TURN_MS) return;
    wheelAt.current = now;
    go(at + (e.deltaY > 0 ? 1 : -1));
  };

  const printed = [page.by && t('ui.print.page_by', page.by), page.from && t('ui.print.page_from', page.from)].filter(Boolean).join(' ');

  /** One sheet, drawn at A4 in its own pixels. */
  const sheet = (index: number): ReactNode => (
    <div className={`paper-sheet is-${kind}`}>
      {doc ? (
        <>
          <div className="paper-content rd" style={fontStyle}>
            <Signing.Provider value={signing}>
              <Flow pieces={pages[index] ?? []} head={head} />
            </Signing.Provider>
          </div>
          <footer className="paper-foot">
            <span>{printed}</span>
            <span>
              {stamp(page.at)}
              {page.id ? ` · ${t('ui.print.page_ref', String(page.id).padStart(5, '0'))}` : ''}
              {count > 1 ? ` · ${index + 1}/${count}` : ''}
            </span>
          </footer>
        </>
      ) : (
        <div className="paper-content rd" style={{ fontFamily: FONTS.typewriter }}>
          <h1 className="paper-title">{page.title || t('ui.print.faded_title')}</h1>
          <p className="paper-line">{t('ui.print.faded_body')}</p>
        </div>
      )}
    </div>
  );

  // While a leaf turns, the sheet under it is the later of the two pages and the leaf is the earlier:
  // going on, the page being left lifts away; going back, the page gone back to comes down over.
  const under = turn ? Math.max(turn.from, turn.to) : at;
  const leaf = turn ? Math.min(turn.from, turn.to) : -1;
  const fitStyle: CSSProperties = { width: PAGE_W * scale, height: PAGE_H * scale };
  const scaleStyle: CSSProperties = { transform: `scale(${scale})` };

  return (
    <div ref={exitRef} className={`paper-root mirror-block fade-in${zoomed ? ' is-zoomed' : ''}`} onMouseDown={e => e.target === e.currentTarget && close()} onWheel={onWheel}>
      <button type="button" className="paper-close" aria-label={t('ui.print.page_close')} title={t('ui.print.page_close')} onClick={close}>
        <X size={18} />
      </button>

      <div className="paper-scene" onMouseDown={e => e.target === e.currentTarget && close()}>
        <div ref={tilt} className="paper-tilt" style={fitStyle}>
          {/* (the sheets still under this one) */}
          {count - under > 2 && <div className="paper-under is-2" />}
          {count - under > 1 && <div className="paper-under is-1" />}
          <div className="paper-scale" style={scaleStyle}>
            {sheet(under)}
          </div>
          {leaf >= 0 && turn && (
            <div className={`paper-leaf ${turn.to > turn.from ? 'is-out' : 'is-in'}`}>
              <div className="paper-scale" style={scaleStyle}>
                {sheet(leaf)}
              </div>
              <div className="paper-back" />
            </div>
          )}
        </div>
      </div>

      <div className="paper-bar">
        {count > 1 && (
          <>
            <button type="button" aria-label={t('ui.print.page_prev')} title={t('ui.print.page_prev')} disabled={at === 0 || !!turn} onClick={() => go(at - 1)}>
              <ChevronLeft size={17} />
            </button>
            <span className="paper-count">{t('ui.print.page_of', at + 1, count)}</span>
            <button type="button" aria-label={t('ui.print.page_next')} title={t('ui.print.page_next')} disabled={at >= count - 1 || !!turn} onClick={() => go(at + 1)}>
              <ChevronRight size={17} />
            </button>
            <i />
          </>
        )}
        <button type="button" aria-label={t(zoomed ? 'ui.print.zoom_out' : 'ui.print.zoom_in')} title={t(zoomed ? 'ui.print.zoom_out' : 'ui.print.zoom_in')} onClick={() => setZoomed(z => !z)}>
          {zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
        </button>
        <i />
        <span className="paper-hint">{t('ui.print.page_hint')}</span>
      </div>

      {signLine !== null && <SignDialog name={signer} onClose={() => setSignLine(null)} onSign={sign} />}

      {/* Out of sight: every piece once, at the sheet's width, to be measured. */}
      {doc && (
        <div className={`paper-sheet is-${kind} paper-measure`} aria-hidden>
          <div ref={measure} className="paper-content rd" style={fontStyle}>
            {pieces.map((p, i) =>
              p.k === 'row' ? (
                <div key={i} className="paper-piece">
                  <table className="paper-table">
                    <tbody>
                      <tr>
                        {p.cells.map((c, n) => (
                          <td key={n}>{c}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div key={i} className={`paper-piece${'tight' in p && p.tight ? ' is-tight' : ''}`}>
                  <PieceView piece={p} />
                </div>
              ),
            )}
            {head.length > 0 && (
              <div className="paper-measure-head">
                <Rows head={head} rows={[]} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
