import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { RotateCcw, Shuffle, Undo2, X } from 'lucide-react';
import type { AppProps } from '../registry';
import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import { SuitGlyph } from './glyphs';
import { useKeys, useSize, useStopwatch } from './hooks';
import { PlayingCard } from './PlayingCard';
import { allUp, autoStep, best, deal, draw, fits, isWon, lift, locate, move, moved, type Card, type Dest, type Table, type Zone } from './solitaireRules';
import { cx, still, useGameWindow } from './shared';
import { useBests } from './storage';

interface Game {
  table: Table;
  /** Every table before this one, oldest first: undo pops the last. */
  past: Table[];
  moves: number;
  /** The cards the last change moved. They are drawn over the rest while they travel. */
  lifted: number[];
}

const fresh = (): Game => ({ table: deal(), past: [], moves: 0, lifted: [] });

/** Space kept clear round the table, and a card's height for its width. */
const PAD = 14;
const RATIO = 1.4;
/** Room for the one line of help under the piles, when the window is tall enough to spare it. */
const FOOT = 22;
/** How long after a card was sent off a second click still counts as the same double-click. */
const DOUBLE_MS = 350;

interface Geo {
  cw: number;
  ch: number;
  /** Left edge of column `c` (0-6). */
  col: (c: number) => number;
  /** Top of the tableau row. */
  rowY: number;
  /** How far below that the top edge of a pile's last card may go. */
  room: number;
}

/** Card size and column positions for a table area of w x h. */
function measure(w: number, h: number, foot: number): Geo {
  const gap = Math.max(6, Math.min(14, Math.round(w * 0.014)));
  const byWidth = (w - PAD * 2 - gap * 6) / 7;
  // Two rows of cards, and room under the second to fan a pile out.
  const byHeight = (h - foot - PAD * 2 - gap) / 4.4 / RATIO;
  const cw = Math.floor(Math.max(34, Math.min(118, byWidth, byHeight)));
  const ch = Math.round(cw * RATIO);
  const x0 = Math.max(4, Math.round((w - cw * 7 - gap * 6) / 2));
  const rowY = PAD + ch + gap + 4;
  return { cw, ch, col: c => x0 + c * (cw + gap), rowY, room: Math.max(0, h - foot - PAD - rowY - ch) };
}

interface Placed {
  card: Card;
  zone: Zone;
  n: number;
  /** The last card of its pile. */
  top: boolean;
  x: number;
  y: number;
  z: number;
}

/** Where every card is drawn, indexed by card id. */
function place(t: Table, g: Geo, lifted: number[]): Placed[] {
  const out: Placed[] = [];
  const put = (card: Card, zone: Zone, n: number, index: number, size: number, x: number, y: number) => {
    out[card.id] = { card, zone, n, top: index === size - 1, x, y, z: index + 1 };
  };
  // The stock rises a pixel every few cards, so it looks as thick as it is.
  t.stock.forEach((c, i) => put(c, 'stock', 0, i, t.stock.length, g.col(0), PAD - Math.min(3, Math.floor(i / 6))));
  t.waste.forEach((c, i) => put(c, 'waste', 0, i, t.waste.length, g.col(1), PAD));
  t.found.forEach((f, n) => f.forEach((c, i) => put(c, 'found', n, i, f.length, g.col(3 + n), PAD)));
  t.piles.forEach((p, n) => {
    const down = g.ch * 0.13;
    const up = g.ch * 0.27;
    let need = 0;
    for (let i = 0; i < p.length - 1; i++) need += p[i].up ? up : down;
    // A long pile closes up, so its last card still ends inside the window.
    const squeeze = need > g.room ? g.room / need : 1;
    let y = g.rowY;
    p.forEach((c, i) => {
      put(c, 'pile', n, i, p.length, g.col(n), Math.round(y));
      y += (c.up ? up : down) * squeeze;
    });
  });
  for (const id of lifted) if (out[id]) out[id].z += 1000;
  return out;
}

/** An empty place for a pile, stitched into the felt under the cards. */
function Slot({ zone, n, g, x, y, lit, title, children }: { zone: Zone; n: number; g: Geo; x: number; y: number; lit?: boolean; title?: string; children?: ReactNode }) {
  return (
    <div data-slot={zone} data-n={n} title={title} className={cx('sl-slot', lit && 'is-lit')} style={{ left: x, top: y, width: g.cw, height: g.ch }}>
      {children}
    </div>
  );
}

/**
 * Solitaire (Klondike, one card drawn at a time), as a program of its own: a card table. A wooden
 * rail along the top with the game's name on a brass plate, the count of moves and the clock, and
 * under it the felt. A click sends a card, or the run that starts at it, to the best place that
 * takes it; a right click picks it up instead, and the next click says where it goes. The rules
 * are in solitaireRules.ts: this file lays the table out to fit the window, reads the mouse, and
 * keeps the clock, the undo list and the automatic finish.
 */
export default function Solitaire({ win }: AppProps) {
  const { root, focused } = useGameWindow(win);
  const record0 = useBests(s => s.bests.solitaire);
  const record = useBests(s => s.record);
  const [game, setGame] = useState<Game>(fresh);
  const [epoch, setEpoch] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [refused, setRefused] = useState<number | null>(null);
  const [result, setResult] = useState<{ secs: number; moves: number; best: boolean } | null>(null);
  const [note, setNote] = useState(true);
  const areaRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(areaRef);
  const sentAt = useRef(0);
  const refuseTimer = useRef<number | undefined>(undefined);

  const { table } = game;
  const done = isWon(table);
  const started = game.moves > 0;
  // Every card is face up: nothing is left to find out, so the game plays itself home.
  const finishing = started && !done && allUp(table);
  const locked = finishing || done;
  const canUndo = game.past.length > 0 && !locked;
  const clock = useStopwatch(focused && started && !done, epoch);

  useEffect(() => () => window.clearTimeout(refuseTimer.current), []);

  useEffect(() => {
    if (!finishing || !focused) return;
    const id = window.setInterval(() => {
      setGame(g => {
        const next = autoStep(g.table);
        // The finish cannot be taken back, so the undo list goes.
        return next ? { table: next, past: [], moves: g.moves + 1, lifted: moved(g.table, next) } : g;
      });
    }, 70);
    return () => window.clearInterval(id);
  }, [finishing, focused]);

  useEffect(() => {
    if (!done) return;
    const secs = Math.floor(clock.read() / 1000);
    const moves = game.moves;
    const old = record0;
    const faster = old.time === undefined || secs < old.time;
    const fewer = old.moves === undefined || moves < old.moves;
    if (faster || fewer) record(b => ({ ...b, solitaire: { time: faster ? secs : b.solitaire.time, moves: fewer ? moves : b.solitaire.moves } }));
    setResult({ secs, moves, best: faster || fewer });
    // Only the moment the game is won matters: the rest is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const start = () => {
    setGame(fresh());
    setEpoch(e => e + 1);
    setPicked(null);
    setResult(null);
    setNote(true);
  };

  const commit = (next: Table) => {
    setGame({ table: next, past: game.past.concat([game.table]), moves: game.moves + 1, lifted: moved(game.table, next) });
    setPicked(null);
  };

  // Undo puts the whole earlier table back: turned cards, stock and waste included. It counts as
  // a move, so the fewest-moves record cannot be had by trying things and taking them back.
  const undo = () => {
    if (!canUndo) return;
    const prev = game.past[game.past.length - 1];
    setGame({ table: prev, past: game.past.slice(0, -1), moves: game.moves + 1, lifted: moved(game.table, prev) });
    setPicked(null);
  };

  const refuse = (id: number) => {
    setRefused(id);
    window.clearTimeout(refuseTimer.current);
    refuseTimer.current = window.setTimeout(() => setRefused(null), 400);
  };

  const turnStock = () => {
    const next = draw(table);
    if (next) commit(next);
    else setPicked(null);
  };

  /** Put the picked card down on `dest`, if the rules allow it. Either way it leaves the hand. */
  const drop = (dest: Dest | null) => {
    const from = picked === null ? null : locate(table, picked);
    const run = from && lift(table, from);
    // Any foundation means "home": a card only ever fits the one of its own suit.
    const to: Dest | null = dest && run && dest.zone === 'found' ? { zone: 'found', n: run[0].suit } : dest;
    const next = from && to ? move(table, from, to) : null;
    if (next) commit(next);
    else setPicked(null);
  };

  const clickCard = (id: number, clicks: number) => {
    const spot = locate(table, id);
    if (!spot) return;
    if (spot.zone === 'stock') return turnStock();
    if (picked !== null && picked !== id) return drop(spot.zone === 'waste' ? null : { zone: spot.zone, n: spot.n });
    // The second click of a double-click lands on whatever the first one uncovered. The first has
    // already sent the card home, so the card under it is left alone.
    if (picked === null && clicks > 1 && performance.now() - sentAt.current < DOUBLE_MS) return;
    setPicked(null);
    // A face-down card is not in play yet.
    if (!lift(table, spot)) return;
    const to = best(table, spot);
    const next = to && move(table, spot, to);
    if (!next) return refuse(id);
    sentAt.current = performance.now();
    commit(next);
  };

  const onClick = (e: MouseEvent) => {
    if (locked) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-card],[data-slot]');
    if (!el) return setPicked(null);
    if (el.dataset.card !== undefined) return clickCard(Number(el.dataset.card), e.detail);
    const zone = el.dataset.slot as Zone;
    if (zone === 'stock') return turnStock();
    if (picked !== null) drop(zone === 'found' || zone === 'pile' ? { zone, n: Number(el.dataset.n) } : null);
  };

  // Right click picks a card up (or puts it back) for a move of the player's own choosing.
  const onPick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (locked) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-card]');
    const id = el ? Number(el.dataset.card) : -1;
    const spot = id >= 0 && id !== picked ? locate(table, id) : null;
    setPicked(spot && lift(table, spot) ? id : null);
  };

  useKeys(focused, e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      undo();
      return true;
    }
    if (e.key === 'Escape' && picked !== null) {
      setPicked(null);
      return true;
    }
    return false;
  });

  const foot = h >= 460 && !done ? FOOT : 0;
  const g = measure(w, h, foot);
  const placed = place(table, g, game.lifted);

  // What is in the hand, and where it could be put down.
  const hand = picked === null ? null : locate(table, picked);
  const run = hand ? lift(table, hand) : null;
  const inHand = new Set(run ? run.map(c => c.id) : []);
  const takes = (zone: Zone, n: number): boolean => {
    if (!hand || !run || (zone !== 'found' && zone !== 'pile')) return false;
    return !(hand.zone === zone && hand.n === n) && fits(table, run, { zone, n });
  };

  return (
    <div ref={root} tabIndex={-1} className="game game-solitaire">
      <div className="sl-rail">
        <span className="sl-plate">{t('ui.games.solitaire_name')}</span>
        <span className="flex-1" />
        <span className="sl-stat" title={t('ui.games.moves')}>
          <small>{t('ui.games.moves')}</small>
          <b>{game.moves}</b>
        </span>
        <span className="sl-stat" title={t('ui.games.time')}>
          <small>{t('ui.games.time')}</small>
          <b>{fmtDuration(result ? result.secs : clock.seconds)}</b>
        </span>
        <span className="flex-1" />
        <button type="button" className="sl-btn" disabled={!canUndo} onClick={undo} {...still}>
          <Undo2 size={15} />
          {t('ui.games.solitaire_undo')}
        </button>
        <button type="button" className="sl-btn" onClick={start} {...still}>
          <Shuffle size={15} />
          {t('ui.games.solitaire_deal')}
        </button>
      </div>

      <div ref={areaRef} className="sl-felt" onClick={onClick} onContextMenu={onPick}>
        {w > 0 && (
          <>
            <Slot zone="stock" n={0} g={g} x={g.col(0)} y={PAD} title={!table.stock.length && table.waste.length ? t('ui.games.solitaire_turn_over') : undefined}>
              {!table.stock.length && table.waste.length > 0 && <RotateCcw size={Math.round(g.cw * 0.32)} />}
            </Slot>
            {table.found.map((_, n) => (
              <Slot key={`f${n}`} zone="found" n={n} g={g} x={g.col(3 + n)} y={PAD} lit={!table.found[n].length && takes('found', n)}>
                <SuitGlyph suit={n} size={Math.round(g.cw * 0.4)} />
              </Slot>
            ))}
            {table.piles.map((_, n) => (
              <Slot key={`p${n}`} zone="pile" n={n} g={g} x={g.col(n)} y={g.rowY} lit={!table.piles[n].length && takes('pile', n)} />
            ))}

            {placed.map(p => (
              <PlayingCard
                key={p.card.id}
                id={p.card.id}
                rank={p.card.rank}
                suit={p.card.suit}
                up={p.card.up}
                x={p.x}
                y={p.y}
                z={p.z}
                w={g.cw}
                h={g.ch}
                mark={inHand.has(p.card.id) ? 'picked' : p.top && takes(p.zone, p.n) ? 'target' : 'none'}
                refused={refused === p.card.id}
                flat={!p.top && p.zone !== 'pile'}
              />
            ))}
          </>
        )}

        {foot > 0 && <div className="sl-hint">{t('ui.games.solitaire_hint')}</div>}

        {done && result && note && (
          <div className="sl-ribbon fade-in">
            <b>{t('ui.games.solitaire_won')}</b>
            <span>{t('ui.games.solitaire_won_body', fmtDuration(result.secs), result.moves) + (result.best ? ' ' + t('ui.games.new_best') : '')}</span>
            <button type="button" className="sl-btn" onClick={start} {...still}>
              <Shuffle size={15} />
              {t('ui.games.solitaire_deal')}
            </button>
            <button type="button" title={t('ui.games.solitaire_look')} aria-label={t('ui.games.solitaire_look')} onClick={() => setNote(false)} {...still}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
