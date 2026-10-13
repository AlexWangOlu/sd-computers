import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { BookUser } from 'lucide-react';
import type { AppProps } from '../registry';
import { selectActiveId, useOS } from '@/store/os';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { Button, Dialog, Empty, InfoBar, Spinner } from '@/ui/controls';
import AddDialog from './AddDialog';
import ContactCard from './ContactCard';
import ContactList from './ContactList';
import { cx, normContact, normList, sortContacts } from './model';
import type { Contact, ListData, RemoveData } from './types';

// Contacts - the character's PHONE address book over the optional sd-phone link (contacts:*).
// index.tsx owns the window: the state, the server calls, the layout, shortcuts and dialogs. The
// panes next to it only draw what they are given, and the data helpers are in model.ts.

/** The first load fills the window, a manual one spins the Refresh button, a silent one shows nothing. */
type LoadMode = 'initial' | 'manual' | 'silent';

/** Narrower than this, list and card take turns (with a Back button). */
const SINGLE_BELOW = 600;

function useSinglePane(): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [single, setSingle] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A minimized window measures 0: keep the last layout instead of flipping to single-pane.
    const apply = (w: number) => {
      if (w > 0) setSingle(w < SINGLE_BELOW);
    };
    apply(el.clientWidth);
    const ro = new ResizeObserver(entries => apply(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, single];
}

export default function Contacts({ win }: AppProps) {
  const isActive = useOS(s => selectActiveId(s) === win.id);
  // The Message button needs the Messages app on THIS computer (the phone switches are per app).
  const hasMessages = useOS(s => !!s.payload?.computer.apps.some(a => a.id === 'messages'));
  const [rootRef, single] = useSinglePane();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  /** id of the card open on the right. */
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** Why the last manual refresh failed (the list stays as it was). */
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  /** The card the delete prompt is asking about. */
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const seq = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async (mode: LoadMode) => {
    const mine = ++seq.current;
    if (mode === 'initial') setStatus('loading');
    if (mode === 'manual') {
      setRefreshing(true);
      setNotice(null);
    }
    const r = await rpc<ListData>('contacts:list');
    // Closed meanwhile, or a newer load is on its way: that one decides what is shown.
    if (!mounted.current || mine !== seq.current) return;
    setRefreshing(false);
    if (!r.ok) {
      const why = r.error || t('ui.common.error');
      if (mode === 'initial') {
        setError(why);
        setStatus('error');
      } else if (mode === 'manual') {
        setNotice(why);
      }
      return;
    }
    setContacts(normList(r.data?.contacts));
    setNotice(null);
    setStatus('ready');
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load('initial');
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // A contact saved on the phone itself isn't pushed: look again whenever the window comes back to the front.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current && status === 'ready') void load('silent');
    wasActive.current = isActive;
  }, [isActive, status, load]);

  const current = selected === null ? undefined : contacts.find(c => c.id === selected);

  // The open card was deleted on the phone: a refresh took it out from under the pane.
  useEffect(() => {
    if (selected !== null && !current) setSelected(null);
  }, [selected, current]);

  /** contacts:add. Resolves to the error sentence, or null once the card is in the list and open. */
  const add = useCallback(
    async (name: string, number: string): Promise<string | null> => {
      setAddBusy(true);
      const r = await rpc<Contact>('contacts:add', { name, number });
      if (!mounted.current) return null;
      setAddBusy(false);
      if (!r.ok) return r.error || t('ui.common.error');
      const c = normContact(r.data);
      if (c) {
        setContacts(list => sortContacts([...list.filter(x => x.id !== c.id), c]));
        setSelected(c.id);
        // A search still in the box could be hiding the row it just got.
        setSearch('');
      }
      setAdding(false);
      // The phone's copy is the truth (and supersedes a refresh that left before the add landed).
      void load('silent');
      return null;
    },
    [load],
  );

  /** contacts:remove for the card in the prompt. The phone removes every card saved under its number. */
  const remove = useCallback(async () => {
    const c = deleting;
    if (!c || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const r = await rpc<RemoveData>('contacts:remove', { number: c.number });
    if (!mounted.current) return;
    setDeleteBusy(false);
    if (!r.ok) {
      setDeleteError(r.error || t('ui.common.error'));
      return;
    }
    setContacts(list => list.filter(x => x.number !== c.number));
    setSelected(s => (s === c.id ? null : s));
    setDeleting(null);
    void load('silent');
  }, [deleting, deleteBusy, load]);

  const askDelete = useCallback((c: Contact) => {
    setDeleteError(null);
    setDeleting(c);
  }, []);

  const message = useCallback((c: Contact) => {
    // Messages opens (or comes to the front) on the 1:1 thread with this number.
    useOS.getState().openApp('messages', { conversation: c.number });
  }, []);

  // Shortcuts while this is the focused window: Ctrl+N adds a contact, Escape backs out of a prompt.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      if (adding || deleting) {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (adding && !addBusy) setAdding(false);
        if (deleting && !deleteBusy) setDeleting(null);
        return;
      }
      if (status !== 'ready') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, status, adding, addBusy, deleting, deleteBusy]);

  let content;
  if (status === 'ready') {
    const showCard = !single || current !== undefined;
    const showList = !single || current === undefined;
    const refreshNotice = notice ? (
      <div className="flex flex-col items-start gap-2">
        <div className="w-full">
          <InfoBar severity="warning" title={t('ui.contacts.refresh_failed')} onClose={() => setNotice(null)}>
            {notice}
          </InfoBar>
        </div>
        <Button compact onClick={() => void load('manual')} disabled={refreshing}>
          {t('ui.common.retry')}
        </Button>
      </div>
    ) : undefined;
    content = (
      <>
        {/* Hidden, not unmounted, while a card is open over it: Back returns to the same scroll position. */}
        <aside className={cx('min-w-0 flex-col bg-win', single ? 'flex-1' : 'w-[280px] shrink-0', showList ? 'flex' : 'hidden')}>
          <ContactList
            contacts={contacts}
            search={search}
            selected={selected}
            single={single}
            refreshing={refreshing}
            notice={refreshNotice}
            onSearch={setSearch}
            onSelect={setSelected}
            onRefresh={() => void load('manual')}
            onAdd={() => setAdding(true)}
          />
        </aside>
        {showCard && (
          <section className={cx('flex-1 min-w-0 flex flex-col bg-layer border-t border-stroke overflow-hidden', !single && 'rounded-tl-win border-l')}>
            {current ? (
              <ContactCard
                key={current.id}
                contact={current}
                onMessage={hasMessages ? () => message(current) : undefined}
                onDelete={() => askDelete(current)}
                onBack={single ? () => setSelected(null) : undefined}
              />
            ) : (
              <Empty icon={<BookUser size={48} strokeWidth={1} />} title={t('ui.contacts.select_title')}>
                {t('ui.contacts.select_hint')}
              </Empty>
            )}
          </section>
        )}
      </>
    );
  } else if (status === 'error') {
    content = (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-[min(420px,100%)] flex flex-col gap-3">
          <InfoBar severity="error" title={t('ui.contacts.load_failed')}>
            {error}
          </InfoBar>
          <div>
            <Button onClick={() => void load('initial')}>{t('ui.common.retry')}</Button>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-t2">
        <Spinner size={28} />
        <span className="text-caption">{t('ui.common.loading')}</span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative h-full w-full flex bg-win text-t1 overflow-hidden">
      {content}
      {adding && <AddDialog busy={addBusy} onSubmit={add} onClose={() => setAdding(false)} />}
      {deleting && (
        <Dialog
          title={t('ui.contacts.delete_title')}
          onClose={deleteBusy ? undefined : () => setDeleting(null)}
          actions={
            <>
              <Button variant="danger" autoFocus className="min-w-[120px]" onClick={() => void remove()} disabled={deleteBusy}>
                {deleteBusy ? t('ui.contacts.deleting') : t('ui.common.delete')}
              </Button>
              <Button className="min-w-[120px]" onClick={() => setDeleting(null)} disabled={deleteBusy}>
                {t('ui.common.cancel')}
              </Button>
            </>
          }
        >
          {t('ui.contacts.delete_body', deleting.name)}
          {deleteError && (
            <div role="alert" className="mt-3 text-caption text-critical">
              {deleteError}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
