import { t } from '@/i18n';
import { fmtDuration, fmtLongDateFull, fmtTime } from '@/lib/format';
import { useOS } from '@/store/os';
import type { HackRun } from '@/types';
import type { Command, Ctx, Printer } from './types';
import type { FsNode } from './fs';
import {
  C, DEFAULT_BG, DEFAULT_FG, PALETTE, accountName, dateMDY, dnsSuffix, firstName, hash, lpad, num, pad, pad2, pidFor, stampLong, timeHM, tokenize,
} from './util';
import { HACK_COMMANDS } from './hacking';

// cmd.exe's built-ins, imitated. Output that IS Windows formatting (ipconfig's dotted labels,
// systeminfo's columns, tasklist's table) stays literal; sentences go through ui.cmd.*.

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dateLine = (d: Date): string => `${DOW[d.getDay()]} ${dateMDY(d)}`;
const timeLine = (d: Date): string => `${String(d.getHours()).padStart(2, ' ')}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad2(Math.floor(d.getMilliseconds() / 10))}`;
const validDate = (s: string): boolean => /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(s.trim());
const validTime = (s: string): boolean => /^\d{1,2}(:\d{1,2}){0,2}([.,]\d{1,2})?(\s*[ap]m?)?$/i.test(s.trim());

const gatewayOf = (ip: string): string => ip.replace(/\.\d+$/, '.1');
const hex4 = (n: number): string => (n & 0xffff).toString(16);
const linkLocal = (mac: string): string => {
  const h = hash(mac);
  const g = hash(mac + 'v6');
  return `fe80::${hex4(h)}:${hex4(h >>> 16)}:${hex4(g)}:${hex4(g >>> 16)}%12`;
};

/** %USERNAME% & co. (expanded before parsing, like cmd). */
const envOf = (ctx: Ctx): Record<string, string> => {
  const now = new Date();
  const first = firstName(ctx.payload.user.name);
  return {
    USERNAME: accountName(ctx.payload.user.name),
    USERDOMAIN: ctx.cachedSys()?.domain ?? 'WORKGROUP',
    COMPUTERNAME: ctx.payload.computer.hostname,
    USERPROFILE: `C:\\Users\\${first}`,
    HOMEDRIVE: 'C:',
    HOMEPATH: `\\Users\\${first}`,
    CD: ctx.cwd,
    DATE: dateLine(now),
    TIME: timeLine(now),
    OS: 'SD_OS',
    PROCESSOR_ARCHITECTURE: 'x64',
    NUMBER_OF_PROCESSORS: '8',
    SYSTEMDRIVE: 'C:',
    SYSTEMROOT: 'C:\\System',
    COMSPEC: 'C:\\System\\bin\\cmd.exe',
    PROMPT: '$P$G',
    RANDOM: String(Math.floor(Math.random() * 32768)),
    ERRORLEVEL: '0',
  };
};

const expandVars = (ctx: Ctx, s: string): string => {
  const env = envOf(ctx);
  return s.replace(/%([^%\s]+)%/g, (m, k: string) => env[k.toUpperCase()] ?? m);
};

// ── simple built-ins ─────────────────────────────────────────────────────────────────────────

const ver: Command = ctx => {
  ctx.out('');
  ctx.out(C('banner', ctx.payload.desktop.osName, ctx.payload.desktop.osBuild));
};

const cls: Command = ctx => {
  ctx.clear();
  ctx.job.noBlank = true;
};

const exit: Command = ctx => {
  ctx.job.noBlank = true;
  ctx.exit();
};

const hostname: Command = (ctx, args) => {
  if (args.length) {
    ctx.out(C('hostname_set'));
    return;
  }
  ctx.out(ctx.payload.computer.hostname);
};

const whoami: Command = async (ctx, args) => {
  if (args.length) {
    ctx.out(C('whoami_bad', args[0]));
    ctx.out(C('whoami_usage'));
    return;
  }
  const si = await ctx.sysinfo();
  if (si) ctx.out(`${si.domain.toLowerCase()}\\${accountName(si.user)}`);
};

const echo: Command = (ctx, _args, rest) => {
  if (/^\s*$/.test(rest)) {
    ctx.out(C(ctx.echo ? 'echo_is_on' : 'echo_is_off'));
    return;
  }
  const word = rest.trim().toLowerCase();
  if (/^\s/.test(rest) && (word === 'on' || word === 'off')) {
    ctx.setEcho(word === 'on');
    return;
  }
  ctx.out(rest.slice(1));
};

const title: Command = (ctx, _args, rest) => {
  ctx.setTitle(rest.trim() || null);
};

const color: Command = (ctx, args) => {
  const a = (args[0] ?? '').toLowerCase();
  if (!a) {
    ctx.setColors(DEFAULT_FG, DEFAULT_BG);
    return;
  }
  if (!/^[0-9a-f]{1,2}$/.test(a)) {
    ctx.out(C('help.color'));
    ctx.out('');
    ctx.out(t('ui.cmd.usage.color'));
    return;
  }
  const bg = a.length === 2 ? a[0] : '0';
  const fg = a.length === 2 ? a[1] : a[0];
  if (bg === fg) return; // the real cmd refuses identical colours silently (ERRORLEVEL 1)
  ctx.setColors(PALETTE[fg], PALETTE[bg]);
};

/** date / time: show, then an interactive "Enter the new …" prompt (Enter keeps it). */
const dateOrTime = (kind: 'date' | 'time'): Command => async (ctx, args, rest) => {
  const valid = kind === 'date' ? validDate : validTime;
  const now = new Date();
  if ((args[0] ?? '').toLowerCase() === '/t') {
    ctx.out(kind === 'date' ? dateLine(now) : timeHM(now, ctx.clock24));
    return;
  }
  if (rest.trim()) {
    ctx.out(valid(rest) ? C('privilege') : C(`bad_${kind}`));
    return;
  }
  ctx.out(C(`${kind}_current`, kind === 'date' ? dateLine(now) : timeLine(now)));
  for (;;) {
    const answer = await ctx.ask(C(`${kind}_prompt`));
    if (answer === null || !answer.trim()) return;
    if (valid(answer)) {
      ctx.out(C('privilege'));
      return;
    }
    ctx.out(C(`bad_${kind}`));
  }
};

// ── dir / cd ─────────────────────────────────────────────────────────────────────────────────

const selfTime = (ctx: Ctx, path: string): number => {
  const i = path.lastIndexOf('\\');
  if (i <= 2) return Math.floor(Date.now() / 1000) - 86400 * 2;
  const parent = path.slice(0, i);
  const name = path.slice(i + 1).toLowerCase();
  return ctx.fs.list(parent).find(n => n.name.toLowerCase() === name)?.mtime ?? Math.floor(Date.now() / 1000);
};

const dirRow = (ctx: Ctx, n: FsNode): string => {
  const d = new Date(n.mtime * 1000);
  return `${dateMDY(d)}  ${pad(timeHM(d, ctx.clock24), 8)}${n.dir ? '    <DIR>         ' : lpad(num(n.size), 18)} ${n.name}`;
};

const dir: Command = (ctx, args) => {
  const bare = args.some(a => a.toLowerCase() === '/b');
  const target = args.filter(a => !a.startsWith('/')).join(' ');
  const path = target ? ctx.fs.resolve(ctx.cwd, target) : ctx.cwd;
  if (path === 'bad-drive') {
    ctx.out(C('no_drive'));
    return;
  }
  const h = hash(ctx.payload.computer.hostname);
  if (!bare) {
    ctx.out(C('dir_volume'));
    ctx.out(C('dir_serial', `${(h >>> 16).toString(16).toUpperCase().padStart(4, '0')}-${(h & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`));
    ctx.out('');
    ctx.out(C('dir_of', path ?? ctx.cwd));
    ctx.out('');
  }
  if (!path) {
    ctx.out(C('file_not_found'));
    return;
  }
  const nodes = ctx.fs.list(path);
  if (bare) {
    nodes.forEach(n => ctx.out(n.name));
    return;
  }
  const isRoot = path === 'C:\\';
  if (!isRoot) {
    const own = selfTime(ctx, path);
    ctx.out(dirRow(ctx, { name: '.', dir: true, size: 0, mtime: own }));
    ctx.out(dirRow(ctx, { name: '..', dir: true, size: 0, mtime: own }));
  }
  nodes.forEach(n => ctx.out(dirRow(ctx, n)));
  const files = nodes.filter(n => !n.dir);
  const dirs = nodes.length - files.length + (isRoot ? 0 : 2);
  const bytes = files.reduce((s, n) => s + n.size, 0);
  ctx.out(`${lpad(files.length, 16)} ${C('dir_files')} ${lpad(num(bytes), 14)} ${C('dir_bytes')}`);
  ctx.out(`${lpad(dirs, 16)} ${C('dir_dirs')} ${lpad(num(48213442560 + (h % 900000000)), 15)} ${C('dir_free')}`);
};

const cd: Command = (ctx, _args, rest) => {
  const a = rest.trim().replace(/^\/d\s+/i, '');
  if (!a) {
    ctx.out(ctx.cwd);
    return;
  }
  const p = ctx.fs.resolve(ctx.cwd, a);
  if (p === 'bad-drive') ctx.out(C('no_drive'));
  else if (!p) ctx.out(C('no_path'));
  else ctx.setCwd(p);
};

// ── network / system ─────────────────────────────────────────────────────────────────────────

const IPC = {
  suffix: '   Connection-specific DNS Suffix  . : ',
  v6: '   Link-local IPv6 Address . . . . . : ',
  v4: '   IPv4 Address. . . . . . . . . . . : ',
  mask: '   Subnet Mask . . . . . . . . . . . : ',
  gw: '   Default Gateway . . . . . . . . . : ',
  host: '   Host Name . . . . . . . . . . . . : ',
  primary: '   Primary Dns Suffix  . . . . . . . : ',
  node: '   Node Type . . . . . . . . . . . . : ',
  routing: '   IP Routing Enabled. . . . . . . . : ',
  wins: '   WINS Proxy Enabled. . . . . . . . : ',
  search: '   DNS Suffix Search List. . . . . . : ',
  desc: '   Description . . . . . . . . . . . : ',
  phys: '   Physical Address. . . . . . . . . : ',
  dhcp: '   DHCP Enabled. . . . . . . . . . . : ',
  auto: '   Autoconfiguration Enabled . . . . : ',
  obtained: '   Lease Obtained. . . . . . . . . . : ',
  expires: '   Lease Expires . . . . . . . . . . : ',
  dhcpSrv: '   DHCP Server . . . . . . . . . . . : ',
  dns: '   DNS Servers . . . . . . . . . . . : ',
  netbios: '   NetBIOS over Tcpip. . . . . . . . : ',
};
const NIC = 'LS-Net Gigabit Ethernet Adapter';

const longStamp = (d: Date, clock24: boolean): string =>
  `${fmtLongDateFull(d)} ${fmtTime(d, clock24)}`;

const ipconfig: Command = async (ctx, args) => {
  const opt = (args[0] ?? '').toLowerCase();
  if (opt && !['/all', '/flushdns', '/release', '/renew'].includes(opt)) {
    ctx.out('');
    ctx.out(C('ipconfig_bad'));
    ctx.out(t('ui.cmd.usage.ipconfig'));
    return;
  }
  ctx.out('');
  ctx.out('IP Configuration');
  ctx.out('');
  if (opt === '/release' || opt === '/renew') {
    ctx.out(C('elevation'));
    return;
  }
  if (opt === '/flushdns') {
    ctx.out(C('flushdns'));
    return;
  }
  const si = await ctx.sysinfo();
  if (!si) return;
  const suffix = dnsSuffix(si.domain);
  const gw = gatewayOf(si.ip);
  if (opt === '/all') {
    const boot = new Date(Date.now() - si.uptime * 1000);
    ctx.out(IPC.host + si.hostname);
    ctx.out(IPC.primary + suffix);
    ctx.out(IPC.node + 'Hybrid');
    ctx.out(IPC.routing + 'No');
    ctx.out(IPC.wins + 'No');
    if (suffix) ctx.out(IPC.search + suffix);
    ctx.out('');
    ctx.out('Ethernet adapter Ethernet:');
    ctx.out('');
    ctx.out(IPC.suffix + suffix);
    ctx.out(IPC.desc + NIC);
    ctx.out(IPC.phys + si.mac);
    ctx.out(IPC.dhcp + 'Yes');
    ctx.out(IPC.auto + 'Yes');
    ctx.out(IPC.v6 + linkLocal(si.mac) + '(Preferred)');
    ctx.out(IPC.v4 + si.ip + '(Preferred)');
    ctx.out(IPC.mask + '255.255.255.0');
    ctx.out(IPC.obtained + longStamp(boot, ctx.clock24));
    ctx.out(IPC.expires + longStamp(new Date(boot.getTime() + 86400000), ctx.clock24));
    ctx.out(IPC.gw + gw);
    ctx.out(IPC.dhcpSrv + gw);
    ctx.out(IPC.dns + gw);
    ctx.out(IPC.netbios + 'Enabled');
    return;
  }
  ctx.out('');
  ctx.out('Ethernet adapter Ethernet:');
  ctx.out('');
  ctx.out(IPC.suffix + suffix);
  ctx.out(IPC.v6 + linkLocal(si.mac));
  ctx.out(IPC.v4 + si.ip);
  ctx.out(IPC.mask + '255.255.255.0');
  ctx.out(IPC.gw + gw);
};

const tzLabel = (): string => {
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    /* no Intl zone */
  }
  return `(UTC${sign}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}) ${zone}`.trim();
};

const systeminfo: Command = async ctx => {
  const status = ctx.out(C('si_loading_os'));
  const si = await ctx.sysinfo();
  if (!si) {
    ctx.remove(status);
    return;
  }
  if (!(await ctx.sleep(350))) return;
  ctx.replace(status, C('si_loading_hotfix'));
  if (!(await ctx.sleep(300))) return;
  ctx.replace(status, C('si_loading_nic'));
  if (!(await ctx.sleep(650))) return;
  ctx.remove(status);

  const h = hash(si.hostname);
  const row = (k: string, v: string) => ctx.out(`${pad(k + ':', 27)}${v}`);
  const cont = (v: string) => ctx.out(`${' '.repeat(27)}${v}`);
  const boot = new Date(Date.now() - si.uptime * 1000);
  const installed = new Date(Date.now() - (380 + (h % 200)) * 86400000);
  const totalMb = 16175;
  const freeMb = 7400 + (h % 3800);
  const suffix = dnsSuffix(si.domain);
  const buildNo = si.build.split('.').pop() ?? si.build;
  ctx.out('');
  row('Host Name', si.hostname);
  row('OS Name', si.os);
  row('OS Version', `${si.build} N/A Build ${buildNo}`);
  row('OS Manufacturer', 'SD Systems');
  row('OS Configuration', suffix ? 'Member Workstation' : 'Standalone Workstation');
  row('OS Build Type', 'Multiprocessor Free');
  row('Registered Owner', si.user);
  row('Registered Organization', si.label);
  row('Product ID', `00330-80000-${String(h % 100000).padStart(5, '0')}-AA${String(h % 1000).padStart(3, '0')}`);
  row('Original Install Date', stampLong(installed, ctx.clock24));
  row('System Boot Time', stampLong(boot, ctx.clock24));
  row('System Up Time', fmtDuration(si.uptime));
  row('System Manufacturer', 'Los Santos Systems');
  row('System Model', 'LSX Workstation 7');
  row('System Type', 'x64-based PC');
  row('Processor(s)', '1 Processor(s) Installed.');
  cont('[01]: x64 Family 6 Model 167 Stepping 1 LS-Core ~2496 Mhz');
  row('BIOS Version', 'LSX Firmware 1.21.0, 3/14/2026');
  row('System Directory', 'C:\\System');
  row('Boot Device', '\\Device\\HarddiskVolume1');
  row('System Locale', 'en-us;English (United States)');
  row('Input Locale', '00000409');
  row('Time Zone', tzLabel());
  row('Total Physical Memory', `${num(totalMb)} MB`);
  row('Available Physical Memory', `${num(freeMb)} MB`);
  row('Virtual Memory: Max Size', `${num(totalMb + 2432)} MB`);
  row('Virtual Memory: Available', `${num(freeMb + 1650)} MB`);
  row('Virtual Memory: In Use', `${num(totalMb + 2432 - freeMb - 1650)} MB`);
  row('Page File Location(s)', 'C:\\pagefile.sys');
  row('Domain', suffix || 'WORKGROUP');
  row('Logon Server', suffix ? `\\\\${si.domain.toUpperCase()}-DC01` : `\\\\${si.hostname}`);
  row('Hotfix(s)', '3 Hotfix(s) Installed.');
  cont('[01]: KB5031455');
  cont('[02]: KB5032007');
  cont('[03]: KB5041585');
  row('Network Card(s)', '1 NIC(s) Installed.');
  cont(`[01]: ${NIC}`);
  cont('      Connection Name: Ethernet');
  cont('      DHCP Enabled:    Yes');
  cont(`      DHCP Server:     ${gatewayOf(si.ip)}`);
  cont('      IP address(es)');
  cont(`      [01]: ${si.ip}`);
  cont(`      [02]: ${linkLocal(si.mac).replace(/%\d+$/, '')}`);
  row('Hyper-V Requirements', C('si_hyperv'));
};

/** A believable address for any name: own host / localhost / IPv4 literal / internal / public. */
const resolveHost = (ctx: Ctx, host: string): { ip: string; named: boolean; local: boolean; internal: boolean } => {
  const lower = host.toLowerCase();
  if (lower === 'localhost' || /^127\./.test(lower)) return { ip: /^127\./.test(lower) ? lower : '127.0.0.1', named: lower === 'localhost', local: true, internal: true };
  if (lower === ctx.payload.computer.hostname.toLowerCase()) return { ip: ctx.payload.computer.ip, named: true, local: true, internal: true };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) return { ip: lower, named: false, local: false, internal: /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(lower) };
  const h = hash(lower);
  if (lower.includes('.')) return { ip: `${(h % 180) + 20}.${(h >>> 8) % 256}.${(h >>> 16) % 256}.${((h >>> 24) % 253) + 1}`, named: true, local: false, internal: false };
  const own = ctx.payload.computer.ip.split('.');
  return { ip: `${own[0]}.${own[1]}.${(h >>> 8) % 256}.${(h % 252) + 2}`, named: true, local: false, internal: true };
};

const ping: Command = async (ctx, args) => {
  let count = 4;
  let forever = false;
  let size = 32;
  let host = '';
  for (let i = 0; i < args.length; i++) {
    const a = args[i].toLowerCase();
    if (a === '-t' || a === '/t') forever = true;
    else if (a === '-n' || a === '/n') {
      const n = parseInt(args[++i] ?? '', 10);
      if (!(n > 0)) {
        ctx.out(C('ping_bad_value', '-n'));
        return;
      }
      count = Math.min(n, 1000);
    } else if (a === '-l' || a === '/l') {
      const n = parseInt(args[++i] ?? '', 10);
      if (!(n >= 0 && n <= 65500)) {
        ctx.out(C('ping_bad_size'));
        return;
      }
      size = n;
    } else if (a.startsWith('-') || a.startsWith('/')) {
      ctx.out(C('ping_bad_option', args[i]));
      return;
    } else host = args[i];
  }
  if (!host) {
    ctx.out(t('ui.cmd.usage.ping'));
    return;
  }
  const r = resolveHost(ctx, host);
  const ttl = r.internal ? 128 : 117;
  const times: number[] = [];
  let sent = 0;
  const stats = (print: Printer) => {
    const lost = sent - times.length;
    print(C('ping_stats', r.ip));
    print(C('ping_packets', sent, times.length, lost, sent ? Math.round((lost / sent) * 100) : 0));
    if (times.length) {
      print(C('ping_rtt'));
      print(C('ping_rtt_values', Math.min(...times), Math.max(...times), Math.round(times.reduce((s, x) => s + x, 0) / times.length)));
    }
  };
  ctx.out('');
  ctx.out(r.named ? C('ping_header_named', r.local && host.toLowerCase() === 'localhost' ? ctx.payload.computer.hostname : host, r.ip, size) : C('ping_header', r.ip, size));
  ctx.job.onCancel.push(print => {
    print('');
    stats(print);
    print('Control-C');
  });
  for (let i = 0; forever || i < count; i++) {
    if (!(await ctx.sleep(i === 0 ? 300 : 420))) return;
    sent++;
    const ms = r.local ? 0 : 8 + Math.floor(Math.random() * 33);
    times.push(ms);
    ctx.out(r.local ? C('ping_reply_fast', r.ip, size, ttl) : C('ping_reply', r.ip, size, ms, ttl));
  }
  ctx.job.onCancel = [];
  ctx.out('');
  stats(ctx.out);
};

const SYSTEM_TASKS: [string, number, string, number, number][] = [
  ['System Idle Process', 0, 'Services', 0, 8],
  ['System', 4, 'Services', 0, 9412],
  ['Registry', 132, 'Services', 0, 58228],
  ['sessiond.exe', 512, 'Services', 0, 1180],
  ['kernelsvc.exe', 780, 'Services', 0, 6532],
  ['init.exe', 872, 'Services', 0, 7036],
  ['services.exe', 944, 'Services', 0, 12612],
  ['authd.exe', 968, 'Services', 0, 24280],
  ['svchost.exe', 1096, 'Services', 0, 34644],
  ['logon.exe', 1012, 'Console', 1, 12888],
  ['compositor.exe', 1384, 'Console', 1, 104512],
  ['desktop.exe', 5124, 'Console', 1, 142880],
];

const tasklist: Command = ctx => {
  const rows: [string, number, string, number, number][] = [...SYSTEM_TASKS];
  for (const w of useOS.getState().windows) {
    if (w.exit === 'close') continue;
    let image: string;
    if (w.app === 'cmd') image = 'cmd.exe';
    else if (w.app === 'hack') image = (w.props?.run as HackRun | undefined)?.program ?? w.title;
    else image = `${w.title.replace(/[^A-Za-z0-9_-]/g, '') || w.app}.exe`;
    rows.push([image, pidFor(w.id), 'Console', 1, 18000 + (hash(w.id) % 140000)]);
    if (w.app === 'cmd') rows.push(['conhost.exe', pidFor(w.id) + 8, 'Console', 1, 7120 + (hash(w.id) % 4000)]);
  }
  rows.push(['tasklist.exe', pidFor(`tasklist${Date.now()}`), 'Console', 1, 9876]);
  ctx.out('');
  ctx.out(`${pad('Image Name', 25)} ${lpad('PID', 8)} ${pad('Session Name', 16)} ${lpad('Session#', 11)} ${lpad('Mem Usage', 12)}`);
  ctx.out(`${'='.repeat(25)} ${'='.repeat(8)} ${'='.repeat(16)} ${'='.repeat(11)} ${'='.repeat(12)}`);
  for (const [image, pid, session, n, kb] of rows) {
    ctx.out(`${pad(image.slice(0, 25), 25)} ${lpad(pid, 8)} ${pad(session, 16)} ${lpad(n, 11)} ${lpad(`${num(kb)} K`, 12)}`);
  }
};

// ── help + dispatch ──────────────────────────────────────────────────────────────────────────

const helpFor = (ctx: Ctx, name: string): void => {
  if (!COMMANDS[name]) {
    ctx.out(C('help_unknown', name.toUpperCase()));
    return;
  }
  ctx.out(C(`help.${name}`));
  const usageKey = `ui.cmd.usage.${name}`;
  const usage = t(usageKey);
  if (usage !== usageKey) {
    ctx.out('');
    ctx.out(usage);
  }
};

const help: Command = (ctx, args) => {
  if (args[0]) {
    helpFor(ctx, args[0].toLowerCase());
    return;
  }
  const names = Object.keys(COMMANDS).sort();
  const w = Math.max(...names.map(n => n.length)) + 5;
  ctx.out(C('help_intro'));
  for (const n of names) ctx.out(pad(n.toUpperCase(), w) + C(`help.${n}`));
  ctx.out('');
  ctx.out(C('help_outro'));
};

export const COMMANDS: Record<string, Command> = {
  cd,
  cls,
  color,
  date: dateOrTime('date'),
  dir,
  echo,
  exit,
  help,
  hostname,
  ipconfig,
  ping,
  systeminfo,
  tasklist,
  time: dateOrTime('time'),
  title,
  ver,
  whoami,
  ...HACK_COMMANDS,
};

/** Command names for Tab completion. */
export const COMMAND_NAMES = (): string[] => Object.keys(COMMANDS).sort();

/** Parse one input line like cmd: %VARS%, a leading @, then the verb up to a delimiter (`cd..`, `echo.`). */
export async function runLine(ctx: Ctx, raw: string): Promise<void> {
  const src = expandVars(ctx, raw).replace(/^[\s@]+/, '');
  const m = src.match(/^([^\s./\\(]+)([\s\S]*)$/);
  const first = src.split(/\s+/)[0] ?? src;
  const name = m ? m[1].toLowerCase() : '';
  const cmd = m ? COMMANDS[name] : undefined;
  if (!m || !cmd) {
    ctx.out(C('not_recognized', first));
    return;
  }
  let rest = m[2];
  if (/^\.(exe|com)\b/i.test(rest)) rest = rest.slice(4);
  else if (rest.startsWith('.') && name !== 'echo' && name !== 'cd' && !/^\.\./.test(rest)) {
    ctx.out(C('not_recognized', first));
    return;
  }
  const args = tokenize(rest);
  if (args.includes('/?')) {
    helpFor(ctx, name);
    return;
  }
  await cmd(ctx, args, rest);
}
