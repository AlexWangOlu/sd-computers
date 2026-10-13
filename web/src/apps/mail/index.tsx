import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { AppProps } from '../registry';
import { selectActiveId, useOS } from '@/store/os';
import { useBus } from '@/lib/bus';
import { t } from '@/i18n';
import { Button, Dialog, InfoBar, Spinner } from '@/ui/controls';
import { useExitFx } from '@/hooks/useExitFx';
import AuthCard from './Auth';
import Composer from './Composer';
import MessageList from './MessageList';
import ReadingPane from './ReadingPane';
import Sidebar from './Sidebar';
import {
  applyLaunch,
  clearSelection,
  closeCompose,
  closeConfirm,
  currentMessage,
  deleteMessage,
  initMail,
  loadState,
  onReceived,
  setAdding,
  showNotice,
  startCompose,
  stepSelection,
  useMail,
} from './store';
import type { ReceivedPush } from './types';
import { cx } from './util';
import { PrintSlot } from '@/os/print/PrintDialog';

// Mail - a three-pane mail client for the server's shared @domain addresses.
// index.tsx owns the window-level concerns (layout breakpoints, launch props, live pushes,
// shortcuts, dialogs); the panes live next to it and all state + server calls are in store.ts.

interface Layout {
  /** Folder pane collapsed to icons. */
  rail: boolean;
  /** Too narrow for list + reading side by side: show one at a time. */
  single: boolean;
  listW: number;
  /** Width of the reading pane / composer (toolbar label breakpoints). */
  rightW: number;
}

const RAIL_W = 52;
const PANE_W = 240;

function layoutFor(w: number): Layout {
  const rail = w < 900;
  const leftW = rail ? RAIL_W : PANE_W;
  const single = w < 640;
  const listW = w >= 1200 ? 360 : w >= 900 ? 320 : 280;
  const rightW = single ? w - leftW : w - leftW - listW;
  // Quantised so a window resize only re-renders at breakpoints, not on every pixel.
  return { rail, single, listW, rightW: Math.max(0, Math.floor(rightW / 20) * 20) };
}

function useLayout(): [RefObject<HTMLDivElement | null>, Layout] {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>(() => layoutFor(1060));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number) =>
      setLayout(prev => {
        const next = layoutFor(w);
        return prev.rail === next.rail && prev.single === next.single && prev.listW === next.listW && prev.rightW === next.rightW ? prev : next;
      });
    apply(el.clientWidth);
    const ro = new ResizeObserver(entries => apply(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, layout];
}

export default function Mail({ win }: AppProps) {
  const status = useMail(s => s.status);
  const error = useMail(s => s.error);
  const hasAccounts = useMail(s => s.accounts.length > 0);
  const adding = useMail(s => s.adding);
  const confirm = useMail(s => s.confirm);
  const compose = useMail(s => s.compose);
  const hasSelection = useMail(s => s.selectedId != null || s.open != null || s.openStatus !== 'idle');
  const notice = useMail(s => s.notice);
  const isActive = useOS(s => selectActiveId(s) === win.id);
  const [rootRef, layout] = useLayout();

  // Boot: state, then whatever the window was opened for (a new-mail toast's mailbox + message).
  useEffect(() => {
    void initMail(win.props);
  }, []);

  // A toast clicked while Mail is already open hands the window new props.
  const firstProps = useRef(true);
  useEffect(() => {
    if (firstProps.current) {
      firstProps.current = false;
      return;
    }
    void applyLaunch(win.props);
  }, [win.props]);

  useBus<ReceivedPush>('mail:received', d => onReceived(d));

  // Shortcuts while this is the focused window: Ctrl+N new mail, Delete, Up/Down through the list.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useMail.getState();
      if (s.confirm || s.adding || s.accounts.length === 0) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        startCompose('new');
        return;
      }
      if (typing || ctrl || e.altKey || s.compose) return;
      if (e.key === 'Delete') {
        const m = currentMessage();
        if (m) {
          e.preventDefault();
          deleteMessage(m);
        }
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (!el || el === document.body || !!el.closest('[data-mail-list]'))) {
        // Only while the list (or nothing) has focus, so arrows still scroll the reading pane.
        e.preventDefault();
        stepSelection(e.key === 'ArrowDown' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

  const noticeBar = notice ? (
    <InfoBar severity={notice.severity} title={notice.title} onClose={() => showNotice(null)}>
      {notice.text}
    </InfoBar>
  ) : null;

  const showRight = !layout.single || !!compose || hasSelection;
  const showList = !layout.single || !showRight;
  const back = layout.single ? () => (compose ? closeCompose() : clearSelection()) : undefined;

  let content;
  if (status === 'ready' && hasAccounts) {
    content = (
      <>
        <Sidebar rail={layout.rail} />
        {showList && (
          <div className={cx('min-w-0 flex flex-col bg-win', layout.single && 'flex-1')} style={layout.single ? undefined : { width: layout.listW, flexShrink: 0 }}>
            <MessageList notice={layout.single ? noticeBar : undefined} />
          </div>
        )}
        {showRight && (
          <section className="flex-1 min-w-0 flex flex-col bg-layer rounded-tl-win border-t border-l border-stroke overflow-hidden">
            {noticeBar && <div className="px-3 pt-3 shrink-0">{noticeBar}</div>}
            <div className="flex-1 min-h-0">
              {compose ? <Composer key={compose.key} init={compose} width={layout.rightW} onBack={back} /> : <ReadingPane width={layout.rightW} onBack={back} />}
            </div>
          </section>
        )}
      </>
    );
  } else if (status === 'ready') {
    content = (
      <div className="flex-1 min-w-0 overflow-y-auto os-scroll">
        <div className="min-h-full flex items-center justify-center p-6">
          <AuthCard />
        </div>
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-[min(420px,100%)] flex flex-col gap-3">
          <InfoBar severity="error" title={t('ui.mail.load_failed')}>
            {error}
          </InfoBar>
          <div>
            <Button onClick={() => void loadState()}>{t('ui.common.retry')}</Button>
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
      {adding && hasAccounts && <AddAccountSheet />}
      {confirm && <ConfirmDialog />}
      <PrintSlot app="mail" />
    </div>
  );
}

/** "Add account": the same sign-in / create card, over the mail window. */
function AddAccountSheet() {
  const exitRef = useExitFx('fade-out');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // (used here: the OS must not take it for standing up)
      setAdding(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div
      ref={exitRef}
      className="absolute inset-0 z-30 bg-black/40 overflow-y-auto os-scroll fade-in"
      onMouseDown={e => {
        if (e.target === e.currentTarget) setAdding(false);
      }}
    >
      <div className="min-h-full flex items-center justify-center p-6" onMouseDown={e => e.target === e.currentTarget && setAdding(false)}>
        <AuthCard onCancel={() => setAdding(false)} />
      </div>
    </div>
  );
}

function ConfirmDialog() {
  const c = useMail(s => s.confirm);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // (used here: the OS must not take it for standing up)
      closeConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!c) return null;
  return (
    <Dialog
      title={c.title}
      onClose={closeConfirm}
      actions={
        <>
          <Button
            variant={c.danger ? 'danger' : 'accent'}
            autoFocus
            className="min-w-[120px]"
            onClick={() => {
              closeConfirm();
              void c.run();
            }}
          >
            {c.confirm}
          </Button>
          <Button className="min-w-[120px]" onClick={closeConfirm}>
            {t('ui.common.cancel')}
          </Button>
        </>
      }
    >
      {c.body}
    </Dialog>
  );
}
