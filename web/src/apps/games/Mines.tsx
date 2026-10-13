import { memo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Timer } from 'lucide-react';
import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import { Select } from '@/ui/controls';
import { Banner } from './Banner';
import { Counter, GameBar } from './GameBar';
import { FlagGlyph, MineGlyph } from './glyphs';
import { useSize, useStopwatch } from './hooks';
import { LEVELS, LEVEL_ORDER, chord, flagsLeft, newBoard, open, toggleFlag, type Board, type Level } from './minesRules';
import { cx, type GameProps } from './shared';

/** Space kept clear around the board, and between its cells. */
const PAD = 16;
const GAP = 2;
const MIN_CELL = 12;
const MAX_CELL = 48;
/** Thirty columns of cells smaller than this cannot be read: Expert is not offered then. */
const EXPERT_MIN = 16;

/**
 * Number colours as "r, g, b". Numbers are content and keep their own hues, but no single colour
 * reads on both a dark and a light cell. So each digit is painted with its hue laid over the
 * theme's text colour and clipped to the glyph: it comes out lighter on a dark theme and darker
 * on a light one, in every style, with no theme to check.
 */
const HUES = ['0, 0, 0', '37, 99, 235', '22, 150, 72', '220, 38, 38', '124, 58, 237', '180, 83, 9', '8, 145, 178', '70, 70, 70', '150, 150, 150'];

const INKS: CSSProperties[] = HUES.map(rgb => ({
  backgroundColor: 'var(--text-1)',
  backgroundImage: `linear-gradient(rgba(${rgb}, 0.66), rgba(${rgb}, 0.66))`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}));

type Kind = 'closed' | 'flag' | 'wrong' | 'open' | 'mine' | 'boom';

// A closed cell is a standard button in every style (retro bevels it through the ctl-btn marker);
// an opened one is a shallow well in the window's own surface. The well names its own transition:
// once a cell stops being a button the shared hover/press easing no longer covers it, and it
// should still ease open (retro switches the transition off again).
// On a dark theme a button is only a shade off the window, and so is a well: the tile carries a
// white film (nothing to see on a tile that is white already) and the well is cut a little deeper,
// so which cells are open reads at a glance in every theme.
const TILE =
  'ctl-btn ctl-btn-standard rounded-ctl border border-stroke-strong bg-control bg-[linear-gradient(rgba(255,255,255,0.09),rgba(255,255,255,0.09))] hover:bg-control-hover active:bg-control-press shadow-card';
const WELL = 'rounded-ctl border bg-black/[0.16] transition-colors duration-150';

const Cell = memo(function Cell({ i, kind, near, size }: { i: number; kind: Kind; near: number; size: number }) {
  const raised = kind === 'closed' || kind === 'flag' || kind === 'wrong';
  const glyph = Math.round(size * 0.62);
  return (
    <div data-i={i} className={cx('relative flex items-center justify-center', raised ? TILE : WELL, !raised && (kind === 'boom' ? 'border-critical' : 'border-stroke'))}>
      {kind === 'open' && near > 0 && (
        <span className="font-bold leading-tight fade-in" style={{ fontSize: Math.round(size * 0.6), ...INKS[near] }}>
          {near}
        </span>
      )}
      {kind === 'flag' && <FlagGlyph size={glyph} className="text-critical fade-in" />}
      {kind === 'wrong' && (
        <>
          <FlagGlyph size={glyph} className="text-t3" />
          <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full text-critical fade-in" aria-hidden="true">
            <path d="M5 5L19 19M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </>
      )}
      {kind === 'mine' && <MineGlyph size={glyph} className="text-t1 fade-in" />}
      {kind === 'boom' && <MineGlyph size={glyph} className="text-critical fade-in" />}
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

/**
 * Mines. Left click opens a cell, or the neighbours of an open number that has its flags; right
 * click flags. The rules are in minesRules.ts: this file sizes the board to the window, draws it
 * and keeps the clock, which starts with the first opened cell.
 */
export default function Mines({ focused, bests, record, onBack, level, onLevel }: GameProps & { level: Level; onLevel: (level: Level) => void }) {
  const [board, setBoard] = useState<Board>(() => newBoard(level));
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<{ secs: number; best: boolean } | null>(null);
  const [note, setNote] = useState(true);
  const areaRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(areaRef);
  const clock = useStopwatch(focused && board.status === 'playing', epoch);
  const over = board.status === 'won' || board.status === 'lost';

  /** The largest cell that fits a board of this shape into the space there is. */
  const fit = (cols: number, rows: number) => Math.floor(Math.min((w - PAD * 2 + GAP) / cols, (h - PAD * 2 + GAP) / rows)) - GAP;
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, fit(board.cols, board.rows)));
  const expertFits = w === 0 || fit(LEVELS.expert.cols, LEVELS.expert.rows) >= EXPERT_MIN;
  // A game of Expert already on the board keeps its entry, however small the window gets.
  const levels = LEVEL_ORDER.filter(l => l !== 'expert' || expertFits || board.level === 'expert');

  const start = (next: Level) => {
    if (next !== level) onLevel(next);
    setBoard(newBoard(next));
    setEpoch(e => e + 1);
    setResult(null);
    setNote(true);
  };

  const apply = (next: Board) => {
    if (next === board) return;
    setBoard(next);
    if (next.status !== 'won') return;
    const secs = Math.floor(clock.read() / 1000);
    const old = bests.mines[next.level];
    const best = old === undefined || secs < old;
    if (best) record(b => ({ ...b, mines: { ...b.mines, [next.level]: secs } }));
    setResult({ secs, best });
  };

  // One listener for the whole board: each cell names itself with data-i.
  const cellAt = (e: MouseEvent): number => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : -1;
  };
  const onOpen = (e: MouseEvent) => {
    const i = cellAt(e);
    if (i >= 0) apply(board.open[i] ? chord(board, i) : open(board, i));
  };
  // Right click never opens a menu here, on a cell or between two.
  const onFlag = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const i = cellAt(e);
    if (i >= 0) apply(toggleFlag(board, i));
  };

  const cells = [];
  for (let i = 0; i < board.open.length; i++) cells.push(<Cell key={i} i={i} kind={kindOf(board, i)} near={board.near[i]} size={cell} />);

  return (
    <div className="h-full w-full flex flex-col page-in">
      <GameBar title={t('ui.games.mines_name')} narrow={w < 700} onBack={onBack} onNew={() => start(board.level)}>
        <Counter icon={<MineGlyph size={14} />} label={t('ui.games.mines_left')} value={flagsLeft(board)} />
        <Counter icon={<Timer size={14} />} label={t('ui.games.time')} value={fmtDuration(result ? result.secs : clock.seconds)} />
        <div className="shrink-0 w-[132px]">
          <Select
            className="!h-7"
            title={t('ui.games.mines_level')}
            value={board.level}
            onChange={e => {
              // Let go of the list, so the arrow keys do not flick through difficulties afterwards.
              e.currentTarget.blur();
              start(e.target.value as Level);
            }}
          >
            {levels.map(l => (
              <option key={l} value={l}>
                {t(`ui.games.mines_${l}`)}
              </option>
            ))}
          </Select>
        </div>
      </GameBar>

      <div ref={areaRef} className="relative flex-1 min-h-0 flex overflow-auto os-scroll" onContextMenu={onFlag}>
        <div
          role="grid"
          aria-label={t('ui.games.mines_name')}
          // A finished board is only looked at: no hover, no press.
          className={cx('m-auto shrink-0 grid', over && 'pointer-events-none')}
          style={{ gridTemplateColumns: `repeat(${board.cols}, ${cell}px)`, gridAutoRows: cell, gap: GAP }}
          onClick={onOpen}
        >
          {cells}
        </div>

        {over && note && (
          <Banner tone={board.status === 'won' ? 'success' : 'error'} title={t(board.status === 'won' ? 'ui.games.mines_won' : 'ui.games.mines_lost')} onClose={() => setNote(false)}>
            {board.status === 'won' && result
              ? t('ui.games.mines_won_body', fmtDuration(result.secs)) + (result.best ? ' ' + t('ui.games.new_best') : '')
              : t('ui.games.mines_lost_body')}
          </Banner>
        )}
      </div>
    </div>
  );
}
