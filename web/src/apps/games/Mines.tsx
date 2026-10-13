import { memo, useRef, useState, type MouseEvent } from 'react';
import { Bomb, Check, Skull, X } from 'lucide-react';
import type { AppProps } from '../registry';
import { desktopBounds, useOS, type Win } from '@/store/os';
import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import { FlagGlyph, MineGlyph } from './glyphs';
import { useSize, useStopwatch } from './hooks';
import { Led } from './Led';
import { LEVEL_ORDER, chord, flagsLeft, newBoard, open, toggleFlag, type Board, type Level } from './minesRules';
import { cx, still, useGameWindow } from './shared';
import { useBests } from './storage';

// Mines, as a program of its own: a bomb-disposal console. Hazard stripes across the top, a
// gunmetal panel with two amber readouts (mines left, seconds) either side of a lamp that starts
// the field again, three switches for the difficulty, and the field itself - steel plates over a
// dark bed. Left click opens a cell, or the neighbours of an open number that has its flags; right
// click flags. The rules are in minesRules.ts: this file sizes the field to the window (and the
// window to the difficulty), draws it and keeps the clock, which starts with the first cell opened.

/** Space kept clear round the field, between its cells, and the bed's own edge. */
const PAD = 14;
const GAP = 2;
const EDGE = 7;
const MIN_CELL = 12;
const MAX_CELL = 44;

/** How large the window makes itself for each difficulty (as far as the desktop has the room). */
const WINDOW: Record<Level, { w: number; h: number }> = {
  beginner: { w: 470, h: 640 },
  intermediate: { w: 680, h: 850 },
  expert: { w: 1120, h: 850 },
};

/** The difficulty the last field was on: a new window opens on it. */
let lastLevel: Level = 'beginner';

/** What a number is painted in, by how many mines it counts. Lit colours: they sit on the dark bed. */
const INKS = ['', '#5cc8ff', '#5ee38a', '#ff6b6b', '#c79bff', '#ffb454', '#4fe3d4', '#f2f2f2', '#9aa4b2'];

type Kind = 'closed' | 'flag' | 'wrong' | 'open' | 'mine' | 'boom';

const Cell = memo(function Cell({ i, kind, near, size }: { i: number; kind: Kind; near: number; size: number }) {
  const up = kind === 'closed' || kind === 'flag' || kind === 'wrong';
  const glyph = Math.round(size * 0.62);
  return (
    <div data-i={i} className={cx('mn-cell', up ? 'is-up' : kind === 'boom' ? 'is-boom' : 'is-down')}>
      {kind === 'open' && near > 0 && (
        <span className="mn-num fade-in" style={{ fontSize: Math.round(size * 0.62), color: INKS[near] }}>
          {near}
        </span>
      )}
      {kind === 'flag' && <FlagGlyph size={glyph} className="fade-in" color="#ff7a1a" />}
      {kind === 'wrong' && (
        <>
          <FlagGlyph size={glyph} color="#8b96a3" />
          <X size={size} strokeWidth={2.5} className="absolute fade-in" color="#ff4d4d" />
        </>
      )}
      {kind === 'mine' && <MineGlyph size={glyph} className="fade-in" color="#c9d1d9" />}
      {kind === 'boom' && <MineGlyph size={glyph} className="fade-in" color="#140402" />}
    </div>
  );
});

/** What a cell shows. After a loss every mine is uncovered and every flag on a safe cell is crossed out. */
function kindOf(b: Board, i: number): Kind {
  if (b.open[i]) return 'open';
  if (b.status === 'lost') {
    if (i === b.boom) return 'boom';
    if (b.mine[i]) return b.flag[i] ? 'flag' : 'mine';
    if (b.flag[i]) return 'wrong';
  }
  return b.flag[i] ? 'flag' : 'closed';
}

/** Give the window the size a difficulty wants, where the desktop has it and the window is not maximized. */
function sizeWindow(win: Win, level: Level): void {
  if (win.max) return;
  const b = desktopBounds();
  const w = Math.min(WINDOW[level].w, b.w - 16);
  const h = Math.min(WINDOW[level].h, b.h - 16);
  const x = Math.max(8, Math.min(win.x, b.w - w - 8));
  const y = Math.max(8, Math.min(win.y, b.h - h - 8));
  if (w !== win.w || h !== win.h || x !== win.x || y !== win.y) useOS.getState().resize(win.id, x, y, w, h);
}

/** A number on a readout: three digits, held at 999, a minus for more flags than mines. */
const three = (n: number): string => (n < 0 ? `-${String(Math.min(99, -n)).padStart(2, '0')}` : String(Math.min(999, n)).padStart(3, '0'));

export default function Mines({ win }: AppProps) {
  const { root, focused } = useGameWindow(win);
  const best = useBests(s => s.bests.mines);
  const record = useBests(s => s.record);
  const [board, setBoard] = useState<Board>(() => newBoard(lastLevel));
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<{ secs: number; best: boolean } | null>(null);
  const [note, setNote] = useState(true);
  const area = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(area);
  const clock = useStopwatch(focused && board.status === 'playing', epoch);
  const over = board.status === 'won' || board.status === 'lost';

  /** The largest cell that fits this field into the space there is. */
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(Math.min((w - PAD * 2 - EDGE * 2 + GAP) / board.cols, (h - PAD * 2 - EDGE * 2 + GAP) / board.rows)) - GAP));

  const start = (level: Level) => {
    if (level !== board.level) sizeWindow(win, level);
    lastLevel = level;
    setBoard(newBoard(level));
    setEpoch(e => e + 1);
    setResult(null);
    setNote(true);
  };

  const apply = (next: Board) => {
    if (next === board) return;
    setBoard(next);
    if (next.status !== 'won') return;
    const secs = Math.floor(clock.read() / 1000);
    const old = best[next.level];
    const beaten = old === undefined || secs < old;
    if (beaten) record(b => ({ ...b, mines: { ...b.mines, [next.level]: secs } }));
    setResult({ secs, best: beaten });
  };

  // One listener for the whole field: each cell names itself with data-i.
  const cellAt = (e: MouseEvent): number => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : -1;
  };
  const onOpen = (e: MouseEvent) => {
    if (over) return;
    const i = cellAt(e);
    if (i >= 0) apply(board.open[i] ? chord(board, i) : open(board, i));
  };
  // Right click never opens a menu here, on a cell or between two.
  const onFlag = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (over) return;
    const i = cellAt(e);
    if (i >= 0) apply(toggleFlag(board, i));
  };

  const cells = [];
  for (let i = 0; i < board.open.length; i++) cells.push(<Cell key={i} i={i} kind={kindOf(board, i)} near={board.near[i]} size={cell} />);

  const record0 = best[board.level];
  const won = board.status === 'won';

  return (
    <div ref={root} tabIndex={-1} className="game game-mines">
      <div className="mn-stripe" />
      <div className="mn-panel">
        <div className="mn-read">
          <span className="mn-cap">{t('ui.games.mines_left')}</span>
          <span className="mn-led" title={t('ui.games.mines_left')}>
            <Led text={three(flagsLeft(board))} />
          </span>
        </div>
        <button type="button" className={cx('mn-lamp', won && 'is-won', board.status === 'lost' && 'is-lost')} title={t('ui.games.new_game')} aria-label={t('ui.games.new_game')} onClick={() => start(board.level)} {...still}>
          {won ? <Check size={24} strokeWidth={3} /> : board.status === 'lost' ? <Skull size={24} /> : <Bomb size={22} />}
        </button>
        <div className="mn-read items-end">
          <span className="mn-cap">{t('ui.games.time')}</span>
          <span className="mn-led" title={t('ui.games.time')}>
            <Led text={three(result ? result.secs : clock.seconds)} />
          </span>
        </div>
      </div>

      <div className="mn-levels">
        {LEVEL_ORDER.map(l => (
          <button key={l} type="button" className={cx('mn-level', board.level === l && 'is-on')} onClick={() => start(l)} {...still}>
            {t(`ui.games.mines_${l}`)}
          </button>
        ))}
      </div>

      <div ref={area} className="mn-field os-scroll" onContextMenu={onFlag}>
        <div
          role="grid"
          aria-label={t('ui.games.mines_name')}
          className={cx('mn-board', over && 'is-over')}
          style={{ gridTemplateColumns: `repeat(${board.cols}, ${cell}px)`, gridAutoRows: cell, gap: GAP, padding: EDGE - 1 }}
          onClick={onOpen}
        >
          {cells}
        </div>

        {over && note && (
          <div className={cx('mn-plate fade-in', !won && 'is-lost')}>
            <div className="min-w-0">
              <div className="mn-plate-title">{t(won ? 'ui.games.mines_won' : 'ui.games.mines_lost')}</div>
              <div className="mn-plate-body">
                {won && result ? t('ui.games.mines_won_body', fmtDuration(result.secs)) + (result.best ? ' ' + t('ui.games.new_best') : '') : t('ui.games.mines_lost_body')}
              </div>
            </div>
            <button type="button" onClick={() => start(board.level)} {...still}>
              {t(won ? 'ui.games.play_again' : 'ui.games.mines_retry')}
            </button>
            <button type="button" className="!border-0 !px-1" title={t('ui.games.mines_look')} aria-label={t('ui.games.mines_look')} onClick={() => setNote(false)} {...still}>
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>

      <div className="mn-foot">
        <span>
          {t('ui.games.best')} <b>{record0 === undefined ? '--:--' : fmtDuration(record0)}</b>
        </span>
        <span className="truncate">{t('ui.games.mines_help')}</span>
      </div>
    </div>
  );
}
