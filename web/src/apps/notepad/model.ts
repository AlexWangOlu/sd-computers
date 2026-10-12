import { t } from '@/i18n';

// Notepad's data: server notes (server/computers/profile.lua) and the open tabs that edit them.

/** A saved note, exactly as notes:list / notes:save return it. */
export interface Note {
  id: string;
  title: string;
  body: string;
  /** unix seconds */
  updatedAt: number;
}

export const MAX_TITLE = 80;
export const MAX_BODY = 20000;

/** One open tab. `id` is null until the first save; `title` is null until then too (derived). */
export interface Tab {
  key: string;
  id: string | null;
  title: string | null;
  body: string;
  /** The body as last saved/loaded - the tab is dirty while body differs. */
  saved: string;
}

let keySeq = 0;
const nextKey = (): string => `tab${++keySeq}`;

export const blankTab = (): Tab => ({ key: nextKey(), id: null, title: null, body: '', saved: '' });

export const tabFromNote = (n: Note): Tab => ({
  key: nextKey(),
  id: String(n.id),
  title: n.title,
  body: n.body ?? '',
  saved: n.body ?? '',
});

/** A new note's title: its first non-empty line, max 80 chars, "Untitled" when there is none. */
export const deriveTitle = (body: string): string => {
  const line = body.split('\n').find(l => l.trim() !== '');
  return line ? line.trim().slice(0, MAX_TITLE) : t('ui.notepad.untitled');
};

export const tabTitle = (tab: Tab): string => tab.title ?? deriveTitle(tab.body);

export const isDirty = (tab: Tab): boolean => tab.body !== tab.saved;

/** A tab nobody has touched: Open replaces it instead of adding a new one. */
export const isPristine = (tab: Tab): boolean => tab.id === null && tab.body === '';

/** Defensive read of notes:list (an empty Lua table may arrive as {} instead of []). */
export const asNotes = (data: unknown): Note[] =>
  Array.isArray(data) ? [...(data as Note[])].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)) : [];

// View preferences (zoom / word wrap / status bar) - a per-player convenience, so localStorage.

export interface ViewPrefs {
  zoom: number;
  wrap: boolean;
  status: boolean;
}

const PREFS_KEY = 'sd-computers:notepad:view';
export const ZOOM_MIN = 10;
export const ZOOM_MAX = 500;
export const ZOOM_STEP = 10;

export function loadPrefs(): ViewPrefs {
  const def: ViewPrefs = { zoom: 100, wrap: true, status: true };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return def;
    const p = JSON.parse(raw) as Partial<ViewPrefs>;
    return {
      zoom: typeof p.zoom === 'number' ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, p.zoom)) : def.zoom,
      wrap: typeof p.wrap === 'boolean' ? p.wrap : def.wrap,
      status: typeof p.status === 'boolean' ? p.status : def.status,
    };
  } catch {
    return def;
  }
}

export function savePrefs(p: ViewPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // storage blocked - the setting just won't survive a reload
  }
}

/** "Ln 3, Col 14" for a caret offset. */
export function lineCol(body: string, pos: number): { ln: number; col: number } {
  const before = body.slice(0, pos);
  let ln = 1;
  for (let i = 0; i < before.length; i++) if (before.charCodeAt(i) === 10) ln++;
  return { ln, col: pos - before.lastIndexOf('\n') };
}
