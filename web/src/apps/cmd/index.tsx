import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useOS, selectActiveId, type Win } from '@/store/os';
import { rpc } from '@/nui/rpc';
import { t, useI18n } from '@/i18n';
import type { OpenPayload } from '@/types';
import type { HackResult } from '../hack/HackRunner';
import type { AppProps } from '../registry';
import type { Ctx, Job, Line, Printer, Seg, SysInfo, Target } from './types';
import { C, DEFAULT_BG, DEFAULT_FG, RED, copyText, firstName } from './util';
import { makeFs } from './fs';
import { COMMAND_NAMES, runLine } from './commands';
import { normalizeTargets } from './hacking';
import { completions } from './complete';

const MAX_LINES = 1000;

const LineView = memo(function LineView({ line }: { line: Line }) {
  return (
    <div className="min-h-[18px] whitespace-pre-wrap break-all">
      {line.segs.map((s, i) => (
        <span key={i} style={s.c ? { color: s.c } : undefined}>
          {s.t}
        </span>
      ))}
    </div>
  );
});

const Lines = memo(function Lines({ lines }: { lines: Line[] }) {
  return (
    <>
      {lines.map(l => (
        <LineView key={l.id} line={l} />
      ))}
    </>
  );
});

/** conhost's underscore cursor: solid while typing, then blinks at the system rate; hidden unfocused. */
function Caret({ ch, show, tick }: { ch: string; show: boolean; tick: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(true);
    if (!show) return;
    const id = window.setInterval(() => setOn(v => !v), 530);
    return () => window.clearInterval(id);
  }, [show, tick]);
  return (
    <span className="relative">
      {ch}
      {show && on && <span className="absolute left-0 right-0 bottom-0 h-[3px] pointer-events-none" style={{ background: 'currentColor' }} />}
    </span>
  );
}

const normalizeSys = (raw: Partial<Record<keyof SysInfo, unknown>>, p: OpenPayload): SysInfo => ({
  hostname: String(raw.hostname ?? p.computer.hostname),
  ip: String(raw.ip ?? p.computer.ip),
  mac: String(raw.mac ?? '00-1A-00-00-00-00'),
  label: String(raw.label ?? p.computer.label),
  user: String(raw.user ?? p.user.name),
  domain: String(raw.domain ?? 'WORKGROUP'),
  os: String(raw.os ?? p.desktop.osName),
  build: String(raw.build ?? p.desktop.osBuild),
  uptime: Math.max(0, Number(raw.uptime) || 0),
});

/**
 * Command Prompt - a classic conhost cmd.exe. Output is a list of coloured lines (max 1000); the
 * prompt line is drawn by hand over a hidden <input> that owns the keyboard (history, Tab
 * completion, Ctrl+C / Ctrl+L). Each command runs as a cancellable Job (see types.ts), and the
 * prompt stays locked while one runs - including while a hack window it opened is being played.
 */
export default function CommandPrompt({ win }: AppProps) {
  useI18n();
  const payload = useOS(s => s.payload);
  if (!payload) return null;
  return <Console win={win} payload={payload} />;
}

function Console({ win, payload }: { win: Win; payload: OpenPayload }) {
  const active = useOS(s => selectActiveId(s) === win.id);
  const clock24 = payload.desktop.clock24;
  const first = firstName(payload.user.name);
  const fs = useMemo(() => makeFs(first), [first]);

  const seq = useRef(0);
  const [lines, setLines] = useState<Line[]>(() =>
    [C('banner', payload.desktop.osName, payload.desktop.osBuild), C('copyright', new Date().getFullYear()), ''].map(text => ({ id: ++seq.current, segs: [{ t: text }] })),
  );
  const [input, setInput] = useState('');
  const [caret, setCaret] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ label: string; resolve: (v: string | null) => void } | null>(null);
  const [cwd, setCwd] = useState(fs.home);
  const [colors, setColors] = useState({ fg: DEFAULT_FG, bg: DEFAULT_BG });
  const [echo, setEcho] = useState(true);
  const [focused, setFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const jobRef = useRef<Job | null>(null);
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;
  const echoRef = useRef(echo);
  echoRef.current = echo;
  const askRef = useRef(ask);
  askRef.current = ask;
  const inputVal = useRef(input);
  inputVal.current = input;
  const sys = useRef<{ data: SysInfo; at: number } | null>(null);
  const sysPending = useRef<Promise<{ data?: SysInfo; error?: string }> | null>(null);
  const targetsRef = useRef<Target[] | null>(null);
  const hist = useRef<string[]>([]);
  const hIdx = useRef(-1);
  const tab = useRef<{ base: string; matches: string[]; i: number; result: string } | null>(null);
  const defaultTitle = useRef(win.title);

  // ── output ───────────────────────────────────────────────────────────────────────────────
  const append = useCallback((rows: Seg[][]): number => {
    if (!rows.length || !mounted.current) return 0;
    const add = rows.map(segs => ({ id: ++seq.current, segs }));
    setLines(ls => {
      const next = ls.concat(add);
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
    return add[add.length - 1].id;
  }, []);

  const print: Printer = useCallback((text = '', color) => append(String(text).split('\n').map(l => [{ t: l, c: color }])), [append]);

  const setLine = (v: string) => {
    setInput(v);
    setCaret(v.length);
  };

  // ── cmd:sysinfo (one request in flight, cached; uptime advanced locally) ─────────────────
  const loadSys = useCallback((): Promise<{ data?: SysInfo; error?: string }> => {
    const cached = sys.current;
    if (cached) return Promise.resolve({ data: { ...cached.data, uptime: cached.data.uptime + Math.floor((Date.now() - cached.at) / 1000) } });
    if (!sysPending.current) {
      sysPending.current = rpc<Partial<Record<keyof SysInfo, unknown>>>('cmd:sysinfo').then(res => {
        sysPending.current = null;
        if (!res.ok || !res.data) return { error: res.error || t('ui.common.error') };
        sys.current = { data: normalizeSys(res.data, payload), at: Date.now() };
        return { data: sys.current.data };
      });
    }
    return sysPending.current;
  }, [payload]);

  const setTitle = useCallback(
    (title: string | null) => {
      const next = title ?? defaultTitle.current;
      useOS.setState(s => ({ windows: s.windows.map(w => (w.id === win.id ? { ...w, title: next } : w)) }));
    },
    [win.id],
  );

  // ── jobs ─────────────────────────────────────────────────────────────────────────────────
  /** Stop a job: gate its output, wake its sleeps, run its cancel hooks, close its hack window. */
  const abandon = (job: Job, printer: Printer) => {
    job.cancelled = true;
    const timers = job.timers;
    job.timers = [];
    timers.forEach(f => f());
    const hooks = job.onCancel;
    job.onCancel = [];
    hooks.forEach(f => {
      try {
        f(printer);
      } catch {
        /* a hook must never break cancelling */
      }
    });
    if (job.hackWin) {
      const id = job.hackWin;
      job.hackWin = undefined;
      useOS.getState().close(id);
    }
  };

  const makeCtx = (job: Job): Ctx => {
    const live = () => !job.cancelled && mounted.current;
    const ctx: Ctx = {
      job,
      out: (text, color) => (live() ? print(text, color) : 0),
      segs: s => (live() ? append([s]) : 0),
      replace: (id, text, color) => {
        if (live()) setLines(ls => ls.map(l => (l.id === id ? { id, segs: [{ t: text, c: color }] } : l)));
      },
      remove: id => {
        if (live()) setLines(ls => ls.filter(l => l.id !== id));
      },
      clear: () => {
        if (live()) setLines([]);
      },
      sleep: ms =>
        new Promise<boolean>(resolve => {
          if (!live()) {
            resolve(false);
            return;
          }
          const stop = () => {
            window.clearTimeout(timer);
            resolve(false);
          };
          const timer = window.setTimeout(() => {
            job.timers = job.timers.filter(f => f !== stop);
            resolve(live());
          }, ms);
          job.timers.push(stop);
        }),
      ask: label =>
        new Promise<string | null>(resolve => {
          if (!live()) {
            resolve(null);
            return;
          }
          let settled = false;
          const done = (v: string | null) => {
            if (settled) return;
            settled = true;
            setAsk(null);
            resolve(v);
          };
          job.onCancel.push(() => done(null));
          setAsk({ label, resolve: done });
        }),
      play: run =>
        new Promise<HackResult>(resolve => {
          if (!live()) {
            resolve({ won: false, aborted: true });
            return;
          }
          const id = `hack:${run.token}`;
          job.hackWin = id;
          const onResult = (r: HackResult) => {
            if (job.hackWin === id) job.hackWin = undefined;
            resolve(r);
          };
          useOS.getState().openWindow({ id, app: 'hack', title: run.program, w: 1180, h: 780, props: { run, onResult } });
        }),
      payload,
      clock24,
      winId: win.id,
      cwd: cwdRef.current,
      setCwd: p => {
        if (live()) setCwd(p);
      },
      fs,
      sysinfo: async () => {
        const r = await loadSys();
        if (!r.data) {
          ctx.out(r.error ?? t('ui.common.error'));
          return null;
        }
        return r.data;
      },
      cachedSys: () => sys.current?.data ?? null,
      targets: () => targetsRef.current,
      setTargets: list => {
        targetsRef.current = list;
      },
      setTitle: title => {
        if (live()) setTitle(title);
      },
      setColors: (fg, bg) => {
        if (live()) setColors({ fg, bg });
      },
      echo: echoRef.current,
      setEcho: on => {
        if (live()) setEcho(on);
      },
      exit: () => useOS.getState().close(win.id),
    };
    return ctx;
  };

  const run = (raw: string) => {
    print((echoRef.current ? `${cwdRef.current}>` : '') + raw);
    if (!raw.trim()) return;
    if (hist.current[hist.current.length - 1] !== raw) {
      hist.current.push(raw);
      if (hist.current.length > 100) hist.current.shift();
    }
    hIdx.current = -1;
    const job: Job = { cancelled: false, onCancel: [], timers: [] };
    jobRef.current = job;
    setBusy(true);
    const ctx = makeCtx(job);
    void (async () => {
      try {
        await runLine(ctx, raw);
      } catch (e) {
        ctx.out(e instanceof Error ? e.message : String(e), RED);
      }
      if (jobRef.current !== job) return; // cancelled: already wrapped up
      jobRef.current = null;
      setBusy(false);
      if (!job.noBlank) print('');
    })();
  };

  /** Ctrl+C: cancel the running job, or abandon the line being typed. */
  const ctrlC = () => {
    const job = jobRef.current;
    if (!job) {
      print(`${echoRef.current ? `${cwdRef.current}>` : ''}${inputVal.current}^C`);
      setLine('');
      hIdx.current = -1;
      return;
    }
    const pending = askRef.current;
    jobRef.current = null;
    abandon(job, print);
    print(pending ? `${pending.label}${inputVal.current}^C` : '^C');
    if (job.cancelNote) print(job.cancelNote, RED);
    setAsk(null);
    setLine('');
    setBusy(false);
  };

  // Prefetch what `whoami`/`ipconfig` and breach Tab completion need; closing the window
  // mid-command abandons the job (a live breach is aborted server-side).
  useEffect(() => {
    mounted.current = true;
    void loadSys();
    void rpc<unknown>('hack:targets').then(r => {
      if (r.ok) targetsRef.current = normalizeTargets(r.data);
    });
    return () => {
      mounted.current = false;
      const job = jobRef.current;
      jobRef.current = null;
      if (job) abandon(job, () => 0);
    };
  }, []);

  // ── keyboard ─────────────────────────────────────────────────────────────────────────────
  const focusInput = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);

  // Focus follows the window: an inactive console hides its cursor and lets keys go elsewhere
  // (a hack window's game, another app).
  useEffect(() => {
    if (active) focusInput();
    else inputRef.current?.blur();
  }, [active, focusInput]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, input, busy, ask]);

  const recall = (dir: -1 | 1) => {
    const h = hist.current;
    if (!h.length) return;
    if (dir < 0) hIdx.current = hIdx.current < 0 ? h.length - 1 : Math.max(0, hIdx.current - 1);
    else {
      if (hIdx.current < 0) return;
      if (hIdx.current >= h.length - 1) {
        hIdx.current = -1;
        setLine('');
        return;
      }
      hIdx.current += 1;
    }
    setLine(h[hIdx.current]);
  };

  const complete = (back: boolean) => {
    let st = tab.current;
    if (!st || st.result !== input) {
      const c = completions(input, {
        commands: COMMAND_NAMES(),
        games: payload.hacks.games,
        targets: (targetsRef.current ?? []).map(x => x.command),
        cwd,
        fs,
        hostname: payload.computer.hostname,
      });
      if (!c) return;
      st = { base: c.base, matches: c.matches, i: back ? c.matches.length - 1 : 0, result: '' };
    } else st.i = (st.i + (back ? -1 : 1) + st.matches.length) % st.matches.length;
    st.result = st.base + st.matches[st.i];
    tab.current = st;
    setLine(st.result);
  };

  const submit = () => {
    const v = input;
    if (ask) {
      print(ask.label + v);
      setLine('');
      ask.resolve(v);
      return;
    }
    if (busy) return;
    setLine('');
    tab.current = null;
    run(v);
  };

  const copySelection = (): boolean => {
    const sel = window.getSelection();
    const text = sel?.toString() ?? '';
    if (!text) return false;
    void copyText(text);
    sel?.removeAllRanges();
    focusInput();
    return true;
  };

  const locked = busy && !ask;

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    if (e.ctrlKey && !e.altKey && (k === 'c' || k === 'C')) {
      const el = e.currentTarget;
      if (el.selectionStart !== el.selectionEnd) return; // copy the selected part of the line
      e.preventDefault();
      if (!copySelection()) ctrlC();
      return;
    }
    if (e.ctrlKey && (k === 'l' || k === 'L')) {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (locked) {
      if (k.length === 1 || k === 'Enter' || k === 'Backspace' || k === 'Delete' || k === 'Tab') e.preventDefault();
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      submit();
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      if (!ask) recall(k === 'ArrowUp' ? -1 : 1);
    } else if (k === 'Tab') {
      e.preventDefault();
      if (!ask) complete(e.shiftKey);
    } else if (k === 'Escape') {
      e.preventDefault();
      setLine('');
    }
  };

  const syncCaret = () => {
    const el = inputRef.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
  };

  // Keys that land on the console itself (after a mouse selection moved focus off the input).
  const onRootKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target === inputRef.current) return;
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      if (!copySelection()) ctrlC();
      return;
    }
    if (e.key === 'Enter' && copySelection()) {
      e.preventDefault();
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    window.getSelection()?.removeAllRanges();
    focusInput();
    if (e.key.length === 1 && !locked) {
      e.preventDefault();
      setLine(input + e.key);
    }
  };

  const prompt = ask ? ask.label : echo ? `${cwd}>` : '';

  return (
    <div
      className="relative h-full w-full overflow-hidden font-mono outline-none"
      style={{ background: colors.bg, color: colors.fg }}
      tabIndex={-1}
      onMouseUp={() => {
        const s = window.getSelection();
        if (!s || s.isCollapsed) focusInput();
      }}
      onKeyDown={onRootKey}
    >
      <input
        ref={inputRef}
        value={input}
        readOnly={locked}
        onChange={e => {
          setInput(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onInputKey}
        onKeyUp={syncCaret}
        onSelect={syncCaret}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={C('input_label')}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={8191}
        className="absolute left-0 top-0 w-px h-px p-0 m-0 border-0 opacity-0 pointer-events-none"
      />
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overflow-x-hidden select-text cursor-text [&::-webkit-scrollbar]:w-[12px] [&::-webkit-scrollbar-track]:bg-[#171717] [&::-webkit-scrollbar-thumb]:bg-[#4d4d4d] [&::-webkit-scrollbar-thumb:hover]:bg-[#6e6e6e]"
        style={{ padding: 6, fontSize: 14, lineHeight: '18px' }}
      >
        <Lines lines={lines} />
        <div className="min-h-[18px] whitespace-pre-wrap break-all">
          {locked ? (
            <Caret ch=" " show={focused} tick="busy" />
          ) : (
            <>
              {prompt}
              {input.slice(0, caret)}
              <Caret ch={input[caret] ?? ' '} show={focused} tick={`${input}\u0000${caret}`} />
              {input.slice(caret + 1)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
