import type { ReactNode } from 'react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import { MineGlyph, SuitGlyph } from './glyphs';
import { Led } from './Led';
import { LEVEL_ORDER } from './minesRules';
import { GAME_IDS, gameWindowId, openGame, type GameId } from './shared';
import { useBests, type Bests } from './storage';

// Games: the shelf. The games themselves are programs of their own - Mines, Solitaire and Snake
// each open in a window of their own, with a look of their own (Mines.tsx, Solitaire.tsx,
// Snake.tsx and src/styles/games.css) - and this window only has them on it: a box for each, drawn
// the way that game looks, with the best the player has done at it. Nothing here talks to the
// server. Each game keeps its rules in a file of their own (minesRules.ts, solitaireRules.ts,
// snakeRules.ts); the best results they share are in storage.ts.

/** The player's best in each game, as one line under its box. */
function bestLine(id: GameId, bests: Bests): string {
  if (id === 'mines') {
    const won = LEVEL_ORDER.filter(l => bests.mines[l] !== undefined);
    return won.length ? won.map(l => `${t(`ui.games.mines_${l}`)} ${fmtDuration(bests.mines[l] as number)}`).join(' · ') : t('ui.games.no_wins');
  }
  if (id === 'solitaire') {
    const { time, moves } = bests.solitaire;
    const parts: string[] = [];
    if (time !== undefined) parts.push(t('ui.games.best_time', fmtDuration(time)));
    if (moves !== undefined) parts.push(t('ui.games.best_moves', moves));
    return parts.length ? parts.join(' · ') : t('ui.games.no_wins');
  }
  return bests.snake.score ? t('ui.games.best_score', bests.snake.score) : t('ui.games.no_score');
}

/** A playing card small enough for a box lid. */
function MiniCard({ rank, suit, turn, x }: { rank: string; suit: number; turn: number; x: number }) {
  return (
    <div
      className="absolute flex flex-col items-center justify-center gap-0.5 font-bold"
      style={{ left: `${x}%`, top: '24%', width: '36%', aspectRatio: '5 / 7', transform: `rotate(${turn}deg)`, borderRadius: 6, background: 'linear-gradient(160deg, #fffdf7, #f1ecdd)', border: '1px solid rgba(0,0,0,0.35)', boxShadow: '0 4px 10px rgba(0,0,0,0.45)', color: suit === 1 || suit === 2 ? '#c5221f' : '#1b1b1f', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, lineHeight: 1 }}
    >
      <span>{rank}</span>
      <SuitGlyph suit={suit} size={22} />
    </div>
  );
}

/** The snake on Snake's box: a few lit squares of it, and what it is after. */
const SNAKE_BITS: [number, number][] = [
  [2, 6],
  [3, 6],
  [4, 6],
  [4, 5],
  [4, 4],
  [5, 4],
  [6, 4],
  [6, 3],
];

/** Each game's box, drawn the way the game itself looks. */
const COVERS: Record<GameId, ReactNode> = {
  mines: (
    <>
      <div className="absolute inset-x-0 flex justify-center" style={{ top: '20%' }}>
        <MineGlyph size={96} color="#ff5a3c" style={{ filter: 'drop-shadow(0 0 16px rgba(255, 90, 60, 0.7))' }} />
      </div>
      <div className="absolute inset-x-0 flex justify-center" style={{ top: '60%' }}>
        <span className="mn-led">
          <Led text="010" height={24} />
        </span>
      </div>
    </>
  ),
  solitaire: (
    <>
      <MiniCard rank="K" suit={1} turn={-14} x={12} />
      <MiniCard rank="Q" suit={0} turn={0} x={32} />
      <MiniCard rank="A" suit={2} turn={14} x={52} />
    </>
  ),
  snake: (
    <svg viewBox="0 0 10 10" className="absolute" style={{ left: '8%', right: '8%', top: '10%', width: '84%' }} aria-hidden>
      {SNAKE_BITS.map(([x, y], i) => (
        <rect key={i} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.12} fill={i === SNAKE_BITS.length - 1 ? '#b6ffd0' : '#39ff7a'} style={{ filter: 'drop-shadow(0 0 0.25px #39ff7a)' }} />
      ))}
      <rect x={7.6} y={1.6} width={0.7} height={0.7} fill="#ff3ea5" transform="rotate(45 7.95 1.95)" style={{ filter: 'drop-shadow(0 0 0.3px #ff3ea5)' }} />
    </svg>
  ),
};

export default function Games() {
  const bests = useBests(s => s.bests);
  const windows = useOS(s => s.windows);

  return (
    <div className="h-full w-full overflow-y-auto os-scroll bg-win text-t1 select-none page-in">
      <div className="mx-auto max-w-[780px] px-7 py-6">
        <div className="text-subtitle font-semibold text-t1">{t('ui.games.pick')}</div>
        <div className="mt-0.5 text-body text-t2">{t('ui.games.pick_hint')}</div>
        <div className="stagger mt-5 grid grid-cols-3 gap-6">
          {GAME_IDS.map(id => {
            const running = windows.some(w => w.id === gameWindowId(id));
            return (
              <button key={id} type="button" onClick={() => openGame(id)} className="flex min-w-0 cursor-pointer flex-col gap-3 text-left">
                <div className={`gm-cover gm-cover-${id}`}>
                  {COVERS[id]}
                  <div className="gm-cover-title">{t(`ui.games.${id}_logo`)}</div>
                </div>
                <div className="min-w-0 px-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-semibold text-t1">{t(`ui.games.${id}_name`)}</span>
                    {running && <span className="text-caption text-accent-text">{t('ui.games.running')}</span>}
                  </div>
                  <div className="mt-0.5 text-caption text-t2">{t(`ui.games.${id}_blurb`)}</div>
                  <div className="mt-1.5 text-caption text-t3">{bestLine(id, bests)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
