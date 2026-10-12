import { create } from 'zustand';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import type { NoteFull, SaveData } from './types';
import { MAX_BODY, asArray, deriveText, matches, normRow, sortRows, strList, type Row } from './model';

/**
 * Notes' state + every server call. One Notes window at most (its window id is the app id), so a
 * module-level store is safe; the root resets it on mount.
 *
 * Text is autosaved. Each note being edited has a `Doc` holding its latest text and a promise
 * chain its saves and its delete run on, one at a time. That is what keeps a new note from being
 * created twice (the second save waits for the first to return the id) and a delete from racing a
 * save (the link's save is an upsert: a save landing after the delete would bring the note back).
 * The chain lives outside React, so saves still finish after the window has closed.
 */

export interface OpenNote {
  key: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  body: string;
  /** read-only here: photo URLs / sketch PNG data URLs */
  images: string[];
  sketches: string[];
}

export interface SaveState {
  state: 'saving' | 'saved' | 'error';
  error?: string;
}

export interface Notice {
  severity: 'info' | 'error';
  title?: string;
  text: string;
  retry?: () => void;
}

interface NotesState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  rows: Row[];
  /** a manual refresh is running */
  refreshing: boolean;
  search: string;
  /** the selected row's key */
  selected: string | null;
  open: OpenNote | null;
  /** autosave status per row key (absent = nothing to report) */
  saves: Record<string, SaveState | undefined>;
  notice: Notice | null;
  /** the delete confirmation for the open note */
  confirm: boolean;
  /** index into the open note's photos + sketches shown in the viewer */
  viewer: number | null;
  /** a row key whose editor should take focus once it's mounted (a new note) */
  focusKey: string | null;
}

const initial = (): NotesState => ({
  status: 'loading',
  error: undefined,
  rows: [],
  refreshing: false,
  search: '',
  selected: null,
  open: null,
  saves: {},
  notice: null,
  confirm: false,
  viewer: null,
  focusKey: null,
});

export const useNotes = create<NotesState>(() => initial());

const set = useNotes.setState;
const get = useNotes.getState;

const SAVE_DELAY = 800;

interface Doc {
  key: string;
  /** null until a new note's first save returns */
  id: string | null;
  /** the text in the editor */
  body: string;
  /** the text the phone has, as far as we know */
  saved: string;
  /** the updatedAt the server last reported for this note (spots edits made on the phone) */
  known: string;
  /** pending autosave (0 = none) */
  timer: number;
  /** saves/deletes queued or running on `chain` */
  busy: number;
  chain: Promise<unknown>;
  /** deleted: no further saves */
  gone: boolean;
  /** `writeSeq` when its latest save started */
  lastWrite: number;
}

const docs = new Map<string, Doc>();
/** Ids deleted from here: a list that was already on its way back must not bring them back. */
const deletedIds = new Set<string>();

let writeSeq = 0;
let listSeq = 0;
let openSeq = 0;
let draftSeq = 0;
let noticeTimer = 0;

const newDoc = (key: string, id: string | null, body: string): Doc => ({
  key,
  id,
  body,
  saved: body,
  known: '',
  timer: 0,
  busy: 0,
  chain: Promise.resolve(),
  gone: false,
  lastWrite: 0,
});

/** Typed-but-unsaved text, a save waiting to fire, or one on its way: the local copy wins. */
const hasLocalEdits = (d: Doc): boolean => d.body !== d.saved || d.busy > 0 || d.timer !== 0;

const isEmptyDraft = (d: Doc): boolean => d.id === null && d.body.trim() === '';

function setSave(key: string, v: SaveState | undefined): void {
  set(s => {
    if (s.saves[key] === v) return s;
    const saves = { ...s.saves };
    if (v) saves[key] = v;
    else delete saves[key];
    return { saves };
  });
}

const patchRow = (key: string, patch: Partial<Row>): void => set(s => ({ rows: sortRows(s.rows.map(r => (r.key === key ? { ...r, ...patch } : r))) }));
const dropRow = (key: string): void => set(s => ({ rows: s.rows.filter(r => r.key !== key) }));

export function showNotice(n: Notice | null): void {
  window.clearTimeout(noticeTimer);
  set({ notice: n });
  if (n && n.severity === 'info') noticeTimer = window.setTimeout(() => set({ notice: null }), 6000);
}

// ── The save/delete chain ──────────────────────────────────────────────────────────────────────

function enqueue<T>(d: Doc, job: () => Promise<T>, fallback: T): Promise<T> {
  d.busy++;
  const p = d.chain
    .then(job)
    .catch(() => fallback)
    .then(v => {
      d.busy--;
      return v;
    });
  d.chain = p;
  return p;
}

/** (Re)start the autosave countdown after an edit. */
function schedule(d: Doc): void {
  window.clearTimeout(d.timer);
  d.timer = 0;
  if (d.gone) return;
  // A new note is only created once it has some text.
  if (isEmptyDraft(d) && d.busy === 0) {
    setSave(d.key, undefined);
    return;
  }
  d.timer = window.setTimeout(() => {
    d.timer = 0;
    void flushDoc(d);
  }, SAVE_DELAY);
  setSave(d.key, { state: 'saving' });
}

/** Save now (queued behind whatever is already running for this note). */
function flushDoc(d: Doc): Promise<boolean> {
  window.clearTimeout(d.timer);
  d.timer = 0;
  if (d.gone) return Promise.resolve(true);
  return enqueue(d, () => writeOnce(d), false);
}

/** After a save: report "Saved", or keep going if the text moved on meanwhile. */
function settle(d: Doc): void {
  if (d.gone || d.busy > 1 || d.timer) return; // more already on the way
  if (d.body !== d.saved && !isEmptyDraft(d)) {
    schedule(d);
    return;
  }
  setSave(d.key, d.id === null ? undefined : { state: 'saved' });
}

/** One phonenotes:save of the doc's CURRENT text - it runs on the chain, so `d.id` is settled. */
async function writeOnce(d: Doc): Promise<boolean> {
  if (d.gone) return true;
  if (isEmptyDraft(d)) {
    setSave(d.key, undefined);
    return true;
  }
  if (d.id !== null && d.body === d.saved) {
    settle(d);
    return true;
  }
  const body = d.body;
  d.lastWrite = ++writeSeq;
  setSave(d.key, { state: 'saving' });
  const r = await rpc<SaveData>('phonenotes:save', d.id !== null ? { id: d.id, body } : { body });
  const id = r.ok ? (r.data && r.data.id ? String(r.data.id) : d.id) : null;
  if (!r.ok || id === null) {
    if (!d.gone) setSave(d.key, { state: 'error', error: r.error ?? t('ui.common.error') });
    return false;
  }
  d.id = id;
  d.saved = body;
  if (r.data?.updatedAt) d.known = String(r.data.updatedAt);
  if (!d.gone) {
    const patch: Partial<Row> = { id };
    if (r.data?.createdAt) patch.createdAt = String(r.data.createdAt);
    // Only adopt the server's time when nothing was typed meanwhile (that edit's local time is newer).
    if (r.data?.updatedAt && d.body === body) patch.updatedAt = String(r.data.updatedAt);
    patchRow(d.key, patch);
  }
  settle(d);
  return true;
}

/** Delete the note on the phone, after any save already queued (which may be the one creating it). */
function removeDoc(d: Doc): Promise<string | null> {
  d.gone = true;
  window.clearTimeout(d.timer);
  d.timer = 0;
  if (docs.get(d.key) === d) docs.delete(d.key);
  if (d.id) deletedIds.add(d.id);
  setSave(d.key, undefined);
  return enqueue(
    d,
    async () => {
      const id = d.id;
      if (!id) return null; // never reached the phone
      deletedIds.add(id);
      const r = await rpc('phonenotes:delete', { id });
      if (r.ok) return null;
      deletedIds.delete(id);
      return r.error ?? t('ui.common.error');
    },
    t('ui.common.error'),
  );
}

/**
 * Leaving the selected note (another note, New note, Back, closing the window): save what's
 * pending - or, the phone's own rule, remove it when it has no text and no photos or sketches.
 */
function leave(): void {
  const s = get();
  const key = s.selected;
  const d = key ? docs.get(key) : undefined;
  if (!key || !d) return;
  const o = s.open;
  const loaded = !!o && o.key === key && o.status === 'ready';
  if (loaded && d.body.trim() === '' && o.images.length === 0 && o.sketches.length === 0) {
    dropRow(key);
    void removeDoc(d).then(err => {
      if (err) void loadList({ silent: true });
    });
    return;
  }
  if (d.timer || d.body !== d.saved) void flushDoc(d);
}

// ── List ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Fold a fresh phonenotes:list into the rows. A note with local edits keeps its local title,
 * preview and time, as does one whose save was running when the request left or started after
 * it (the reply may predate it); drafts the phone doesn't know yet stay; anything else missing
 * was deleted on the phone.
 */
function mergeRows(server: Row[], mark: number, busyAtStart: Set<string>): Row[] {
  const s = get();
  const localWins = (d: Doc | undefined): boolean => !!d && !d.gone && (hasLocalEdits(d) || busyAtStart.has(d.key) || d.lastWrite > mark);
  const byId = new Map<string, Row>();
  for (const r of s.rows) if (r.id) byId.set(r.id, r);
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const n of server) {
    if (!n.id || deletedIds.has(n.id) || seen.has(n.id)) continue;
    const local = byId.get(n.id);
    const key = local ? local.key : n.id;
    if (seen.has(key)) continue;
    seen.add(key);
    seen.add(n.id);
    out.push(local && localWins(docs.get(key)) ? { ...local, images: n.images, sketches: n.sketches } : { ...n, key });
  }
  for (const r of s.rows) {
    if (seen.has(r.key)) continue;
    const d = docs.get(r.key);
    if (r.id === null ? !!d && !d.gone : localWins(d)) out.push(r);
  }
  return sortRows(out);
}

/** phonenotes:list. `silent` = no spinner anywhere (window re-activated); `manual` = the refresh button. */
export async function loadList(opts: { silent?: boolean; manual?: boolean } = {}): Promise<void> {
  const seq = ++listSeq;
  const mark = writeSeq;
  const busyAtStart = new Set<string>();
  docs.forEach(d => {
    if (d.busy > 0) busyAtStart.add(d.key);
  });
  if (get().status !== 'ready') set({ status: 'loading', error: undefined });
  else if (opts.manual) set({ refreshing: true });

  const r = await rpc<{ notes: unknown }>('phonenotes:list', {});
  if (seq !== listSeq) return;
  if (!r.ok || !r.data) {
    const error = r.error ?? t('ui.common.error');
    if (get().status !== 'ready') set({ status: 'error', error, refreshing: false });
    else {
      set({ refreshing: false });
      showNotice({ severity: 'error', title: t('ui.notes.refresh_failed'), text: error, retry: () => void loadList({ manual: true }) });
    }
    return;
  }
  const server = asArray<unknown>(r.data.notes)
    .map(normRow)
    .filter((x): x is Row => x !== null);
  const rows = mergeRows(server, mark, busyAtStart);
  const s = get();
  set({ status: 'ready', error: undefined, refreshing: false, rows, notice: s.notice?.retry ? null : s.notice });
  if (s.notice?.retry) window.clearTimeout(noticeTimer);
  syncOpen();
}

/** After a list refresh: the open note was deleted on the phone, or edited there. */
function syncOpen(): void {
  const s = get();
  const key = s.selected;
  if (!key) return;
  const row = s.rows.find(r => r.key === key);
  if (!row) {
    openSeq++;
    set({ selected: null, open: null, viewer: null, confirm: false });
    showNotice({ severity: 'info', text: t('ui.notes.removed_elsewhere') });
    return;
  }
  const d = docs.get(key);
  // Re-read it only when the phone has a newer version AND nothing typed here would be overwritten.
  if (s.open?.key === key && s.open.status === 'ready' && d && d.id && !hasLocalEdits(d) && row.updatedAt !== d.known) {
    void fetchOpen(key, d.id, true);
  }
}

// ── Opening a note ─────────────────────────────────────────────────────────────────────────────

/** phonenotes:get. `silent` = a background re-read of the open note (no spinner, errors ignored). */
async function fetchOpen(key: string, id: string, silent = false): Promise<void> {
  const seq = ++openSeq;
  const r = await rpc<NoteFull>('phonenotes:get', { id });
  if (seq !== openSeq || get().open?.key !== key) return;
  if (!r.ok || !r.data) {
    if (!silent) set(s => ({ open: s.open && s.open.key === key ? { ...s.open, status: 'error', error: r.error ?? t('ui.common.error') } : s.open }));
    return;
  }
  const n = r.data;
  const body = (typeof n.body === 'string' ? n.body : '').slice(0, MAX_BODY);
  let d = docs.get(key);
  if (!d) {
    d = newDoc(key, id, body);
    docs.set(key, d);
  }
  // Never clobber text typed here that the phone doesn't have yet.
  const mine = hasLocalEdits(d);
  if (!mine) {
    d.body = body;
    d.saved = body;
  }
  if (typeof n.updatedAt === 'string') d.known = n.updatedAt;
  const images = strList(n.images);
  const sketches = strList(n.sketches);
  const text = d.body;
  set(s => ({
    open: { key, status: 'ready', body: text, images, sketches },
    rows: sortRows(
      s.rows.map(row => {
        if (row.key !== key) return row;
        const media = { images: images.length, sketches: sketches.length };
        if (mine) return { ...row, ...media };
        return {
          ...row,
          ...media,
          ...deriveText(text),
          createdAt: typeof n.createdAt === 'string' && n.createdAt ? n.createdAt : row.createdAt,
          updatedAt: typeof n.updatedAt === 'string' && n.updatedAt ? n.updatedAt : row.updatedAt,
        };
      }),
    ),
  }));
}

export function selectNote(key: string): void {
  const s = get();
  if (s.selected === key && s.open && s.open.status !== 'error') return;
  if (s.selected !== key) leave();
  const row = get().rows.find(r => r.key === key);
  if (!row) return;
  openSeq++;
  const d = docs.get(key);
  const id = d?.id ?? row.id;
  const base = { selected: key, viewer: null, confirm: false };
  if (!id) {
    // A new note that hasn't reached the phone yet: nothing to fetch.
    set({ ...base, open: { key, status: 'ready', body: d?.body ?? '', images: [], sketches: [] } });
    return;
  }
  set({ ...base, open: { key, status: 'loading', body: '', images: [], sketches: [] } });
  void fetchOpen(key, id);
}

/** Retry a note that failed to open. */
export function retryOpen(): void {
  const key = get().selected;
  if (key) selectNote(key);
}

/** Back to the list (single-pane) / nothing selected. */
export function closeNote(): void {
  leave();
  openSeq++;
  set({ selected: null, open: null, viewer: null, confirm: false });
}

/** Up/Down through the (filtered) list. */
export function stepSelection(dir: 1 | -1): void {
  const s = get();
  const list = s.rows.filter(r => matches(r, s.search));
  if (list.length === 0) return;
  const i = list.findIndex(r => r.key === s.selected);
  const next = i < 0 ? (dir === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, i + dir));
  if (list[next].key !== s.selected) selectNote(list[next].key);
}

export const setSearch = (search: string): void => set({ search });

// ── Editing ────────────────────────────────────────────────────────────────────────────────────

/** A local draft at the top of the list, selected and focused. Saved once it has some text. */
export function newNote(): void {
  const s = get();
  if (s.status !== 'ready') return;
  const cur = s.selected ? docs.get(s.selected) : undefined;
  if (cur && s.open?.key === cur.key && isEmptyDraft(cur) && cur.busy === 0) {
    set({ focusKey: cur.key, search: '' });
    return;
  }
  leave();
  const key = `draft:${++draftSeq}`;
  const now = new Date().toISOString();
  docs.set(key, newDoc(key, null, ''));
  openSeq++;
  set(st => ({
    rows: sortRows([{ key, id: null, title: '', preview: '', images: 0, sketches: 0, createdAt: now, updatedAt: now }, ...st.rows]),
    selected: key,
    open: { key, status: 'ready', body: '', images: [], sketches: [] },
    search: '',
    viewer: null,
    confirm: false,
    focusKey: key,
  }));
}

export const clearFocus = (): void => set({ focusKey: null });

/** The editor's onChange: new text, the row's title/preview/time follow it, autosave restarts. */
export function editBody(text: string): void {
  const o = get().open;
  if (!o || o.status !== 'ready') return;
  let d = docs.get(o.key);
  if (!d) {
    const row = get().rows.find(r => r.key === o.key);
    d = newDoc(o.key, row?.id ?? null, o.body);
    docs.set(o.key, d);
  }
  const body = text.length > MAX_BODY ? text.slice(0, MAX_BODY) : text;
  if (body === d.body) return;
  d.body = body;
  const now = new Date().toISOString();
  const derived = deriveText(body);
  set(s => ({
    open: s.open && s.open.key === o.key ? { ...s.open, body } : s.open,
    rows: sortRows(s.rows.map(r => (r.key === o.key ? { ...r, ...derived, updatedAt: now } : r))),
  }));
  schedule(d);
}

/** Ctrl+S / Retry: save the open note now. */
export function saveNow(): void {
  const key = get().open?.key;
  const d = key ? docs.get(key) : undefined;
  if (d) void flushDoc(d);
}

// ── Deleting ───────────────────────────────────────────────────────────────────────────────────

export const askDelete = (): void => set({ confirm: true });
export const cancelDelete = (): void => set({ confirm: false });

/** Delete the open note (after the confirmation). Optimistic; a failure brings it back. */
export function deleteOpen(): void {
  const s = get();
  const key = s.selected;
  if (!key) return;
  const row = s.rows.find(r => r.key === key);
  let d = docs.get(key);
  if (!d) {
    if (!row?.id) {
      closeNote();
      return;
    }
    d = newDoc(key, row.id, '');
    docs.set(key, d);
  }
  openSeq++;
  set(st => ({ confirm: false, viewer: null, selected: null, open: null, rows: st.rows.filter(r => r.key !== key) }));
  void removeDoc(d).then(err => {
    if (!err) return;
    showNotice({ severity: 'error', title: t('ui.notes.delete_failed'), text: err });
    void loadList({ silent: true });
  });
}

// ── Photo / sketch viewer ──────────────────────────────────────────────────────────────────────

const mediaCount = (): number => {
  const o = get().open;
  return o ? o.images.length + o.sketches.length : 0;
};

export const openViewer = (index: number): void => set({ viewer: index });
export const closeViewer = (): void => set({ viewer: null });

export function stepViewer(dir: 1 | -1): void {
  const v = get().viewer;
  if (v === null) return;
  set({ viewer: Math.min(mediaCount() - 1, Math.max(0, v + dir)) });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────────────────────

/** Window opened: fresh state (keeping notes still saving from a previous window), load the list. */
export function initNotes(): void {
  docs.forEach((d, k) => {
    if (d.busy === 0 && d.timer === 0) docs.delete(k);
  });
  listSeq++;
  openSeq++;
  window.clearTimeout(noticeTimer);
  set(initial(), true);
  void loadList();
}

/** Window closing: fire-and-forget every pending save, so nothing typed is lost. */
export function teardownNotes(): void {
  leave();
  docs.forEach(d => {
    if (d.timer) void flushDoc(d);
  });
  listSeq++;
  openSeq++;
  window.clearTimeout(noticeTimer);
}
