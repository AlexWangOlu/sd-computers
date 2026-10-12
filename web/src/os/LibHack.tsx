import { useCallback, useRef } from 'react';
import type { HackRun } from '@/types';
import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import HackRunner, { libHackApi, type HackResult } from '@/apps/hack/HackRunner';
import { useExitFx } from '@/hooks/useExitFx';
import { accentVars } from './theme';
import { AppIcon, GlyphClose } from './icons';

/**
 * The StartHack export's window: a standalone "hack.exe" window over a dimmed screen,
 * usable with no computer open (a heist panel, a phone app, ...). Reports the outcome to the
 * client (computers:lib:done) which resolves the export's promise; closing it is a loss.
 */
export default function LibHack({ run, onClose }: { run: HackRun; onClose: () => void }) {
  const reported = useRef(false);
  const exitRef = useExitFx('fade-out');

  const finish = useCallback(
    (r: HackResult) => {
      if (reported.current) return;
      reported.current = true;
      if (!isEnvBrowser()) void fetchNui('computers:lib:done', { won: r.won, proof: r.data?.proof });
      else console.info('[mock] StartHack result', r);
      onClose();
    },
    [onClose],
  );

  const title = run.title ? `${run.title} - ${run.program}` : run.program;
  return (
    <div ref={exitRef} className="lib-root absolute inset-0 z-[10000] flex items-center justify-center bg-black/55 fade-in" style={accentVars('#4cc2ff', 'dark')}>
      <div className="w-[min(1180px,96vw)] h-[min(760px,92vh)] flex flex-col rounded-win overflow-hidden bg-win shadow-win win-enter font-ui text-t1">
        <div className="h-8 shrink-0 flex items-center select-none">
          <span className="pl-3 pr-2 flex items-center"><AppIcon app="hack" size={16} /></span>
          <span className="flex-1 truncate text-caption">{title}</span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => finish({ won: false, aborted: true })}
            className="w-[46px] h-8 flex items-center justify-center transition-colors duration-150 hover:bg-[#c42b1c] hover:text-white"
          >
            <GlyphClose />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <HackRunner run={run} api={libHackApi} onDone={finish} />
        </div>
      </div>
    </div>
  );
}
