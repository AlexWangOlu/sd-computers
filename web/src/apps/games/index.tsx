import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AppProps } from '../registry';
import { useOS, selectActiveId } from '@/store/os';
import Launcher from './Launcher';
import Mines from './Mines';
import type { Level } from './minesRules';
import type { GameId } from './shared';
import Snake from './Snake';
import Solitaire from './Solitaire';
import { loadBests, saveBests, type Bests } from './storage';

/**
 * Games: a launcher and three classics (Mines, Solitaire, Snake) in one window. Nothing here talks
 * to the server. Each game keeps its rules in a file of their own (minesRules.ts,
 * solitaireRules.ts, snakeRules.ts) and its drawing in another; this file only decides which one
 * is on screen, holds the best results they share, and tells them whether the window is focused:
 * keys count and clocks run only then.
 */
export default function Games({ win }: AppProps) {
  const [playing, setPlaying] = useState<GameId | null>(null);
  // Mines' difficulty outlives a trip back to the launcher.
  const [level, setLevel] = useState<Level>('beginner');
  const [bests, setBests] = useState<Bests>(loadBests);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = useOS(selectActiveId) === win.id;
  // The shell's own menus take the keyboard while they are up, so the games wait for them too.
  const shellMenu = useOS(s => s.start || s.flyout !== null);
  const focused = active && !win.min && !shellMenu;

  // Written back whenever a game changes them, and not before: opening the app stores nothing.
  const stored = useRef(bests);
  useEffect(() => {
    if (bests === stored.current) return;
    stored.current = bests;
    saveBests(bests);
  }, [bests]);

  const record = useCallback((change: (b: Bests) => Bests) => setBests(change), []);
  const home = useCallback(() => setPlaying(null), []);

  // The games are played from the keyboard with nothing in them holding the focus. So when this
  // window comes to the front the app takes it: otherwise the keys would keep landing in a text
  // box left focused in another window. A layout effect, so it happens before the click that
  // brought the window forward gets to focus whatever it was aimed at.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (focused && root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
  }, [focused]);

  const game = { focused, bests, record, onBack: home };

  return (
    <div ref={rootRef} tabIndex={-1} className="relative isolate h-full w-full overflow-hidden bg-win text-t1 outline-none select-none">
      {playing === null && <Launcher bests={bests} onPlay={setPlaying} />}
      {playing === 'mines' && <Mines {...game} level={level} onLevel={setLevel} />}
      {playing === 'solitaire' && <Solitaire {...game} />}
      {playing === 'snake' && <Snake {...game} />}
    </div>
  );
}
