import type { MockHandler } from './index';
import { ok, fail } from './index';
import { mockPayload } from './payload';

// Browser mocks for Command Prompt + hacking (server/computers/shell.lua cmd:sysinfo and
// server/computers/hacks.lua hack:*). Mirrors the server's shapes; the difficulty presets are a
// copy of configs/shared/hacks.lua for dev only.

const PRESETS: Record<string, Record<string, Record<string, number>>> = {
  easy: {
    maze: { width: 15, height: 11, timeLimit: 75, visibility: 7, dataNodes: 2 },
    capture: { gridSize: 8, nodeDuration: 2800, capturesRequired: 10, maxMisses: 7 },
    cipher: { timeLimit: 15, speed: 0.8, spawnRate: 0.8, playerLives: 2 },
    snake: { nodesRequired: 12, initialSpeed: 110, gridCols: 24, gridRows: 12 },
    firewall: { rows: 3, cols: 6, waves: 2, speed: 0.8, timeLimit: 0, fireRate: 0.5, playerLives: 2, shootCooldown: 220 },
    evasion: { timeLimit: 30, speed: 0.8, spawnRate: 0.8, roadWidth: 36, playerLives: 2 },
    typing: { stringLength: 7, timePerString: 7500, stringsRequired: 8, playerLives: 4 },
    signal: { sequenceLength: 5, startLength: 3, flashSpeed: 0.85, inputWindow: 1.3, playerLives: 2 },
    pipe: { gridWidth: 6, gridHeight: 5, timeLimit: 60, rounds: 1, playerLives: 3 },
    breakout: { rows: 3, cols: 8, ballSpeed: 0.85, paddleWidth: 130, timeLimit: 0, playerLives: 4 },
  },
  medium: {
    maze: { width: 21, height: 15, timeLimit: 60, visibility: 5, dataNodes: 3 },
    capture: { gridSize: 10, nodeDuration: 2200, capturesRequired: 15, maxMisses: 5 },
    cipher: { timeLimit: 20, speed: 1.0, spawnRate: 1.0, playerLives: 1 },
    snake: { nodesRequired: 20, initialSpeed: 88, gridCols: 28, gridRows: 13 },
    firewall: { rows: 4, cols: 8, waves: 3, speed: 1.0, timeLimit: 0, fireRate: 0.8, playerLives: 1, shootCooldown: 250 },
    evasion: { timeLimit: 50, speed: 1.0, spawnRate: 1.0, roadWidth: 34, playerLives: 1 },
    typing: { stringLength: 10, timePerString: 6000, stringsRequired: 12, playerLives: 3 },
    signal: { sequenceLength: 6, startLength: 3, flashSpeed: 1.0, inputWindow: 1.0, playerLives: 1 },
    pipe: { gridWidth: 8, gridHeight: 6, timeLimit: 50, rounds: 1, playerLives: 2 },
    breakout: { rows: 4, cols: 10, ballSpeed: 1.0, paddleWidth: 100, timeLimit: 0, playerLives: 3 },
  },
  hard: {
    maze: { width: 29, height: 19, timeLimit: 60, visibility: 4, dataNodes: 4 },
    capture: { gridSize: 12, nodeDuration: 1700, capturesRequired: 20, maxMisses: 3 },
    cipher: { timeLimit: 30, speed: 1.25, spawnRate: 1.25, playerLives: 1 },
    snake: { nodesRequired: 28, initialSpeed: 72, gridCols: 32, gridRows: 15 },
    firewall: { rows: 5, cols: 9, waves: 4, speed: 1.2, timeLimit: 0, fireRate: 1.1, playerLives: 1, shootCooldown: 280 },
    evasion: { timeLimit: 60, speed: 1.25, spawnRate: 1.2, roadWidth: 28, playerLives: 1 },
    typing: { stringLength: 12, timePerString: 5000, stringsRequired: 15, playerLives: 2 },
    signal: { sequenceLength: 8, startLength: 4, flashSpeed: 1.2, inputWindow: 0.85, playerLives: 1 },
    pipe: { gridWidth: 10, gridHeight: 7, timeLimit: 55, rounds: 2, playerLives: 1 },
    breakout: { rows: 5, cols: 12, ballSpeed: 1.2, paddleWidth: 85, timeLimit: 0, playerLives: 2 },
  },
};

const TARGETS = [
  { command: 'fleeca-ledger', label: 'Fleeca 银行 - 分行账本中继', steps: [{ game: 'pipe', difficulty: 'easy' }, { game: 'typing', difficulty: 'easy' }], cooldown: 0, busy: false, requires: null as string | null },
  { command: 'cctv-mrpd', label: '米申罗警局监控上行链路', steps: [{ game: 'maze', difficulty: 'medium' }], cooldown: 1342, busy: false, requires: 'Trojan USB' },
];

let tokenSeq = 100;
let breachSeq = 0;
const runs = new Map<number, { game: string; difficulty: string; started: number; breach?: number; stepIndex?: number; lib?: boolean }>();
const breaches = new Map<number, { target: (typeof TARGETS)[number]; step: number }>();

const start = (game: string, difficulty: string, extra: { breach?: number; stepIndex?: number; total?: number; lib?: boolean } = {}) => {
  const meta = mockPayload.hacks.games[game];
  const params = PRESETS[difficulty]?.[game];
  if (!meta) return fail(`未知程序。`);
  if (!params) return fail(`未知难度。`);
  const token = ++tokenSeq;
  runs.set(token, { game, difficulty, started: Date.now(), breach: extra.breach, stepIndex: extra.stepIndex, lib: extra.lib });
  return ok({ token, game, difficulty, program: meta.program, label: meta.label, params, steps: 0, minSeconds: 3, step: extra.stepIndex, total: extra.total });
};

const handlers: Record<string, MockHandler> = {
  'cmd:sysinfo': () =>
    ok({
      hostname: mockPayload.computer.hostname, ip: mockPayload.computer.ip, mac: '00-1A-B9-D6-1E-0E', label: mockPayload.computer.label,
      user: mockPayload.user.name, domain: 'POLICE', os: mockPayload.desktop.osName, build: mockPayload.desktop.osBuild, uptime: 734,
    }),
  'hack:targets': () =>
    ok(TARGETS.map(t => ({ command: t.command, label: t.label, steps: t.steps.length, cooldown: t.cooldown, busy: t.busy, requires: t.requires }))),
  'hack:breach': p => {
    const t = TARGETS.find(x => x.command === p.command);
    if (!t) return fail(`无法连接到主机“${String(p.command)}”：主机不可达。`);
    if (t.cooldown > 0) return fail(`远程主机已离线（${t.cooldown} 秒后重启）。`);
    const id = ++breachSeq;
    breaches.set(id, { target: t, step: 1 });
    return ok({ id, label: t.label, steps: t.steps.map(s => ({ ...s, ...mockPayload.hacks.games[s.game] })) });
  },
  'hack:start': p => {
    if (typeof p.breach === 'number') {
      const b = breaches.get(p.breach);
      if (!b) return fail('会话已过期，请重新运行。');
      const st = b.target.steps[b.step - 1];
      return start(st.game, st.difficulty, { breach: p.breach, stepIndex: b.step, total: b.target.steps.length });
    }
    return start(String(p.game ?? ''), String(p.difficulty ?? 'medium'), { lib: !!p.lib });
  },
  'hack:advance': () => ok({}),
  'hack:submit': p => {
    const r = runs.get(Number(p.token));
    if (!r) return fail('会话已过期，请重新运行。');
    runs.delete(Number(p.token));
    if (Date.now() - r.started < 3000) return fail('完整性校验未通过，本次运行已被拒绝。');
    if (p.lib || r.lib) return ok({ proof: 'mockproof' + p.token });
    if (r.breach) {
      const b = breaches.get(r.breach)!;
      b.step += 1;
      if (b.step <= b.target.steps.length) return ok({ done: false, next: b.step, total: b.target.steps.length });
      breaches.delete(r.breach);
      return ok({ done: true, total: b.target.steps.length });
    }
    return ok({ done: true });
  },
  'hack:fail': p => {
    const r = runs.get(Number(p.token));
    runs.delete(Number(p.token));
    if (r?.breach) breaches.delete(r.breach);
    return ok();
  },
  'hack:abort': p => {
    breaches.delete(Number(p.breach));
    return ok();
  },
};

export default handlers;
