import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Star, Trophy } from 'lucide-react';
import { useExitFx } from '@/hooks/useExitFx';
import { t } from '@/i18n';
import { Button, IconButton } from '@/ui/controls';
import { Counter, GameBar } from './GameBar';
import { useKeys, useSize } from './hooks';
import { SIZE, newSnake, step, tickMs, togglePause, turn, type Dir, type SnakeGame } from './snakeRules';
import { still, type GameProps } from './shared';

/** Space kept clear around the board. */
const PAD = 16;

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/** Faint lines between the cells, so distances can be judged. */
const LINES = 'linear-gradient(to right, var(--stroke) 1px, transparent 1px), linear-gradient(to bottom, var(--stroke) 1px, transparent 1px)';

const EMPTY = 0;
const BODY = 1;
const HEAD = 2;
const FOOD = 3;

/** One cell of the board. Memoised: a step only changes two or three of the four hundred. */
const Cell = memo(function Cell({ kind }: { kind: number }) {
  if (kind === EMPTY) return <div />;
  if (kind === FOOD) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-3/5 w-3/5 rounded-full bg-critical" />
      </div>
    );
  }
  return (
    <div className="p-px">
      <div className="flex h-full w-full items-center justify-center rounded-sm bg-accent">{kind === HEAD && <div className="h-1/3 w-1/3 rounded-full bg-accent-on" />}</div>
    </div>
  );
});

/**
 * Snake. Arrow keys or W A S D steer, Space or P pauses, Enter starts again. The rules are in
 * snakeRules.ts: this file runs the tick, which only exists while the game is actually running
 * (playing, window focused), reads the keys and draws the board as a grid of cells.
 */
export default function Snake({ focused, bests, record, onBack }: GameProps) {
  const [game, setGame] = useState<SnakeGame>(newSnake);
  const areaRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(areaRef);
  const panelExit = useExitFx('fade-out');
  const best = bests.snake.score ?? 0;
  /** The best score when this run began: beating that one is what earns "New best!". */
  const toBeat = useRef(best);

  const { status, score } = game;
  const running = focused && status === 'playing';
  const delay = tickMs(score);

  // The tick. Gone the moment the game stops running: paused, over, behind another window,
  // minimized, or the app closed.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setGame(step), delay);
    return () => window.clearInterval(id);
  }, [running, delay]);

  // A game left for another window waits paused, instead of carrying on the moment you come back.
  useEffect(() => {
    if (!focused) setGame(g => (g.status === 'playing' ? { ...g, status: 'paused' } : g));
  }, [focused]);

  useEffect(() => {
    if (score > best) record(b => ({ ...b, snake: { score } }));
  }, [score, best, record]);

  const restart = (go: boolean) => {
    toBeat.current = best;
    setGame(go ? { ...newSnake(), status: 'playing' } : newSnake());
  };

  /** Enter, and the button on the board: start, carry on, or play again. */
  const advance = () => {
    if (status === 'over') restart(true);
    else if (status !== 'playing') setGame(togglePause);
  };

  useKeys(focused, e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dir = KEYS[key];
    if (dir) {
      // Paused or over, a steering key still belongs to the game and is kept from the page.
      setGame(g => turn(g, dir));
      return true;
    }
    if (key === ' ' || key === 'p') {
      if (status === 'over') return false;
      setGame(togglePause);
      return true;
    }
    if (key === 'Enter' && status !== 'playing') {
      advance();
      return true;
    }
    return false;
  });

  const kinds = useMemo(() => {
    const k = new Uint8Array(SIZE * SIZE);
    game.body.forEach((c, i) => (k[c] = i === 0 ? HEAD : BODY));
    if (game.food >= 0) k[game.food] = FOOD;
    return k;
  }, [game.body, game.food]);

  const cell = Math.max(8, Math.min(34, Math.floor((Math.min(w, h) - PAD * 2) / SIZE)));
  const cells = [];
  for (let i = 0; i < kinds.length; i++) cells.push(<Cell key={i} kind={kinds[i]} />);

  const beaten = score > toBeat.current;
  const panel =
    status === 'ready'
      ? { title: t('ui.games.snake_ready'), body: t('ui.games.snake_ready_body'), action: t('ui.games.snake_start') }
      : status === 'paused'
        ? { title: t('ui.games.snake_paused'), body: t('ui.games.snake_paused_body'), action: t('ui.games.snake_resume') }
        : status === 'over'
          ? {
              title: t(game.food < 0 ? 'ui.games.snake_full' : 'ui.games.snake_over'),
              body: t('ui.games.snake_over_body', score) + (beaten ? ' ' + t('ui.games.new_best') : ''),
              action: t('ui.games.play_again'),
            }
          : null;

  return (
    <div className="h-full w-full flex flex-col page-in">
      <GameBar title={t('ui.games.snake_name')} narrow={w < 700} onBack={onBack} onNew={() => restart(false)}>
        <Counter icon={<Star size={14} />} label={t('ui.games.score')} value={score} />
        <Counter icon={<Trophy size={14} />} label={t('ui.games.best')} value={Math.max(best, score)} />
        <IconButton
          title={t(status === 'paused' ? 'ui.games.snake_resume' : 'ui.games.snake_pause')}
          disabled={status !== 'playing' && status !== 'paused'}
          onClick={() => setGame(togglePause)}
          {...still}
        >
          {status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
        </IconButton>
      </GameBar>

      <div ref={areaRef} className="relative flex-1 min-h-0 flex overflow-auto os-scroll">
        {/* Two pixels more than the cells: the border is inside the box. */}
        <div className="relative m-auto shrink-0 overflow-hidden rounded-win border border-stroke-strong bg-black/10" style={{ width: cell * SIZE + 2, height: cell * SIZE + 2 }}>
          <div
            role="img"
            aria-label={t('ui.games.snake_name')}
            className="grid"
            style={{ gridTemplateColumns: `repeat(${SIZE}, ${cell}px)`, gridAutoRows: cell, backgroundImage: LINES, backgroundSize: `${cell}px ${cell}px` }}
          >
            {cells}
          </div>

          {panel && (
            <div ref={panelExit} className="absolute inset-0 flex items-center justify-center p-3 fade-in">
              <div className="max-w-full rounded-win border border-stroke bg-layer px-5 py-4 text-center shadow-flyout">
                <div className="text-body font-semibold text-t1">{panel.title}</div>
                <div className="mx-auto mt-1 max-w-[260px] text-caption text-t2">{panel.body}</div>
                <div className="mt-3 flex justify-center">
                  <Button variant="accent" compact onClick={advance} {...still}>
                    {panel.action}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
