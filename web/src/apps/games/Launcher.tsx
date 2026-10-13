import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import { LEVEL_ORDER } from './minesRules';
import { MinesPreview, SnakePreview, SolitairePreview } from './previews';
import type { GameId } from './shared';
import type { Bests } from './storage';

/** The player's best in each game, as one line for its tile. */
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

const TILES: { id: GameId; preview: ReactNode }[] = [
  { id: 'mines', preview: <MinesPreview /> },
  { id: 'solitaire', preview: <SolitairePreview /> },
  { id: 'snake', preview: <SnakePreview /> },
];

/** The first page: a tile for each game with a small picture of it, its name and the player's best. */
export default function Launcher({ bests, onPlay }: { bests: Bests; onPlay: (id: GameId) => void }) {
  return (
    <div className="h-full w-full overflow-y-auto os-scroll page-in">
      <div className="mx-auto max-w-[860px] px-6 py-5">
        <div className="text-subtitle font-semibold text-t1">{t('ui.games.pick')}</div>
        <div className="mt-0.5 text-body text-t2">{t('ui.games.pick_hint')}</div>
        <div className="stagger mt-4 grid grid-cols-3 gap-3">
          {TILES.map(tile => (
            <button
              key={tile.id}
              type="button"
              onClick={() => onPlay(tile.id)}
              className="ctl-card flex min-w-0 cursor-pointer flex-col gap-3 rounded-win border border-stroke bg-card p-3 text-left hover:bg-card-hover"
            >
              <div className="flex h-[104px] items-center justify-center overflow-hidden rounded-ctl border border-stroke bg-layer p-3">{tile.preview}</div>
              <div className="min-w-0">
                <div className="text-body font-semibold text-t1">{t(`ui.games.${tile.id}_name`)}</div>
                <div className="mt-0.5 text-caption text-t2">{t(`ui.games.${tile.id}_blurb`)}</div>
                <div className="mt-2 text-caption text-t3">{bestLine(tile.id, bests)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
