import { create } from 'zustand';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import type { FileFull, FileRow, Limits, ListData, PhoneFull, PhoneRow } from './types';
import {
  DEFAULT_LIMITS,
  DRAFT_KEY,
  asArray,
  buildRows,
  clip,
  fileKey,
  normFile,
  normLimits,
  normPhone,
  normPhoneFull,
  phoneKey,
  uniqueName,
  upsert,
  type Place,
  type Row,
  type Sort,
  type SortBy,
} from './model';

/**
 * Files' state + every server call. One Files window at most (its window id is the app id), so a
 * module-level store is safe; the root resets it on mount.
 *
 * Nothing saves on its own: a document is written when the user saves it (like Notepad), and
 * leaving one with unsaved changes asks first. "Leaving" is anything that would put another
 * document in the editor or take the editor away - guardLeave() is the one place that asks.
 */

/** A Documents file in the editor. `id` null = a new one that hasn't been saved yet. */
export interface OpenFile {
  kind: 'file';
  /** goes up with every document opened: the editor is keyed by it, late replies check it */
  seq: number;
  id: number | null;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  name: string;
  body: string;
  /** name and text as the server has them - the document is dirty while either differs */
  savedName: string;
  savedBody: string;
  updatedAt: number;
  /** why the last save was refused */
  saveError?: string;
}

/** A phone document in the viewer (read-only here). */
export interface OpenPhone {
  kind: 'phone';
  seq: number;
  id: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  /** from the list, for the header while it loads */
  name: string;
  doc: PhoneFull | null;
}

export type OpenDoc = OpenFile | OpenPhone;

export type Busy = 'save' | 'delete' | 'rename' | 'copy';

export interface Notice {
  severity: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  text: string;
  /** a refresh that failed offers to run again */
  retry?: () => void;
}

/** `then` is what the user was doing when asked about unsaved changes: it runs once that's settled. */
export type DialogState = { kind: 'unsaved'; then: () => void } | { kind: 'delete' } | { kind: 'rename'; id: number; name: string } | null;

interface FilesState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  files: FileRow[];
  limits: Limits;
  /** the phone's documents can be shown on this computer (sd-phone linked, phone carried) */
  phone: boolean;
  phoneStatus: 'idle' | 'loading' | 'ready' | 'error';
  phoneError?: string;
  phoneFiles: PhoneRow[];
  place: Place;
  /** a manual refresh is running */
  refreshing: boolean;
  search: string;
  sort: Sort;
  open: OpenDoc | null;
  /** single-pane layout only: which of the two panes is showing */
  view: 'list' | 'doc';
  /** the one server action in flight */
  busy: Busy | null;
  notice: Notice | null;
  dialog: DialogState;
  /** an editor field that should take the caret once it's on screen */
  focus: 'name' | 'body' | null;
}

const initial = (): FilesState => ({
  status: 'loading',
  error: undefined,
  files: [],
  limits: DEFAULT_LIMITS,
  phone: false,
  phoneStatus: 'idle',
  phoneError: undefined,
  phoneFiles: [],
  place: 'documents',
  refreshing: false,
  search: '',
  sort: { by: 'modified', dir: -1 },
  open: null,
  view: 'list',
  busy: null,
  notice: null,
  dialog: null,
  focus: null,
});

export const useFiles = create<FilesState>(() => initial());

const set = useFiles.setState;
const get = useFiles.getState;

let listSeq = 0;
let phoneSeq = 0;
let openSeq = 0;
let noticeTimer = 0;

// ── Reading the state ──────────────────────────────────────────────────────────────────────

/** Unsaved changes: the name or the text differs from what the server has. */
export const isDirty = (o: OpenDoc | null): boolean => !!o && o.kind === 'file' && o.status === 'ready' && (o.name !== o.savedName || o.body !== o.savedBody);

/** A new document that hasn't been saved yet. */
export const isDraft = (o: OpenDoc | null): boolean => !!o && o.kind === 'file' && o.id === null;

/** The list key of the document in the editor. */
export const openKey = (o: OpenDoc | null): string | null => (!o ? null : o.kind === 'phone' ? phoneKey(o.id) : o.id === null ? DRAFT_KEY : fileKey(o.id));

/** The open document, when it is a Documents file (and, given `seq`, still the one opened as it). */
function openFile(seq?: number): OpenFile | null {
  const o = get().open;
  return o && o.kind === 'file' && (seq === undefined || o.seq === seq) ? o : null;
}

/** The lines the list shows right now. */
export function visibleRows(s: Pick<FilesState, 'place' | 'files' | 'phoneFiles' | 'search' | 'sort' | 'open'>): Row[] {
  const draftName = s.open && s.open.kind === 'file' && s.open.id === null ? s.open.name : null;
  return buildRows({ place: s.place, files: s.files, phoneFiles: s.phoneFiles, draftName, search: s.search, sort: s.sort });
}

// ── Notices ────────────────────────────────────────────────────────────────────────────────

/** The bar under the toolbar. Good news leaves by itself; a warning or an error stays until closed. */
export function showNotice(n: Notice | null): void {
  window.clearTimeout(noticeTimer);
  set({ notice: n });
  if (n && (n.severity === 'info' || n.severity === 'success')) noticeTimer = window.setTimeout(() => set({ notice: null }), 6000);
}

const fail = (title: string, error: string | undefined, retry?: () => void): void => showNotice({ severity: 'error', title, text: error ?? t('ui.common.error'), retry });

const refresh = (): void => void load({ manual: true });

// ── Lists ──────────────────────────────────────────────────────────────────────────────────

/**
 * A write just changed the list here: a files:list still on its way was read before it, so its
 * reply is dropped rather than allowed to undo what the user sees.
 */
function settleList(): void {
  listSeq++;
  set({ refreshing: false });
}

/** The phone's place went away (link dropped, phone put away): back to Documents. */
function dropPhone(): void {
  phoneSeq++;
  const s = get();
  const patch: Partial<FilesState> = { phone: false, phoneStatus: 'idle', phoneError: undefined, phoneFiles: [] };
  if (s.open && s.open.kind === 'phone') {
    openSeq++;
    patch.open = null;
    patch.view = 'list';
  }
  if (s.place === 'phone') {
    patch.place = 'documents';
    patch.view = 'list';
  }
  set(patch);
  if (s.place === 'phone') showNotice({ severity: 'info', text: t('ui.files.phone_gone') });
}

/** files:phoneList. `silent` = a background re-read: a failure leaves the list that is showing alone. */
export async function loadPhone(silent = false): Promise<void> {
  const seq = ++phoneSeq;
  if (get().phoneStatus !== 'ready') set({ phoneStatus: 'loading', phoneError: undefined });
  const r = await rpc<{ files: unknown }>('files:phoneList', {});
  if (seq !== phoneSeq) return;
  if (!r.ok || !r.data) {
    if (get().phoneStatus !== 'ready') set({ phoneStatus: 'error', phoneError: r.error ?? t('ui.common.error') });
    else if (!silent && get().place === 'phone') fail(t('ui.files.refresh_failed'), r.error, refresh);
    return;
  }
  const phoneFiles = asArray<unknown>(r.data.files)
    .map(normPhone)
    .filter((x): x is PhoneRow => x !== null);
  set({ phoneStatus: 'ready', phoneError: undefined, phoneFiles });
}

/** After a re-read: the open document may have been deleted somewhere else. */
function syncOpen(): void {
  const s = get();
  const o = s.open;
  if (!o) return;
  if (o.kind === 'file') {
    if (o.id === null || o.status !== 'ready' || s.files.some(f => f.id === o.id)) return;
    // Unsaved text is kept, as a new document: saving writes it back.
    if (isDirty(o)) {
      set({ open: { ...o, id: null } });
      return;
    }
  } else if (s.phoneStatus !== 'ready' || s.phoneFiles.some(f => f.id === o.id)) return;
  openSeq++;
  set({ open: null, view: 'list' });
  showNotice({ severity: 'info', text: t('ui.files.removed_elsewhere') });
}

/**
 * files:list, then the phone's list when the reply says that place is there. `silent` = no
 * spinner and no error bar (the window came back to the front); `manual` = the Refresh button.
 */
export async function load(opts: { silent?: boolean; manual?: boolean } = {}): Promise<void> {
  const seq = ++listSeq;
  if (get().status !== 'ready') set({ status: 'loading', error: undefined });
  else if (opts.manual) set({ refreshing: true });

  const r = await rpc<ListData>('files:list', {});
  if (seq !== listSeq) return;
  if (!r.ok || !r.data) {
    if (get().status !== 'ready') set({ status: 'error', error: r.error ?? t('ui.common.error'), refreshing: false });
    else {
      set({ refreshing: false });
      if (!opts.silent) fail(t('ui.files.refresh_failed'), r.error, refresh);
    }
    return;
  }
  const files = asArray<unknown>(r.data.files)
    .map(normFile)
    .filter((x): x is FileRow => x !== null);
  set({ status: 'ready', error: undefined, files, limits: normLimits(r.data.limits) });
  // The refresh that failed has now worked: its bar has nothing left to say.
  if (get().notice?.retry) showNotice(null);

  if (r.data.phone === true) {
    set({ phone: true });
    await loadPhone(opts.silent);
  } else if (get().phone || get().phoneStatus !== 'idle') dropPhone();

  if (seq === listSeq) set({ refreshing: false });
  syncOpen();
}

// ── Opening ────────────────────────────────────────────────────────────────────────────────

async function fetchFile(seq: number, id: number): Promise<void> {
  const r = await rpc<FileFull>('files:read', { id });
  const o = openFile(seq);
  if (!o) return;
  if (!r.ok || !r.data) {
    set({ open: { ...o, status: 'error', error: r.error ?? t('ui.common.error') } });
    return;
  }
  const body = typeof r.data.body === 'string' ? r.data.body : '';
  const name = typeof r.data.name === 'string' && r.data.name ? r.data.name : o.name;
  set({ open: { ...o, status: 'ready', error: undefined, name, body, savedName: name, savedBody: body, updatedAt: Number(r.data.updatedAt) || o.updatedAt } });
}

async function fetchPhone(seq: number, id: string): Promise<void> {
  const r = await rpc<PhoneFull>('files:phoneRead', { id });
  const o = get().open;
  if (!o || o.kind !== 'phone' || o.seq !== seq) return;
  const doc = r.ok ? normPhoneFull(r.data) : null;
  if (!doc) {
    set({ open: { ...o, status: 'error', error: r.error ?? t('ui.common.error') } });
    return;
  }
  set({ open: { ...o, status: 'ready', error: undefined, name: doc.name, doc } });
}

function openRow(row: Row): void {
  const seq = ++openSeq;
  if (row.place === 'phone' && typeof row.id === 'string') {
    set({ open: { kind: 'phone', seq, id: row.id, status: 'loading', name: row.name, doc: null }, view: 'doc' });
    void fetchPhone(seq, row.id);
  } else if (typeof row.id === 'number') {
    set({ open: { kind: 'file', seq, id: row.id, status: 'loading', name: row.name, body: '', savedName: row.name, savedBody: '', updatedAt: row.updatedAt }, view: 'doc' });
    void fetchFile(seq, row.id);
  }
}

/** Run `then` now - or, with unsaved changes in the editor, once the user has said what to do with them. */
export function guardLeave(then: () => void): void {
  if (get().busy) return;
  if (!isDirty(get().open)) {
    then();
    return;
  }
  set({ dialog: { kind: 'unsaved', then } });
}

/** A click on a line of the list: open it (the one already open just comes back into view). */
export function selectRow(row: Row): void {
  if (openKey(get().open) === row.key) {
    set({ view: 'doc' });
    return;
  }
  guardLeave(() => openRow(row));
}

/** Retry a document that failed to open. */
export function retryOpen(): void {
  const o = get().open;
  if (!o || o.status !== 'error') return;
  set({ open: { ...o, status: 'loading', error: undefined } });
  if (o.kind === 'phone') void fetchPhone(o.seq, o.id);
  else if (o.id !== null) void fetchFile(o.seq, o.id);
}

/**
 * Single-pane Back. The document stays open behind the list with whatever was typed, so nothing
 * needs asking - except a new document nobody typed into, which isn't worth keeping around.
 */
export function backToList(): void {
  const o = get().open;
  if (isDraft(o) && !isDirty(o)) {
    openSeq++;
    set({ open: null, view: 'list' });
    return;
  }
  set({ view: 'list' });
}

/** Up/Down through the list. */
export function stepSelection(dir: 1 | -1): void {
  const s = get();
  const rows = visibleRows(s);
  if (rows.length === 0) return;
  const key = openKey(s.open);
  const i = rows.findIndex(r => r.key === key);
  const next = i < 0 ? (dir === 1 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, i + dir));
  if (rows[next].key !== key) selectRow(rows[next]);
}

/** A click on a place. The one already showing brings its list back (single-pane). */
export function setPlace(place: Place): void {
  const s = get();
  if (s.place === place) {
    backToList();
    return;
  }
  if (place === 'phone' && !s.phone) return;
  guardLeave(() => {
    openSeq++;
    set({ place, open: null, view: 'list', search: '' });
    if (place === 'phone' && get().phoneStatus === 'error') void loadPhone();
  });
}

export const setSearch = (search: string): void => set({ search });

/** A click on a column heading: sort by it, or turn the order round when it already is. */
export function setSort(by: SortBy): void {
  const cur = get().sort;
  // Names start A-Z; dates and sizes start with the newest and the largest.
  set({ sort: cur.by === by ? { by, dir: cur.dir === 1 ? -1 : 1 } : { by, dir: by === 'name' ? 1 : -1 } });
}

// ── Editing ────────────────────────────────────────────────────────────────────────────────

/** A new document in the editor, its name ready to be typed over. It reaches the server on Save. */
export function newDocument(): void {
  const s = get();
  if (s.status !== 'ready' || s.busy) return;
  const cur = openFile();
  if (cur && cur.id === null && !isDirty(cur)) {
    set({ view: 'doc', focus: 'name' });
    return;
  }
  if (s.files.length >= s.limits.maxFiles) {
    showNotice({ severity: 'warning', text: t('ui.files.full', s.limits.maxFiles) });
    return;
  }
  guardLeave(() => {
    const name = uniqueName(t('ui.files.new_name'), get().files.map(f => f.name));
    set({
      place: 'documents',
      search: '',
      open: { kind: 'file', seq: ++openSeq, id: null, status: 'ready', name, body: '', savedName: name, savedBody: '', updatedAt: 0 },
      view: 'doc',
      focus: 'name',
    });
  });
}

export const setFocus = (focus: 'name' | 'body' | null): void => set({ focus });

export function editName(value: string): void {
  const o = openFile();
  if (!o || o.status !== 'ready') return;
  const name = clip(value.replace(/[\r\n\t]+/g, ' '), get().limits.maxName);
  if (name !== o.name) set({ open: { ...o, name, saveError: undefined } });
}

export function editBody(value: string): void {
  const o = openFile();
  if (!o || o.status !== 'ready') return;
  // Never past the limit - but a document that already is (the limit was lowered since it was
  // written) isn't cut short by the first keystroke.
  const body = clip(value, Math.max(get().limits.maxBody, o.body.length));
  if (body !== o.body) set({ open: { ...o, body } });
}

export function dismissSaveError(): void {
  const o = openFile();
  if (o && o.saveError) set({ open: { ...o, saveError: undefined } });
}

/** files:save for the open document (Save, Ctrl+S, the unsaved-changes prompt). True once it is stored. */
export async function save(): Promise<boolean> {
  const o = openFile();
  if (!o || o.status !== 'ready' || get().busy) return false;
  const name = o.name.trim();
  if (!name) {
    set({ open: { ...o, saveError: t('ui.files.name_required') }, view: 'doc', focus: 'name' });
    return false;
  }
  const body = o.body;
  set({ busy: 'save', open: { ...o, saveError: undefined } });
  const r = await rpc<FileRow>('files:save', o.id !== null ? { id: o.id, name, body } : { name, body });
  const row = r.ok ? normFile(r.data) : null;
  const cur = openFile(o.seq);
  if (!row) {
    set({ busy: null });
    if (cur) set({ open: { ...cur, saveError: r.error ?? t('ui.common.error') }, view: 'doc' });
    else fail(t('ui.files.save_failed'), r.error);
    return false;
  }
  settleList();
  set(s => ({ busy: null, files: upsert(s.files, row) }));
  if (cur) {
    // Whatever was typed while the save was away stays, and stays unsaved.
    set({ open: { ...cur, id: row.id, name: cur.name.trim() === name ? row.name : cur.name, savedName: row.name, savedBody: body, updatedAt: row.updatedAt, saveError: undefined } });
  }
  return true;
}

/** Throw away what was typed since the last save (a new document goes altogether). */
function discard(): void {
  const o = openFile();
  if (!o) return;
  if (o.id === null) {
    openSeq++;
    set({ open: null, view: 'list' });
  } else set({ open: { ...o, name: o.savedName, body: o.savedBody, saveError: undefined } });
}

/** The unsaved-changes prompt's three buttons. */
export async function resolveUnsaved(choice: 'save' | 'discard' | 'cancel'): Promise<void> {
  const d = get().dialog;
  if (!d || d.kind !== 'unsaved' || get().busy) return;
  if (choice === 'cancel') {
    set({ dialog: null });
    return;
  }
  if (choice === 'save') {
    const stored = await save();
    set({ dialog: null });
    // A refused save stays in the editor with its reason; what the user was doing is called off.
    if (stored) d.then();
    return;
  }
  discard();
  set({ dialog: null });
  d.then();
}

export function closeDialog(): void {
  if (!get().busy) set({ dialog: null });
}

// ── Rename and delete ──────────────────────────────────────────────────────────────────────

/** Rename: a prompt for a stored document; a new one is simply renamed in its name field. */
export function askRename(): void {
  const o = openFile();
  if (!o || o.status !== 'ready' || get().busy) return;
  if (o.id === null) set({ view: 'doc', focus: 'name' });
  else set({ dialog: { kind: 'rename', id: o.id, name: o.savedName } });
}

/** files:rename. Resolves to the reason it was refused (the prompt shows it), or null once done. */
export async function rename(id: number, value: string): Promise<string | null> {
  const name = value.trim();
  if (!name) return t('ui.files.name_required');
  if (get().busy) return t('ui.common.error');
  set({ busy: 'rename' });
  const r = await rpc<FileRow>('files:rename', { id, name });
  const row = r.ok ? normFile(r.data) : null;
  if (!row) {
    set({ busy: null });
    return r.error ?? t('ui.common.error');
  }
  settleList();
  set(s => ({ busy: null, dialog: null, files: upsert(s.files, row) }));
  const o = openFile();
  if (o && o.id === id) set({ open: { ...o, name: row.name, savedName: row.name, saveError: undefined } });
  return null;
}

/** Delete asks first - except for a new document nobody typed into, which just goes. */
export function askDelete(): void {
  const o = openFile();
  if (!o || get().busy) return;
  if (o.id === null && !isDirty(o)) {
    openSeq++;
    set({ open: null, view: 'list' });
    return;
  }
  set({ dialog: { kind: 'delete' } });
}

export async function confirmDelete(): Promise<void> {
  const o = openFile();
  if (!o || get().busy) return;
  const id = o.id;
  if (id !== null) {
    set({ busy: 'delete' });
    const r = await rpc('files:delete', { id });
    if (!r.ok) {
      set({ busy: null, dialog: null });
      fail(t('ui.files.delete_failed'), r.error);
      return;
    }
    settleList();
  }
  const still = openFile(o.seq);
  if (still) openSeq++;
  set(s => ({ busy: null, dialog: null, files: id === null ? s.files : s.files.filter(f => f.id !== id), open: still ? null : s.open, view: still ? 'list' : s.view }));
}

// ── Copies to and from the phone ───────────────────────────────────────────────────────────

/** files:toPhone - the stored document becomes a new document on the phone. */
export async function copyToPhone(): Promise<void> {
  const s = get();
  const o = openFile();
  if (!o || o.id === null || o.status !== 'ready' || isDirty(o) || s.busy || !s.phone) return;
  set({ busy: 'copy' });
  const r = await rpc<{ id: string }>('files:toPhone', { id: o.id });
  set({ busy: null });
  if (!r.ok) {
    fail(t('ui.files.copy_failed'), r.error);
    return;
  }
  showNotice({ severity: 'success', text: t('ui.files.copied_to_phone', o.savedName) });
  void loadPhone(true);
}

/** files:fromPhone - the phone document's text becomes a new document in Documents. */
export async function copyFromPhone(): Promise<void> {
  const o = get().open;
  if (!o || o.kind !== 'phone' || o.status !== 'ready' || get().busy) return;
  set({ busy: 'copy' });
  const r = await rpc<FileRow>('files:fromPhone', { id: o.id });
  const row = r.ok ? normFile(r.data) : null;
  if (!row) {
    set({ busy: null });
    fail(t('ui.files.copy_failed'), r.error);
    return;
  }
  settleList();
  set(s => ({ busy: null, files: upsert(s.files, row) }));
  showNotice({ severity: 'success', text: t('ui.files.copied_to_documents', row.name) });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────────────────

/** Window opened: fresh state, load the list. */
export function initFiles(): void {
  listSeq++;
  phoneSeq++;
  openSeq++;
  window.clearTimeout(noticeTimer);
  set(initial(), true);
  void load();
}

/** Window closed: replies still on their way are for nobody. */
export function teardownFiles(): void {
  listSeq++;
  phoneSeq++;
  openSeq++;
  window.clearTimeout(noticeTimer);
}
