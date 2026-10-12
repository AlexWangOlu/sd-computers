import { create } from 'zustand';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { useOS } from '@/store/os';
import type { Contact, ConversationRow, IncomingPush, ListData, SeenPush, TextMessage, Thread } from './types';
import {
  asArray,
  digitsOf,
  fmtPhone,
  isGroupId,
  isSome,
  MAX_TEXT,
  normContact,
  normContacts,
  normMessage,
  normRow,
  normThread,
  sameId,
  sortOldestFirst,
  sortRows,
} from './util';

/**
 * Messages' state + every server call. Only one Messages window can exist (its window id is the
 * app id), so a module-level store is safe; the root resets it on mount. List and thread loads
 * carry sequence numbers so a slow, stale reply never overwrites a newer one, and `generation`
 * drops anything still in flight from a previous window.
 */

/** A bubble in the open thread: a server message, or one of ours the server hasn't confirmed. */
export interface Bubble extends TextMessage {
  /** Client-only: an optimistic text, still sending or failed. */
  local?: { state: 'sending' | 'failed'; error?: string };
}

export interface OpenThread {
  id: string;
  title: string;
  participants: Contact[];
  group: boolean;
  muted: boolean;
  /** A number with no thread on the phone yet: the first send (to these digits) creates it. */
  draft: boolean;
  messages: Bubble[];
}

export interface ConfirmSpec {
  title: string;
  body: string;
  confirm: string;
  danger?: boolean;
  run: () => void | Promise<void>;
}

export interface Notice {
  severity: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

interface MessagesState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  conversations: ConversationRow[];
  contacts: Contact[];
  myNumber: string;
  myName: string;
  /** A manual refresh is running (header spinner). */
  refreshing: boolean;
  /** A background refresh failed: what's on screen may be stale. */
  listError: string | null;
  search: string;
  /** The "New message" pane is showing instead of a thread. */
  composingNew: boolean;
  thread: OpenThread | null;
  threadStatus: 'idle' | 'loading' | 'ready' | 'error';
  threadError?: string;
  /** Thread ids with a send in flight (their composer is locked meanwhile). */
  sending: string[];
  notice: Notice | null;
  confirm: ConfirmSpec | null;
}

const initial = (): MessagesState => ({
  status: 'loading',
  error: undefined,
  conversations: [],
  contacts: [],
  myNumber: '',
  myName: '',
  refreshing: false,
  listError: null,
  search: '',
  composingNew: false,
  thread: null,
  threadStatus: 'idle',
  threadError: undefined,
  sending: [],
  notice: null,
  confirm: null,
});

export const useMessages = create<MessagesState>(() => initial());

const set = useMessages.setState;
const get = useMessages.getState;

let winId = 'messages';
let generation = 0;
let listSeq = 0;
let threadSeq = 0;
let localSeq = 0;
let noticeTimer = 0;
/** A conversation the window was opened for, opened once the list is in. */
let launchAfterLoad: string | null = null;

/** Our unconfirmed bubbles per thread, so they survive switching threads and reloads. */
const outbox = new Map<string, Bubble[]>();
/** Pushed messages for a thread that was still loading: merged into that load. */
const early = new Map<string, TextMessage[]>();
/** Thread id -> newest message ts we marked read. A list built before the mark landed still counts those. */
const readUpTo = new Map<string, number>();
/** Unsent composer text per thread. */
const typed = new Map<string, string>();

export function resetMessages(): void {
  generation++;
  listSeq++;
  threadSeq++;
  outbox.clear();
  early.clear();
  readUpTo.clear();
  typed.clear();
  launchAfterLoad = null;
  window.clearTimeout(noticeTimer);
  set(initial(), true);
}

// ── Small helpers ───────────────────────────────────────────────────────────────────────────

/** The window is on screen (not minimized / closing): only then does an open thread count as read. */
function windowShown(): boolean {
  const w = useOS.getState().windows.find(x => x.id === winId);
  return !!w && !w.min && !w.exit;
}

const newestTs = (list: Bubble[]): number => {
  let n = 0;
  for (const m of list) if (!m.local && m.ts > n) n = m.ts;
  return n;
};

const withReadMarks = (rows: ConversationRow[]): ConversationRow[] =>
  rows.map(r => {
    const upTo = readUpTo.get(r.id);
    return upTo !== undefined && r.unread > 0 && (r.last?.ts ?? 0) <= upTo ? { ...r, unread: 0 } : r;
  });

/** Server history + pushes that raced the load + our unconfirmed bubbles (always last). */
function merge(server: TextMessage[], pushed: TextMessage[] | undefined, mine: Bubble[] | undefined): Bubble[] {
  let out: Bubble[] = server;
  if (pushed && pushed.length) {
    out = [...server];
    for (const m of pushed) if (!out.some(x => sameId(x.id, m.id))) out.push(m);
    out = sortOldestFirst(out);
  }
  return mine && mine.length ? [...out, ...mine] : out;
}

const patchThread = (id: string, fn: (th: OpenThread) => OpenThread): void =>
  set(st => (st.thread && st.thread.id === id ? { thread: fn(st.thread) } : {}));

export const getTyped = (id: string): string => typed.get(id) ?? '';
export const setTyped = (id: string, text: string): void => {
  if (text) typed.set(id, text);
  else typed.delete(id);
};

// ── Notices + confirmations ─────────────────────────────────────────────────────────────────

export function showNotice(n: Notice | null): void {
  window.clearTimeout(noticeTimer);
  set({ notice: n });
  if (n && (n.severity === 'success' || n.severity === 'info')) noticeTimer = window.setTimeout(() => set({ notice: null }), 6000);
}

export const closeConfirm = (): void => set({ confirm: null });

export const setSearch = (search: string): void => set({ search });

// ── Loading ─────────────────────────────────────────────────────────────────────────────────

/**
 * messages:list. 'initial' shows the full-window spinner, 'manual' the header spinner, 'silent'
 * nothing. Once the list is up, a failed refresh keeps it and flags it as possibly stale.
 */
export async function loadList(mode: 'initial' | 'manual' | 'silent' = 'silent'): Promise<boolean> {
  const gen = generation;
  const seq = ++listSeq;
  if (mode === 'initial') set({ status: 'loading', error: undefined });
  if (mode === 'manual') set({ refreshing: true });
  const r = await rpc<ListData>('messages:list', {});
  if (gen !== generation || seq !== listSeq) return false;
  if (!r.ok || !r.data) {
    const error = r.error ?? t('ui.common.error');
    if (get().status !== 'ready') set({ status: 'error', error, refreshing: false });
    else set({ listError: error, refreshing: false });
    return false;
  }
  const d = r.data;
  set({
    status: 'ready',
    error: undefined,
    conversations: withReadMarks(sortRows(asArray<unknown>(d.conversations).map(normRow).filter(isSome))),
    contacts: normContacts(d.contacts),
    myNumber: digitsOf(d.myNumber),
    myName: typeof d.myName === 'string' ? d.myName : '',
    refreshing: false,
    listError: null,
  });
  syncOpenThread();
  if (launchAfterLoad) {
    const id = launchAfterLoad;
    launchAfterLoad = null;
    set({ search: '' });
    void openThread(id);
  }
  return true;
}

/** After a list load: keep the open thread's header current, and catch what no push told us about. */
function syncOpenThread(): void {
  const s = get();
  const th = s.thread;
  if (!th) return;
  const row = s.conversations.find(c => c.id === th.id);
  if (!row) return;
  if (th.draft) {
    // The number has a thread now (texted from the phone meanwhile): load its history.
    patchThread(th.id, x => ({ ...x, draft: false, title: row.title, participants: row.participants.length ? row.participants : x.participants }));
    void openThread(th.id, { silent: true });
    return;
  }
  if (row.title !== th.title || row.muted !== th.muted || (row.participants.length > 0 && row.participants.length !== th.participants.length)) {
    patchThread(th.id, x => ({ ...x, title: row.title, muted: row.muted, participants: row.participants.length ? row.participants : x.participants }));
  }
  // Texts sent from the phone itself are not pushed: the list is how we learn about them.
  const last = row.last;
  if (s.threadStatus === 'ready' && last && last.ts > newestTs(th.messages) && !th.messages.some(m => sameId(m.id, last.id))) {
    void openThread(th.id, { silent: true });
  }
}

/**
 * messages:thread. Silent = a refresh of the thread already on screen (no spinner; a failure keeps
 * what's shown). Ends by marking it read when it has unread messages.
 */
export async function openThread(id: string, opts: { silent?: boolean } = {}): Promise<void> {
  const gen = generation;
  const s = get();
  const current = s.thread && s.thread.id === id ? s.thread : null;
  const silent = !!opts.silent && !!current && s.threadStatus === 'ready';
  const seq = ++threadSeq;
  if (!silent) {
    // The header comes from the list row while the history loads.
    const row = s.conversations.find(c => c.id === id);
    set({
      composingNew: false,
      thread: {
        id,
        title: row?.title ?? current?.title ?? (isGroupId(id) ? t('ui.messages.group') : fmtPhone(id)),
        participants: row?.participants ?? current?.participants ?? [],
        group: row?.group ?? isGroupId(id),
        muted: row?.muted ?? false,
        draft: false,
        messages: [],
      },
      threadStatus: 'loading',
      threadError: undefined,
    });
  }
  const r = await rpc<Thread>('messages:thread', { id });
  if (gen !== generation || seq !== threadSeq) return;
  if (!r.ok || !r.data) {
    if (!silent) set({ threadStatus: 'error', threadError: r.error ?? t('ui.common.error') });
    return;
  }
  const th = normThread(r.data, id);
  const row = get().conversations.find(c => c.id === id);
  const messages = merge(th.messages, early.get(id), outbox.get(id));
  early.delete(id);
  set({
    thread: {
      id,
      title: th.title || row?.title || fmtPhone(id),
      participants: th.participants.length ? th.participants : row?.participants ?? [],
      group: th.group,
      muted: th.muted || !!row?.muted,
      draft: false,
      messages,
    },
    threadStatus: 'ready',
    threadError: undefined,
  });
  void markOpenRead();
}

/**
 * messages:read for the open thread when it has anything unread and the window is on screen.
 * Zeroes the row's badge locally right away. Returns the request (null when nothing to do).
 */
export function markOpenRead(): Promise<unknown> | null {
  const s = get();
  const th = s.thread;
  if (!th || th.draft || s.threadStatus !== 'ready' || !windowShown()) return null;
  const row = s.conversations.find(c => c.id === th.id);
  const unreadIn = th.messages.some(m => !m.local && m.from !== 'me' && !m.read);
  if (!unreadIn && !(row && row.unread > 0)) return null;
  const id = th.id;
  readUpTo.set(id, Math.max(readUpTo.get(id) ?? 0, newestTs(th.messages), row?.last?.ts ?? 0));
  set(st => ({
    conversations: st.conversations.map(c => (c.id === id && c.unread > 0 ? { ...c, unread: 0 } : c)),
    thread: st.thread && st.thread.id === id ? { ...st.thread, messages: st.thread.messages.map(m => (m.from !== 'me' && !m.read ? { ...m, read: true } : m)) } : st.thread,
  }));
  return rpc('messages:read', { conversation: id }).then(r => {
    // Not marked after all: let the next list show the badge again.
    if (!r.ok) readUpTo.delete(id);
    return r;
  });
}

// ── Navigation ──────────────────────────────────────────────────────────────────────────────

/** A row was clicked: open it, or quietly refresh it when it's already the open one. */
export function selectThread(id: string): void {
  const s = get();
  if (!s.composingNew && s.thread && s.thread.id === id && !s.thread.draft && s.threadStatus === 'ready') {
    void openThread(id, { silent: true });
    return;
  }
  void openThread(id);
}

/** Back to the list (single-pane layout). */
export function closeThread(): void {
  threadSeq++;
  set({ thread: null, threadStatus: 'idle', threadError: undefined });
}

export function startNew(): void {
  threadSeq++;
  set({ composingNew: true, thread: null, threadStatus: 'idle', threadError: undefined });
}

export const cancelNew = (): void => set({ composingNew: false });

/**
 * "New message" picked a contact or a typed number: open the 1:1 thread with it when there is
 * one, otherwise an empty draft whose first send creates it. Returns an error sentence, or null.
 */
export function startConversation(number: string, contact?: Contact): string | null {
  const digits = digitsOf(contact?.phone ?? number);
  const s = get();
  if (!digits) return t('ui.messages.err_number');
  if (s.myNumber && digits === s.myNumber) return t('ui.messages.err_self');
  const existing = s.conversations.find(
    c => !c.group && (digitsOf(c.id) === digits || (c.participants.length === 1 && c.participants[0].phone === digits)),
  );
  if (existing) {
    void openThread(existing.id);
    return null;
  }
  threadSeq++;
  const who = contact ?? s.contacts.find(c => c.phone === digits);
  const person: Contact = who ?? { id: digits, name: fmtPhone(digits), phone: digits };
  set({
    composingNew: false,
    thread: { id: digits, title: person.name, participants: [person], group: false, muted: false, draft: true, messages: [...(outbox.get(digits) ?? [])] },
    threadStatus: 'ready',
    threadError: undefined,
  });
  return null;
}

// ── Sending ─────────────────────────────────────────────────────────────────────────────────

function patchLocal(threadId: string, localId: TextMessage['id'], local: Bubble['local']): void {
  const list = outbox.get(threadId);
  if (list) outbox.set(threadId, list.map(m => (sameId(m.id, localId) ? { ...m, local } : m)));
  patchThread(threadId, th => ({ ...th, messages: th.messages.map(m => (sameId(m.id, localId) ? { ...m, local } : m)) }));
}

function dropFromOutbox(threadId: string, localId: TextMessage['id']): void {
  const rest = (outbox.get(threadId) ?? []).filter(m => !sameId(m.id, localId));
  if (rest.length) outbox.set(threadId, rest);
  else outbox.delete(threadId);
}

const setSending = (threadId: string, on: boolean): void =>
  set(st => ({ sending: on ? (st.sending.includes(threadId) ? st.sending : [...st.sending, threadId]) : st.sending.filter(x => x !== threadId) }));

/** messages:send for one bubble; on success it becomes the server's message, else it's marked failed. */
async function deliver(threadId: string, b: Bubble): Promise<void> {
  const gen = generation;
  setSending(threadId, true);
  const r = await rpc<TextMessage>('messages:send', { conversation: threadId, body: b.body });
  if (gen !== generation) return;
  setSending(threadId, false);
  if (!r.ok) {
    patchLocal(threadId, b.id, { state: 'failed', error: r.error ?? t('ui.common.error') });
    return;
  }
  const msg = normMessage(r.data);
  dropFromOutbox(threadId, b.id);
  set(st => {
    const th = st.thread && st.thread.id === threadId ? st.thread : null;
    let thread = st.thread;
    if (th) {
      const known = !!msg && th.messages.some(m => sameId(m.id, msg.id));
      const messages = msg && !known ? th.messages.map(m => (sameId(m.id, b.id) ? msg : m)) : th.messages.filter(m => !sameId(m.id, b.id));
      thread = { ...th, draft: false, messages };
    }
    if (!msg) return { thread };
    // Bump (or, for a brand-new number, add) the row right away; the refresh below confirms it.
    const row = st.conversations.find(c => c.id === threadId);
    const base: ConversationRow = row ?? {
      id: threadId,
      title: th?.title ?? fmtPhone(threadId),
      participants: th?.participants ?? [],
      group: isGroupId(threadId),
      unread: 0,
      muted: false,
    };
    return { thread, conversations: [{ ...base, last: msg }, ...st.conversations.filter(c => c.id !== threadId)] };
  });
  // Sent, but the server echoed nothing back: show the real thread instead of guessing.
  if (!msg && get().thread?.id === threadId) void openThread(threadId, { silent: true });
  void loadList('silent');
}

/** Send a text to the open thread (optimistic bubble first). False when there's nothing to send. */
export function sendText(raw: string): boolean {
  const s = get();
  const th = s.thread;
  const body = raw.trim().slice(0, MAX_TEXT);
  if (!th || !body || s.threadStatus !== 'ready' || s.sending.includes(th.id)) return false;
  const b: Bubble = { id: `local-${++localSeq}`, from: 'me', body, kind: 'text', ts: Date.now(), read: true, local: { state: 'sending' } };
  outbox.set(th.id, [...(outbox.get(th.id) ?? []), b]);
  patchThread(th.id, x => ({ ...x, messages: [...x.messages, b] }));
  void deliver(th.id, b);
  return true;
}

export function retrySend(localId: TextMessage['id']): void {
  const s = get();
  const th = s.thread;
  if (!th || s.sending.includes(th.id)) return;
  const b = outbox.get(th.id)?.find(m => sameId(m.id, localId));
  if (!b || b.local?.state !== 'failed') return;
  patchLocal(th.id, localId, { state: 'sending' });
  void deliver(th.id, b);
}

export function discardFailed(localId: TextMessage['id']): void {
  const th = get().thread;
  if (!th) return;
  dropFromOutbox(th.id, localId);
  patchThread(th.id, x => ({ ...x, messages: x.messages.filter(m => !sameId(m.id, localId)) }));
}

// ── Deleting ────────────────────────────────────────────────────────────────────────────────

export function confirmDelete(): void {
  const th = get().thread;
  if (!th || th.draft) return;
  const group = th.group;
  set({
    confirm: {
      title: t(group ? 'ui.messages.leave_title' : 'ui.messages.delete_title'),
      body: t(group ? 'ui.messages.leave_body' : 'ui.messages.delete_body', th.title),
      confirm: t(group ? 'ui.messages.leave' : 'ui.common.delete'),
      danger: true,
      run: () => deleteConversation(th.id),
    },
  });
}

async function deleteConversation(id: string): Promise<void> {
  const gen = generation;
  if (get().thread?.id === id) threadSeq++;
  outbox.delete(id);
  early.delete(id);
  typed.delete(id);
  readUpTo.delete(id);
  set(st => ({
    conversations: st.conversations.filter(c => c.id !== id),
    ...(st.thread?.id === id ? { thread: null, threadStatus: 'idle' as const, threadError: undefined } : {}),
  }));
  const r = await rpc('messages:delete', { conversation: id });
  if (gen !== generation) return;
  if (!r.ok) showNotice({ severity: 'error', text: r.error ?? t('ui.common.error') });
  void loadList('silent');
}

// ── Refresh, launch props, live pushes ──────────────────────────────────────────────────────

/** Refresh button: the list, and the open thread. */
export function refreshAll(): void {
  void loadList(get().status === 'ready' ? 'manual' : 'initial');
  const s = get();
  if (s.thread && !s.thread.draft) void openThread(s.thread.id, { silent: s.threadStatus === 'ready' });
}

/** The window came back to the front: texts sent from the phone itself are never pushed. */
export function onActivated(): void {
  const s = get();
  if (s.status !== 'ready') return;
  void loadList('silent');
  if (s.thread && !s.thread.draft && s.threadStatus === 'ready') void openThread(s.thread.id, { silent: true });
}

const launchId = (props: Record<string, unknown> | undefined): string => {
  const c = props?.conversation;
  return typeof c === 'string' ? c : typeof c === 'number' ? String(c) : '';
};

/** win.props from a new-text toast: { conversation } -> open that thread. */
export function applyLaunch(props: Record<string, unknown> | undefined): void {
  const id = launchId(props);
  if (!id) return;
  if (get().status !== 'ready') {
    launchAfterLoad = id;
    return;
  }
  set({ search: '' });
  // Already the open thread: just refresh it in place.
  selectThread(id);
  // It may be a thread the list hasn't seen yet.
  void loadList('silent');
}

export async function initMessages(windowId: string, props: Record<string, unknown> | undefined): Promise<void> {
  resetMessages();
  winId = windowId;
  launchAfterLoad = launchId(props) || null;
  await loadList('initial');
}

/** sd-phone pushed a text (App.tsx already toasted it). */
export function onIncoming(c: IncomingPush | undefined): void {
  if (!c || (typeof c.id !== 'string' && typeof c.id !== 'number')) return;
  const id = String(c.id);
  // Still loading (or failed): that load, or the retry, brings it.
  if (get().status !== 'ready') return;
  const msg = normMessage(asArray<unknown>(c.messages)[0]);

  if (msg) {
    // Bump the row now; the refresh below brings the server's own counts.
    set(st => {
      const row = st.conversations.find(x => x.id === id);
      if (!row || (row.last && sameId(row.last.id, msg.id))) return {};
      return { conversations: [{ ...row, last: msg, unread: msg.from === 'me' ? row.unread : row.unread + 1 }, ...st.conversations.filter(x => x.id !== id)] };
    });
  }

  const s = get();
  const th = s.thread;
  if (msg && th && th.id === id) {
    if (s.threadStatus === 'loading') {
      early.set(id, [...(early.get(id) ?? []), msg]);
    } else if (s.threadStatus === 'ready' && !th.messages.some(m => sameId(m.id, msg.id))) {
      // Ours-in-flight always trail, so slot it in before them.
      const at = th.messages.findIndex(m => !!m.local);
      const messages = at < 0 ? [...th.messages, msg] : [...th.messages.slice(0, at), msg, ...th.messages.slice(at)];
      const pushed = asArray<unknown>(c.participants).map(normContact).filter(isSome);
      patchThread(id, x => ({ ...x, draft: false, participants: x.participants.length ? x.participants : pushed, messages }));
    }
    // A 1:1 answer usually means my last text was seen, but "seen" itself is never pushed to the
    // desk: re-read the thread to pick its seenAt up.
    const mine = lastConfirmedMine(get().thread?.messages ?? []);
    const wantSeen = !th.group && !!mine && !mine.seenAt;
    const after = () => {
      void loadList('silent');
      if (wantSeen) void openThread(id, { silent: true });
    };
    const marking = markOpenRead();
    // Refresh only once the read landed, or the list would bring the badge back.
    if (marking) void marking.then(after);
    else after();
    return;
  }
  void loadList('silent');
}

/** sd-phone: a 1:1 peer read my texts - stamp "Seen" on everything of mine up to then. */
export function onSeen(d: SeenPush | undefined): void {
  if (!d || (typeof d.conversation !== 'string' && typeof d.conversation !== 'number')) return;
  const id = String(d.conversation);
  const seenAt = Number(d.seenAt) || Date.now();
  const th = get().thread;
  if (!th || th.id !== id || th.group) return;
  patchThread(id, x => ({
    ...x,
    messages: x.messages.map(m => (m.from === 'me' && !m.local && !m.seenAt && m.ts <= seenAt ? { ...m, seenAt } : m)),
  }));
}

function lastConfirmedMine(list: Bubble[]): Bubble | undefined {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].from === 'me' && !list[i].local) return list[i];
  return undefined;
}
