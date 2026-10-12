import { t } from '@/i18n';

// Console helpers: the classic conhost (Campbell) palette, column padding and the deterministic
// "random" numbers (PIDs, memory, serials) that keep fake output stable between runs.

export const C = (key: string, ...args: unknown[]): string => t(`ui.cmd.${key}`, ...args);

/** conhost defaults: COLOR 07. */
export const DEFAULT_FG = '#cccccc';
export const DEFAULT_BG = '#0c0c0c';
export const GREEN = '#16c60c';
export const RED = '#e74856';
export const YELLOW = '#f9f1a5';
export const CYAN = '#61d6d6';
export const GRAY = '#767676';

/** COLOR attribute digit -> Campbell colour. */
export const PALETTE: Record<string, string> = {
  '0': '#0c0c0c',
  '1': '#0037da',
  '2': '#13a10e',
  '3': '#3a96dd',
  '4': '#c50f1f',
  '5': '#881798',
  '6': '#c19c00',
  '7': '#cccccc',
  '8': '#767676',
  '9': '#3b78ff',
  a: '#16c60c',
  b: '#61d6d6',
  c: '#e74856',
  d: '#b4009e',
  e: '#f9f1a5',
  f: '#f2f2f2',
};

export const pad = (s: string | number, n: number): string => String(s).padEnd(n);
export const lpad = (s: string | number, n: number): string => String(s).padStart(n);
export const num = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Stable 32-bit hash (djb2). */
export const hash = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
};

/** A realistic-looking PID (multiple of 4) for a window/process key. */
export const pidFor = (key: string): number => 1000 + ((hash(key) % 2250) * 4);

/** First name of "Jessica Hale" -> "Jessica". */
export const firstName = (full: string): string => full.trim().split(/\s+/)[0] || 'User';

/** "Jessica Hale" -> "jessica.hale" (whoami / %USERNAME%). */
export const accountName = (full: string): string =>
  full
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(p => p.replace(/[^a-z0-9_-]/g, ''))
    .filter(Boolean)
    .join('.') || 'user';

/** WORKGROUP stays as is; a group domain becomes "<group>.local". */
export const dnsSuffix = (domain: string): string => (domain.toUpperCase() === 'WORKGROUP' ? '' : `${domain.toLowerCase()}.local`);

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "10/05/2026" */
export const dateMDY = (d: Date): string => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;

/** "09:12 AM" / "21:12" (dir listing, time /t). */
export const timeHM = (d: Date, clock24: boolean): string => {
  if (clock24) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const h = d.getHours() % 12 || 12;
  return `${pad2(h)}:${pad2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};

/** "10/5/2026, 9:12:44 AM" (systeminfo). */
export const stampLong = (d: Date, clock24: boolean): string =>
  `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}, ${d.toLocaleTimeString('en-US', { hour12: !clock24 })}`;

/** Split a command tail into arguments, honouring "quoted strings". */
export const tokenize = (s: string): string[] => {
  const out: string[] = [];
  const re = /"([^"]*)"?|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
};

/** Clipboard write that survives CEF without the async clipboard permission. */
export async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    /* fall back to execCommand */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Text into a two-space-gapped table: widths from the widest cell per column. */
export const table = (rows: string[][], right: number[] = []): string[] => {
  const widths: number[] = [];
  for (const r of rows) r.forEach((c, i) => (widths[i] = Math.max(widths[i] ?? 0, c.length)));
  return rows.map(r =>
    r
      .map((c, i) => (i === r.length - 1 && !right.includes(i) ? c : right.includes(i) ? lpad(c, widths[i]) : pad(c, widths[i])))
      .join('  ')
      .replace(/\s+$/, ''),
  );
};
