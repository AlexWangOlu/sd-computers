import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { AppProps } from '../registry';
import { useExitFx } from '@/hooks/useExitFx';
import { t } from '@/i18n';
import { useKeys, useSize } from './hooks';
import { SIZE, newSnake, step, tickMs, togglePause, turn, type Dir, type SnakeGame } from './snakeRules';
import { cx, still, useGameWindow } from './shared';
import { useBests } from './storage';

// Snake, as a program of its own: an arcade cabinet's screen. The score and the high score in
// pixel type either side of the name in neon, a black tube with scan lines across it, the snake
// and what it eats glowing on a faint grid, and what a cabinet says between games - PRESS ENTER,
// blinking - laid over the picture. Arrow keys or W A S D steer, Space or P pauses, Enter starts
// again. The rules are in snakeRules.ts: this file runs the tick, which only exists while the game
// is actually running (playing, window focused), reads the keys and draws the board as a grid.

/** Space kept clear round the screen, and the thickness of its bezel. */
const PAD = 14;
const BEZEL = 6;

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

/** What a cell holds (0 = nothing), and the class that draws each. */
const BODY = 1;
const HEAD = 2;
const FOOD = 3;
const LOOK = ['', 'sn-body', 'sn-head', 'sn-food'];

/** One cell of the board. Memoised: a step only changes two or three of the four hundred. */
const Cell = memo(function Cell({ kind }: { kind: number }) {
  return <div className={LOOK[kind]} />;
});

/** A score as a cabinet shows one: five digits, zeros in front. */
const five = (n: number): string => String(Math.min(99999, n)).padStart(5, '0');

export default function Snake({ win }: AppProps) {
  const { root, focused } = useGameWindow(win);
  const best = useBests(s => s.bests.snake.score ?? 0);
  const record = useBests(s => s.record);
  const [game, setGame] = useState<SnakeGame>(newSnake);
  const area = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(area);
  const overExit = useExitFx('fade-out');
  /** The best score when this run began: beating that one is what earns the new high score. */
  const toBeat = useRef(best);

  const { status, score } = game;
  const running = focused && status === 'playing';
  const delay = tickMs(score);

  // The tick. Gone the moment the game stops running: paused, over, behind another window,
  // minimized, or the window closed.
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

  /** Enter, and the button on the screen: start, carry on, or play again. */
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

  const cell = Math.max(8, Math.min(34, Math.floor((Math.min(w, h) - PAD * 2 - BEZEL * 2) / SIZE)));
  const cells = [];
  for (let i = 0; i < kinds.length; i++) cells.push(<Cell key={i} kind={kinds[i]} />);

  const beaten = score > toBeat.current && score > 0;
  const over =
    status === 'ready'
      ? { title: t('ui.games.snake_ready'), pink: false, body: t('ui.games.snake_ready_body'), action: t('ui.games.snake_press_start') }
      : status === 'paused'
        ? { title: t('ui.games.snake_paused'), pink: false, body: t('ui.games.snake_paused_body'), action: t('ui.games.snake_press_resume') }
        : status === 'over'
          ? { title: t(game.food < 0 ? 'ui.games.snake_full' : 'ui.games.snake_over'), pink: true, body: t('ui.games.snake_over_body', score), action: t('ui.games.snake_press_again') }
          : null;

  return (
    <div ref={root} tabIndex={-1} className="game game-snake">
      <div className="sn-top">
        <div className="sn-score">
          <small>{t('ui.games.snake_score')}</small>
          <b>{five(score)}</b>
        </div>
        <div className="sn-logo">{t('ui.games.snake_logo')}</div>
        <div className="sn-score is-right">
          <small>{t('ui.games.snake_hi')}</small>
          <b>{five(Math.max(best, score))}</b>
        </div>
      </div>

      <div ref={area} className="sn-cab">
        <div className="sn-screen" style={{ width: cell * SIZE + BEZEL * 2, height: cell * SIZE + BEZEL * 2 }}>
          <div role="img" aria-label={t('ui.games.snake_name')} className="sn-grid" style={{ gridTemplateColumns: `repeat(${SIZE}, ${cell}px)`, gridAutoRows: cell, backgroundSize: `${cell}px ${cell}px` }}>
            {cells}
          </div>

          {over && (
            <div ref={overExit} className="sn-over fade-in">
              <div className={cx('sn-big', over.pink && 'is-pink')}>{over.title}</div>
              {status === 'over' && beaten && <div className="sn-best">{t('ui.games.snake_new_hi')}</div>}
              <div className="sn-line">{over.body}</div>
              <button type="button" className="sn-press" onClick={advance} {...still}>
                {over.action}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sn-foot">
        <span>
          <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> {t('ui.games.snake_k_move')}
        </span>
        <span>
          <kbd>SPACE</kbd> {t('ui.games.snake_k_pause')}
        </span>
        <button type="button" disabled={status !== 'playing' && status !== 'paused'} onClick={() => setGame(togglePause)} {...still}>
          {t(status === 'paused' ? 'ui.games.snake_resume' : 'ui.games.snake_pause')}
        </button>
        <button type="button" onClick={() => restart(false)} {...still}>
          {t('ui.games.snake_reset')}
        </button>
      </div>
    </div>
  );
}
