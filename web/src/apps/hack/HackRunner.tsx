import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import type { HackRun, RpcResult } from '@/types';
import { rpc } from '@/nui/rpc';
import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import { mockRpc } from '@/nui/mock';
import { t } from '@/i18n';
import {
  BreakoutGame, CipherGame, DodgerGame, MazeGame, NodeCaptureGame, PipeGame, SignalGame, SnakeGame, SpaceInvadersGame, TypingGame,
  CANVAS_W,
} from '@/components/minigames';
import { setGameInput } from '@/components/minigames/core/inputGate';

/** config.Hacks.Games key -> the sd-deaddrop minigame component that plays it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GAMES: Record<string, ComponentType<any>> = {
  maze: MazeGame,
  capture: NodeCaptureGame,
  cipher: CipherGame,
  snake: SnakeGame,
  firewall: SpaceInvadersGame,
  evasion: DodgerGame,
  typing: TypingGame,
  signal: SignalGame,
  pipe: PipeGame,
  breakout: BreakoutGame,
};

/** What redeeming a run returns (hacks.lua submit): breach progress, or a library proof. */
export type SubmitData = { done?: boolean; next?: number; total?: number; proof?: string };

/** Where a run's milestones/submit/fail go: the desktop's rpc (CMD) or the library passthroughs. */
export interface HackApi {
  advance: (token: number, step: number, payload?: unknown) => Promise<RpcResult>;
  submit: (token: number) => Promise<RpcResult<SubmitData>>;
  fail: (token: number) => Promise<RpcResult>;
}

/** Command Prompt runs: through the session-guarded rpc (server hacks.lua 'hack:*'). */
export const desktopHackApi: HackApi = {
  advance: (token, step, payload) => rpc('hack:advance', { token, step, payload }),
  submit: token => rpc<SubmitData>('hack:submit', { token }),
  fail: token => rpc('hack:fail', { token }),
};

/** StartHack-export runs (no computer session): the client's computers:lib:* passthroughs. */
export const libHackApi: HackApi = {
  advance: async (token, step, payload) =>
    isEnvBrowser() ? mockRpc('hack:advance', { token, step, payload }) : (await fetchNui<RpcResult>('computers:lib:advance', { token, step, payload })) ?? { ok: false },
  submit: async token =>
    isEnvBrowser() ? mockRpc<SubmitData>('hack:submit', { token, lib: true }) : (await fetchNui<RpcResult<SubmitData>>('computers:lib:submit', { token })) ?? { ok: false },
  fail: async token => (isEnvBrowser() ? mockRpc('hack:fail', { token }) : (await fetchNui<RpcResult>('computers:lib:fail', { token })) ?? { ok: false }),
};

export interface HackResult {
  won: boolean;
  data?: SubmitData;
  error?: string;
  /** closed before the game ended */
  aborted?: boolean;
}

/** Natural size of a minigame's GameShell (canvas + HUD + event log). */
const NATURAL_W = CANVAS_W + 40;
const NATURAL_H = 690;

/**
 * Plays one server-issued run: mounts the right minigame with the run's params + server-seeded
 * challenge, forwards each milestone IN ORDER (a promise chain - the server rejects out-of-order
 * steps), and on a win waits for every milestone to land before redeeming the token. Unmounting
 * mid-game counts as a fail. `inputEnabled` gates the game's global key listeners (false while
 * another desktop window has focus). Scales the fixed-size game down to fit small windows.
 */
export default function HackRunner({ run, api, onDone, inputEnabled = true }: { run: HackRun; api: HackApi; onDone: (r: HackResult) => void; inputEnabled?: boolean }) {
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const finished = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setGameInput(inputEnabled);
  }, [inputEnabled]);
  useEffect(() => () => setGameInput(true), []);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / NATURAL_W, el.clientHeight / NATURAL_H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onProgress = useCallback(
    (step: number, payload?: unknown) => {
      chain.current = chain.current.then(() => api.advance(run.token, step, payload)).catch(() => undefined);
    },
    [api, run.token],
  );

  const onWin = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    await chain.current;
    const res = await api.submit(run.token);
    doneRef.current({ won: res.ok, data: res.data, error: res.error });
  }, [api, run.token]);

  const onFail = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    await api.fail(run.token);
    doneRef.current({ won: false });
  }, [api, run.token]);

  // Closing the window mid-game is a loss (and frees the server-side token).
  useEffect(
    () => () => {
      if (finished.current) return;
      finished.current = true;
      void api.fail(run.token);
      doneRef.current({ won: false, aborted: true });
    },
    [api, run.token],
  );

  const Game = GAMES[run.game];
  return (
    <div className="h-full w-full flex flex-col bg-[#0a0d12] text-[#cccccc] font-mono">
      <div className="h-8 shrink-0 flex items-center gap-3 px-3 text-[11px] tracking-wider border-b border-[rgba(136,229,43,0.12)]">
        <span className="text-[#88e52b] font-semibold">{run.program}</span>
        <span className="px-1.5 py-0.5 rounded bg-[rgba(136,229,43,0.12)] text-[#b5ff59] uppercase">{t(`ui.hack.difficulty_${run.difficulty}`)}</span>
        {run.total && run.total > 1 && <span className="text-[#cccccc]/60">{t('ui.hack.step', run.step ?? 1, run.total)}</span>}
        <span className="flex-1" />
        {!inputEnabled && <span className="text-[#ff9500]">{t('ui.hack.paused_focus')}</span>}
      </div>
      <div ref={boxRef} className="relative flex-1 min-h-0 overflow-hidden flex items-start justify-center">
        <div style={{ width: NATURAL_W, height: NATURAL_H, transform: `scale(${scale})`, transformOrigin: 'top center', flexShrink: 0 }}>
          {Game ? (
            <Game {...run.params} challenge={run.challenge} onWin={onWin} onFail={onFail} onProgress={onProgress} />
          ) : (
            <div className="p-6 text-[#f14c4c]">{t('ui.hack.unknown_game', run.game)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
