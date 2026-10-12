import type { HackRun, OpenPayload } from '@/types';
import type { HackResult } from '../hack/HackRunner';
import type { Fs } from './fs';

/** One coloured run of text inside a console line (no colour = the console's foreground). */
export interface Seg {
  t: string;
  c?: string;
}

export interface Line {
  id: number;
  segs: Seg[];
}

/** Appends text (split on \n) and returns the id of the last line written (0 when suppressed). */
export type Printer = (text?: string, color?: string) => number;

/**
 * A running command. Ctrl+C (or closing the window) cancels it: `cancelled` gates every further
 * write, pending sleeps resolve false, `onCancel` hooks run (abort a breach, print ping's
 * statistics…) and an open hack window is closed.
 */
export interface Job {
  cancelled: boolean;
  onCancel: ((print: Printer) => void)[];
  timers: (() => void)[];
  hackWin?: string;
  /** Don't print the blank line before the next prompt (cls). */
  noBlank?: boolean;
  /** Printed (red) after the ^C when this job is cancelled. */
  cancelNote?: string;
}

/** cmd:sysinfo (server/computers/shell.lua). */
export interface SysInfo {
  hostname: string;
  ip: string;
  mac: string;
  label: string;
  user: string;
  domain: string;
  os: string;
  build: string;
  uptime: number;
}

/** hack:targets row (server/computers/hacks.lua). */
export interface Target {
  command: string;
  label: string;
  steps: number;
  cooldown: number;
  busy: boolean;
  requires: string | null;
}

/** hack:breach reply. */
export interface Breach {
  id: number;
  label: string;
  steps: { game: string; difficulty: string; program: string; label: string }[];
}

/** Everything a command can touch. Output through `out`/`segs` stops the moment the job is cancelled. */
export interface Ctx {
  job: Job;
  out: Printer;
  segs: (segs: Seg[]) => number;
  replace: (id: number, text: string, color?: string) => void;
  remove: (id: number) => void;
  clear: () => void;
  /** Resolves true after `ms`, or false as soon as the job is cancelled. */
  sleep: (ms: number) => Promise<boolean>;
  /** An interactive sub-prompt (date/time). null = cancelled. */
  ask: (label: string) => Promise<string | null>;
  /** Open a hack window for a started run and wait for its result. */
  play: (run: HackRun) => Promise<HackResult>;
  payload: OpenPayload;
  clock24: boolean;
  winId: string;
  cwd: string;
  setCwd: (path: string) => void;
  fs: Fs;
  /** cmd:sysinfo (cached; uptime kept current). Prints the error and returns null on failure. */
  sysinfo: () => Promise<SysInfo | null>;
  /** The cached sysinfo, if one has arrived (sync; for %USERDOMAIN%). */
  cachedSys: () => SysInfo | null;
  targets: () => Target[] | null;
  setTargets: (t: Target[]) => void;
  setTitle: (title: string | null) => void;
  setColors: (fg: string, bg: string) => void;
  echo: boolean;
  setEcho: (on: boolean) => void;
  exit: () => void;
}

export type Command = (ctx: Ctx, args: string[], rest: string) => void | Promise<void>;
