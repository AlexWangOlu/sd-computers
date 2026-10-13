import { useCallback } from 'react';
import type { HackRun } from '@/types';
import { useOS, selectActiveId } from '@/store/os';
import type { AppProps } from '../registry';
import HackRunner, { desktopHackApi, type HackResult } from './HackRunner';

/**
 * A "hack.exe" window on the desktop (opened by Command Prompt). Its run + the result callback
 * ride in win.props: { run: HackRun, onResult: (r: HackResult) => void }. Keys only reach the
 * game while this window is the focused one. The wrapper (no box of its own) keeps the system's
 * click sound out of the game (os/sfx.ts).
 */
export default function HackWindow({ win }: AppProps) {
  const run = win.props?.run as HackRun | undefined;
  const onResult = win.props?.onResult as ((r: HackResult) => void) | undefined;
  const active = useOS(s => selectActiveId(s) === win.id);

  const done = useCallback(
    (r: HackResult) => {
      onResult?.(r);
      if (!r.aborted) useOS.getState().close(win.id);
    },
    [onResult, win.id],
  );

  if (!run) return null;
  return (
    <div data-sfx="off" className="contents">
      <HackRunner run={run} api={desktopHackApi} onDone={done} inputEnabled={active} />
    </div>
  );
}
