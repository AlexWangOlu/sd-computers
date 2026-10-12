import { create } from 'zustand';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { useOS } from '@/store/os';
import type { Account, ComposeInit, ConfirmSpec, Counts, Folder, ListData, MailId, Message, Notice, ReceivedPush, SendData, StateData } from './types';
import { asArray, isOutgoing, normCounts, normMessage, quoteOriginal, sortMessages, uniq, withPrefix } from './util';

/**
 * Mail's state + every server action. Only one Mail window can exist (its window id is the app
 * id), so a module-level store is safe; the root resets it on mount. Each request type carries a
 * sequence number so a slow, stale reply never overwrites a newer one.
 */

interface MailState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  domain: string;
  accounts: Account[];
  canSignIn: boolean;
  canCreate: boolean;

  /** The signed-in address being viewed. */
  active: string | null;
  folder: Folder;
  search: string;
  messages: Message[];
  listStatus: 'idle' | 'loading' | 'ready' | 'error';
  listError?: string;

  selectedId: MailId | null;
  /** The message in the reading pane (body arrives with mail:read). */
  open: Message | null;
  openStatus: 'idle' | 'loading' | 'error';
  openError?: string;

  compose: ComposeInit | null;
  notice: Notice | null;
  confirm: ConfirmSpec | null;
  /** The in-window "Add account" sheet. */
  adding: boolean;
}

const fallbackDomain = (): string => useOS.getState().payload?.mail.domain ?? 'lsmail.com';

const initial = (): MailState => ({
  status: 'loading',
  error: undefined,
  domain: fallbackDomain(),
  accounts: [],
  canSignIn: true,
  canCreate: true,
  active: null,
  folder: 'inbox',
  search: '',
  messages: [],
  listStatus: 'idle',
  listError: undefined,
  selectedId: null,
  open: null,
  openStatus: 'idle',
  openError: undefined,
  compose: null,
  notice: null,
  confirm: null,
  adding: false,
});

export const useMail = create<MailState>(() => initial());

const set = useMail.setState;
const get = useMail.getState;

let stateSeq = 0;
let listSeq = 0;
let openSeq = 0;
let composeKey = 0;
let noticeTimer = 0;

/** Clears the list + reading pane (account/folder switch). */
const viewReset = (): Partial<MailState> => {
  listSeq++;
  openSeq++;
  return { messages: [], listStatus: 'idle', listError: undefined, selectedId: null, open: null, openStatus: 'idle', openError: undefined };
};

export function resetMail(): void {
  stateSeq++;
  listSeq++;
  openSeq++;
  window.clearTimeout(noticeTimer);
  set(initial(), true);
}

// ── Notices + confirmations ─────────────────────────────────────────────────────────────────

export function showNotice(n: Notice | null): void {
  window.clearTimeout(noticeTimer);
  set({ notice: n });
  if (n && (n.severity === 'success' || n.severity === 'info')) noticeTimer = window.setTimeout(() => set({ notice: null }), 6000);
}

export const askConfirm = (c: ConfirmSpec): void => set({ confirm: c });
export const closeConfirm = (): void => set({ confirm: null });
export const setAdding = (adding: boolean): void => set({ adding });

// ── Loading ─────────────────────────────────────────────────────────────────────────────────

/** mail:state. `prefer` switches to that address when it's signed in (after sign-in/up). */
export async function loadState(opts: { silent?: boolean; prefer?: string } = {}): Promise<boolean> {
  const seq = ++stateSeq;
  if (!opts.silent) set({ status: 'loading', error: undefined });
  const r = await rpc<StateData>('mail:state', {});
  if (seq !== stateSeq) return false;
  if (!r.ok || !r.data) {
    if (!opts.silent || get().status !== 'ready') set({ status: 'error', error: r.error ?? t('ui.common.error') });
    return false;
  }
  const d = r.data;
  const accounts: Account[] = asArray<Account>(d.accounts).map(a => ({
    email: String(a.email).toLowerCase(),
    name: String(a.name || a.email),
    counts: normCounts(a.counts),
  }));
  const s = get();
  const has = (e?: string | null): e is string => !!e && accounts.some(a => a.email === e);
  const active = has(opts.prefer) ? opts.prefer : has(s.active) ? s.active : accounts[0]?.email ?? null;
  const changed = active !== s.active;
  set({
    status: 'ready',
    error: undefined,
    domain: d.domain || s.domain,
    accounts,
    canSignIn: d.canSignIn !== false,
    canCreate: d.canCreate !== false,
    active,
    compose: s.compose && has(s.compose.from) ? s.compose : null,
    ...(changed ? { folder: 'inbox' as Folder, search: '', ...viewReset() } : {}),
  });
  if (changed && active) void loadList();
  return true;
}

/** mail:list for the active address/folder/search. `keep` leaves the rows up while it loads. */
export async function loadList(opts: { silent?: boolean; keep?: boolean } = {}): Promise<void> {
  const { active, folder, search } = get();
  if (!active) return;
  const seq = ++listSeq;
  if (!opts.silent) set(s => ({ listStatus: 'loading', listError: undefined, messages: opts.keep ? s.messages : [] }));
  const payload: Record<string, unknown> = { email: active, folder };
  if (search) payload.search = search;
  const r = await rpc<ListData>('mail:list', payload);
  if (seq !== listSeq) return;
  if (!r.ok || !r.data) {
    // A silent refresh that superseded a visible load must still end its spinner.
    if (!opts.silent || get().listStatus !== 'ready') set({ listStatus: 'error', listError: r.error ?? t('ui.common.error') });
    return;
  }
  const messages = sortMessages(asArray<Message>(r.data.messages).map(normMessage));
  const counts = normCounts(r.data.counts);
  set(s => ({
    messages,
    listStatus: 'ready',
    listError: undefined,
    accounts: s.accounts.map(a => (a.email === active ? { ...a, counts } : a)),
  }));
}

/** Re-read counts (mail:state) and the visible list after anything changed server-side. */
export function sync(): void {
  void loadState({ silent: true });
  void loadList({ silent: true });
}

// ── Navigation ──────────────────────────────────────────────────────────────────────────────

export function selectAccount(email: string): void {
  const s = get();
  if (s.active === email && s.folder === 'inbox' && !s.search) return;
  set({ active: email, folder: 'inbox', search: '', ...viewReset() });
  void loadList();
}

export function selectFolder(folder: Folder): void {
  const s = get();
  if (s.folder === folder && !s.search) {
    void loadList({ keep: true });
    return;
  }
  set({ folder, search: '', ...viewReset() });
  void loadList();
}

export function setSearch(q: string): void {
  if (get().search === q) return;
  set({ search: q });
  void loadList({ keep: true });
}

/** Back out of the reading pane (single-pane layout). */
export const clearSelection = (): void => {
  openSeq++;
  set({ selectedId: null, open: null, openStatus: 'idle', openError: undefined });
};

const patchMessage = (id: MailId, patch: Partial<Message>): void =>
  set(s => ({
    messages: s.messages.map(m => (m.id === id ? { ...m, ...patch } : m)),
    open: s.open && s.open.id === id ? { ...s.open, ...patch } : s.open,
  }));

const bumpCounts = (delta: Partial<Counts>): void => {
  const email = get().active;
  set(s => ({
    accounts: s.accounts.map(a => {
      if (a.email !== email) return a;
      const c = { ...a.counts };
      for (const k of Object.keys(delta) as (keyof Counts)[]) c[k] = Math.max(0, (c[k] ?? 0) + (delta[k] ?? 0));
      return { ...a, counts: c };
    }),
  }));
};

/** Open a message in the reading pane (mail:read marks it read). Drafts open in the composer. */
export async function openMessage(id: MailId): Promise<void> {
  const s = get();
  const email = s.active;
  if (!email) return;
  const row = s.messages.find(m => m.id === id);
  const seq = ++openSeq;
  set({ selectedId: id, open: row && row.folder !== 'drafts' ? row : null, openStatus: 'loading', openError: undefined, compose: null });
  const wasUnread = !!row && !row.read && row.folder !== 'drafts';
  if (row && wasUnread) {
    patchMessage(id, { read: true });
    if (row.folder === 'inbox') bumpCounts({ unread: -1 });
  }
  const r = await rpc<Message>('mail:read', { email, id });
  if (seq !== openSeq) return;
  if (!r.ok || !r.data) {
    set({ openStatus: 'error', openError: r.error ?? t('ui.common.error') });
    if (wasUnread) sync();
    return;
  }
  const msg = normMessage(r.data);
  if (msg.folder === 'drafts') {
    set({ open: null, openStatus: 'idle' });
    openCompose({ from: email, to: msg.to, subject: msg.subject, body: msg.body ?? '', draftId: msg.id, focus: msg.to.length ? 'body' : 'to' });
    return;
  }
  set({ open: msg, openStatus: 'idle' });
  if (!row) sync();
  else if (wasUnread) void loadState({ silent: true });
}

/** The message the toolbar / Delete key act on. */
export const currentMessage = (): Message | null => {
  const s = get();
  return s.open ?? s.messages.find(m => m.id === s.selectedId) ?? null;
};

/** Move the selection up/down the list (arrow keys). */
export function stepSelection(dir: 1 | -1): void {
  const s = get();
  if (s.messages.length === 0) return;
  const i = s.messages.findIndex(m => m.id === s.selectedId);
  const next = i < 0 ? (dir === 1 ? 0 : s.messages.length - 1) : Math.min(s.messages.length - 1, Math.max(0, i + dir));
  const m = s.messages[next];
  if (m && m.id !== s.selectedId) void openMessage(m.id);
}

// ── Message actions ─────────────────────────────────────────────────────────────────────────

async function act(endpoint: string, payload: Record<string, unknown>): Promise<boolean> {
  const r = await rpc(endpoint, payload);
  if (!r.ok) showNotice({ severity: 'error', text: r.error ?? t('ui.common.error') });
  sync();
  return r.ok;
}

export function toggleFlag(m: Message): void {
  const email = get().active;
  if (!email) return;
  const flagged = !m.flagged;
  patchMessage(m.id, { flagged });
  if (m.folder !== 'bin') bumpCounts({ flagged: flagged ? 1 : -1 });
  void act('mail:flag', { email, id: m.id, flagged });
}

export function setRead(m: Message, read: boolean): void {
  const email = get().active;
  if (!email || m.read === read) return;
  patchMessage(m.id, { read });
  if (m.folder === 'inbox') bumpCounts({ unread: read ? -1 : 1 });
  void act('mail:markRead', { email, id: m.id, read });
}

/** Drop a row from the list; if it was being read, open the next one (Outlook's default). */
function removeRow(id: MailId): void {
  const s = get();
  const i = s.messages.findIndex(m => m.id === id);
  const rest = s.messages.filter(m => m.id !== id);
  const wasOpen = s.selectedId === id || s.open?.id === id;
  set({ messages: rest });
  if (!wasOpen) return;
  const next = i < 0 ? undefined : rest[Math.min(i, rest.length - 1)];
  if (next && next.folder !== 'drafts') void openMessage(next.id);
  else clearSelection();
}

export function binMessage(m: Message): void {
  const email = get().active;
  if (!email) return;
  removeRow(m.id);
  void act('mail:bin', { email, id: m.id, bin: true });
}

export function restoreMessage(m: Message): void {
  const email = get().active;
  if (!email) return;
  removeRow(m.id);
  void act('mail:bin', { email, id: m.id, bin: false });
}

export function deleteForever(m: Message): void {
  const email = get().active;
  if (!email) return;
  askConfirm({
    title: t('ui.mail.confirm_delete_title'),
    body: t('ui.mail.confirm_delete_body'),
    confirm: t('ui.mail.delete_forever'),
    danger: true,
    run: () => {
      removeRow(m.id);
      void act('mail:delete', { email, id: m.id });
    },
  });
}

/** Delete key / toolbar: to the bin, or for good when it's already there. */
export const deleteMessage = (m: Message): void => (m.folder === 'bin' ? deleteForever(m) : binMessage(m));

export function emptyBin(): void {
  const email = get().active;
  if (!email) return;
  askConfirm({
    title: t('ui.mail.confirm_empty_title'),
    body: t('ui.mail.confirm_empty_body'),
    confirm: t('ui.mail.empty_bin_action'),
    danger: true,
    run: () => {
      if (get().folder === 'bin') {
        set({ messages: [] });
        clearSelection();
      }
      void act('mail:emptyBin', { email });
    },
  });
}

// ── Composing ───────────────────────────────────────────────────────────────────────────────

function openCompose(c: Omit<ComposeInit, 'key'>): void {
  set({ compose: { ...c, key: ++composeKey } });
}

/** New mail, or Reply / Reply all / Forward prefilled from `src`. */
export function startCompose(mode: 'new' | 'reply' | 'replyAll' | 'forward', src?: Message | null): void {
  const from = get().active;
  if (!from) return;
  const p = useOS.getState().payload;
  const clock24 = !!p?.desktop.clock24;
  const maxRecipients = p?.mail.maxRecipients ?? 20;
  const maxBody = p?.mail.maxBody ?? 10000;
  if (mode === 'new' || !src) {
    openCompose({ from, to: [], subject: '', body: '', focus: 'to' });
    return;
  }
  const me = from.toLowerCase();
  // Replying to something you sent (Sent folder) goes back to its recipients.
  const own = src.from.email.toLowerCase() === me || isOutgoing(src);
  let to: string[] = [];
  if (mode === 'reply') to = own ? src.to : [src.from.email];
  if (mode === 'replyAll') {
    to = uniq([...(own ? [] : [src.from.email]), ...src.to]).filter(a => a.toLowerCase() !== me);
    if (to.length === 0) to = own ? src.to : [src.from.email];
  }
  openCompose({
    from,
    to: to.slice(0, maxRecipients),
    subject: withPrefix(mode === 'forward' ? 'fw' : 're', src.subject),
    body: quoteOriginal(src, clock24).slice(0, maxBody),
    focus: mode === 'forward' ? 'to' : 'body',
  });
}

export const closeCompose = (): void => set({ compose: null });

/** After mail:send: close the composer, toast or warn about undeliverable addresses, refresh. */
export function afterSend(res: SendData): void {
  set({ compose: null });
  const delivered = asArray<string>(res.delivered);
  const failed = asArray<string>(res.failed);
  if (failed.length > 0) {
    showNotice({ severity: 'warning', title: t('ui.mail.sent_partial_title'), text: t('ui.mail.sent_failed', failed.join(', ')) });
  } else {
    showNotice(null);
    useOS.getState().toast({ app: 'mail', title: t('ui.mail.toast_sent'), body: t('ui.mail.toast_sent_body', delivered.join(', ')) });
  }
  sync();
}

// ── Accounts ────────────────────────────────────────────────────────────────────────────────

/** Returns the server's error sentence, or null on success. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const r = await rpc<{ email: string }>('mail:signIn', { email, password });
  if (!r.ok || !r.data) return r.error ?? t('ui.common.error');
  await loadState({ silent: true, prefer: String(r.data.email).toLowerCase() });
  set({ adding: false });
  return null;
}

export async function signUp(username: string, password: string, name: string): Promise<string | null> {
  const r = await rpc<{ email: string }>('mail:signUp', { username, password, name });
  if (!r.ok || !r.data) return r.error ?? t('ui.common.error');
  await loadState({ silent: true, prefer: String(r.data.email).toLowerCase() });
  set({ adding: false });
  return null;
}

export function confirmSignOut(email: string): void {
  askConfirm({
    title: t('ui.mail.confirm_signout_title'),
    body: t('ui.mail.confirm_signout_body', email),
    confirm: t('ui.mail.sign_out'),
    run: async () => {
      // Close a composer writing from this address first, so its draft is saved while still signed in.
      if (get().compose?.from === email) set({ compose: null });
      const r = await rpc('mail:signOut', { email });
      if (!r.ok) showNotice({ severity: 'error', text: r.error ?? t('ui.common.error') });
      await loadState({ silent: true });
    },
  });
}

// ── Launch props + live pushes ──────────────────────────────────────────────────────────────

/** win.props from a new-mail toast: { mailbox, messageId } -> that account, Inbox, that message. */
export async function applyLaunch(props: Record<string, unknown> | undefined): Promise<void> {
  const mailbox = typeof props?.mailbox === 'string' ? props.mailbox.toLowerCase() : '';
  if (!mailbox) return;
  // Built-in Mail ids are numbers, the phone's are strings - take either as given.
  const raw = props?.messageId;
  const id: MailId | null = typeof raw === 'number' && raw > 0 ? raw : typeof raw === 'string' && raw !== '' ? raw : null;
  if (!get().accounts.some(a => a.email === mailbox)) await loadState({ silent: get().status === 'ready' });
  if (!get().accounts.some(a => a.email === mailbox)) return;
  const s = get();
  set({ adding: false });
  if (s.active !== mailbox || s.folder !== 'inbox' || s.search) {
    set({ active: mailbox, folder: 'inbox', search: '', ...viewReset() });
    void loadList();
  }
  if (id !== null) void openMessage(id);
}

export async function initMail(props: Record<string, unknown> | undefined): Promise<void> {
  resetMail();
  await loadState({ prefer: typeof props?.mailbox === 'string' ? props.mailbox.toLowerCase() : undefined });
  await applyLaunch(props);
}

/** A new message landed in one of our mailboxes. */
export function onReceived(d: ReceivedPush | undefined): void {
  const mailbox = typeof d?.mailbox === 'string' ? d.mailbox.toLowerCase() : '';
  const s = get();
  if (!mailbox || s.status !== 'ready' || !s.accounts.some(a => a.email === mailbox)) return;
  void loadState({ silent: true });
  if (s.active === mailbox && s.folder === 'inbox') void loadList({ silent: true });
}
