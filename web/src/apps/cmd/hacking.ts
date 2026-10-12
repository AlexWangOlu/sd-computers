import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import type { Difficulty, GameMeta, HackRun } from '@/types';
import type { HackResult } from '../hack/HackRunner';
import type { Breach, Command, Ctx, Target } from './types';
import { C, CYAN, GRAY, GREEN, RED, YELLOW, lpad, pad, pad2, pidFor, table } from './util';

// Command Prompt's way into the minigames (server/computers/hacks.lua):
//   hack [<program> [difficulty]]   practice runs (logged, no reward)
//   targets                         the hosts reachable from this computer
//   breach <command>                every stage of a target, in order; the server pays the reward

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const diffLabel = (d: string): string => {
  const key = `ui.hack.difficulty_${d}`;
  const s = t(key);
  return s === key ? d : s;
};

const errorText = (e?: string): string => e || t('ui.common.error');

const mmss = (s: number): string => `${pad2(Math.floor(s / 60))}:${pad2(Math.floor(s % 60))}`;

export const normalizeTargets = (raw: unknown): Target[] =>
  Array.isArray(raw)
    ? raw
        .map((r: Record<string, unknown>) => ({
          command: String(r.command ?? ''),
          label: String(r.label ?? r.command ?? ''),
          steps: Number(r.steps) || 0,
          cooldown: Math.max(0, Math.ceil(Number(r.cooldown) || 0)),
          busy: !!r.busy,
          requires: typeof r.requires === 'string' && r.requires ? r.requires : null,
        }))
        .filter(x => x.command)
    : [];

const normalizeBreach = (raw: unknown): Breach | null => {
  const b = raw as Partial<Breach> | undefined;
  if (!b || typeof b.id !== 'number') return null;
  return { id: b.id, label: String(b.label ?? ''), steps: Array.isArray(b.steps) ? b.steps : [] };
};

/** "maze", "net-maze.exe" or "net-maze" -> the config.Hacks.Games key. */
export const gameKey = (games: Record<string, GameMeta>, arg: string): string | null => {
  const a = arg.toLowerCase();
  if (games[a]) return a;
  for (const [k, g] of Object.entries(games)) {
    const p = g.program.toLowerCase();
    if (p === a || p.replace(/\.exe$/, '') === a) return k;
  }
  return null;
};

/** One finished run -> its [+]/[-] line. true = won. */
const reportRun = (ctx: Ctx, program: string, r: HackResult): boolean => {
  if (r.won) {
    ctx.out(C('run_ok', program), GREEN);
    return true;
  }
  if (r.error) ctx.out(r.error, RED);
  ctx.out(C(r.aborted ? 'run_closed' : 'run_denied', program), RED);
  return false;
};

const hack: Command = async (ctx, args) => {
  const { games, practice, defaultDifficulty } = ctx.payload.hacks;
  if (!args.length) {
    ctx.out(C('hack_title'));
    ctx.out('');
    const rows = [[C('th_key'), C('th_program'), C('th_description')], ...Object.entries(games).map(([k, g]) => [k, g.program, g.label])];
    table(rows).forEach((l, i) => ctx.out(`  ${l}`, i === 0 ? GRAY : undefined));
    ctx.out('');
    ctx.out(C('hack_usage'));
    ctx.out(C('hack_default', diffLabel(defaultDifficulty)));
    if (!practice) {
      ctx.out('');
      ctx.out(C('practice_disabled'), YELLOW);
    }
    return;
  }
  const key = gameKey(games, args[0]);
  if (!key) {
    ctx.out(C('hack_unknown', args[0]));
    return;
  }
  const difficulty = (args[1] ?? defaultDifficulty).toLowerCase() as Difficulty;
  if (!DIFFICULTIES.includes(difficulty)) {
    ctx.out(C('hack_bad_difficulty', args[1]));
    return;
  }
  if (!practice) {
    ctx.out(C('practice_disabled'));
    return;
  }
  ctx.out(C('launching', games[key].program));
  const res = await rpc<HackRun>('hack:start', { game: key, difficulty });
  if (ctx.job.cancelled) {
    if (res.ok && res.data) void rpc('hack:fail', { token: res.data.token });
    return;
  }
  if (!res.ok || !res.data) {
    ctx.out(errorText(res.error), RED);
    return;
  }
  const run = res.data;
  ctx.out(C('waiting', run.program, pidFor(`hack:${run.token}`)));
  const result = await ctx.play(run);
  if (ctx.job.cancelled) return;
  reportRun(ctx, run.program, result);
};

const targets: Command = async ctx => {
  ctx.out(C('scanning'));
  const res = await rpc<unknown>('hack:targets');
  if (ctx.job.cancelled) return;
  if (!res.ok) {
    ctx.out(errorText(res.error), RED);
    return;
  }
  const list = normalizeTargets(res.data);
  ctx.setTargets(list);
  if (!(await ctx.sleep(300))) return;
  ctx.out('');
  if (!list.length) {
    ctx.out(C('no_targets'));
    return;
  }
  const needs = list.some(x => x.requires);
  const status = (x: Target): [string, string] =>
    x.busy ? [C('st_busy'), YELLOW] : x.cooldown > 0 ? [C('st_offline', mmss(x.cooldown)), RED] : [C('st_ready'), GREEN];
  const head = [C('th_command'), C('th_host'), C('th_stages'), C('th_status'), ...(needs ? [C('th_requires')] : [])];
  const body = list.map(x => [x.command, x.label, String(x.steps), status(x)[0], ...(needs ? [x.requires ?? ''] : [])]);
  const w = head.map((_, i) => Math.max(...[head, ...body].map(r => r[i].length)));
  const cell = (r: string[], i: number) => (i === 2 ? lpad(r[i], w[i]) : pad(r[i], w[i]));
  const lastCol = head.length - 1;
  ctx.segs([{ t: `  ${head.map((_, i) => (i === lastCol ? head[i] : cell(head, i))).join('  ')}`, c: GRAY }]);
  ctx.segs([{ t: `  ${w.map(n => '-'.repeat(n)).join('  ')}`, c: GRAY }]);
  body.forEach((r, j) => {
    const [, col] = status(list[j]);
    const lead = `  ${[0, 1, 2].map(i => cell(r, i)).join('  ')}  `;
    const st = needs && r[4] ? cell(r, 3) : r[3];
    ctx.segs([{ t: lead }, { t: st, c: col }, ...(needs && r[4] ? [{ t: `  ${r[4]}` }] : [])]);
  });
  ctx.out('');
  ctx.out(C('targets_hint'));
};

const grantedBanner = (ctx: Ctx, label: string): void => {
  const text = C('granted');
  const inner = Math.max(34, text.length + 8);
  const left = Math.floor((inner - text.length) / 2);
  ctx.out('');
  ctx.out(`  ╔${'═'.repeat(inner)}╗`, GREEN);
  ctx.out(`  ║${' '.repeat(inner)}║`, GREEN);
  ctx.out(`  ║${' '.repeat(left)}${text}${' '.repeat(inner - left - text.length)}║`, GREEN);
  ctx.out(`  ║${' '.repeat(inner)}║`, GREEN);
  ctx.out(`  ╚${'═'.repeat(inner)}╝`, GREEN);
  ctx.out('');
  ctx.out(C('granted_note', label));
};

const breach: Command = async (ctx, args) => {
  const command = (args[0] ?? '').toLowerCase();
  if (!command) {
    ctx.out(C('breach_usage'));
    return;
  }
  ctx.out(C('resolving', command));
  const res = await rpc<unknown>('hack:breach', { command });
  const b = res.ok ? normalizeBreach(res.data) : null;
  if (ctx.job.cancelled) {
    if (b) void rpc('hack:abort', { breach: b.id });
    return;
  }
  if (!b) {
    ctx.out(errorText(res.error), RED);
    return;
  }

  // From here the breach is live server-side: Ctrl+C or closing the window abandons it.
  const abort = () => void rpc('hack:abort', { breach: b.id });
  const settle = () => {
    ctx.job.onCancel = [];
    ctx.job.cancelNote = undefined;
  };
  ctx.job.onCancel.push(abort);
  ctx.job.cancelNote = C('breach_aborted', b.label);

  const total = b.steps.length;
  if (!(await ctx.sleep(450))) return;
  ctx.out(C('connected', b.label), CYAN);
  if (!(await ctx.sleep(350))) return;
  ctx.out(C('layers', total));
  const rows = b.steps.map((s, i) => [`[${i + 1}]`, s.program, s.label, diffLabel(s.difficulty)]);
  for (const l of table(rows)) {
    if (!(await ctx.sleep(160))) return;
    ctx.out(`  ${l}`);
  }
  if (!(await ctx.sleep(500))) return;
  ctx.out('');

  let stage = 1;
  // Each pass needs a played stage; the cap only guards against a server that never says done.
  for (let pass = 0; pass <= total + 2; pass++) {
    ctx.out(C('stage', stage, total, b.steps[stage - 1]?.program ?? '?'), YELLOW);
    const start = await rpc<HackRun>('hack:start', { breach: b.id });
    if (ctx.job.cancelled) {
      if (start.ok && start.data) void rpc('hack:fail', { token: start.data.token });
      return;
    }
    if (!start.ok || !start.data) {
      ctx.out(errorText(start.error), RED);
      abort();
      settle();
      ctx.out('');
      ctx.out(C('denied'), RED);
      return;
    }
    const run = start.data;
    const result = await ctx.play(run);
    if (ctx.job.cancelled) return;
    if (!reportRun(ctx, run.program, result)) {
      // A lost / closed / rejected stage: the server has already ended the breach.
      settle();
      ctx.out('');
      ctx.out(C('denied'), RED);
      return;
    }
    if (result.data?.done === false) {
      stage = Math.max(stage + 1, Number(result.data.next) || 0);
      if (!(await ctx.sleep(600))) return;
      continue;
    }
    settle();
    grantedBanner(ctx, b.label);
    return;
  }
  abort();
  settle();
  ctx.out('');
  ctx.out(C('denied'), RED);
};

export const HACK_COMMANDS: Record<string, Command> = { hack, targets, breach };
