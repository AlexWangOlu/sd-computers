import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { AppProps } from '@/apps/registry';
import { selectActiveId, useOS } from '@/store/os';
import { useBus } from '@/lib/bus';
import { t } from '@/i18n';
import { Button, Dialog, InfoBar, Spinner } from '@/ui/controls';
import ConversationList from './ConversationList';
import NewConversation from './NewConversation';
import ThreadView from './ThreadView';
import { applyLaunch, cancelNew, closeConfirm, closeThread, initMessages, loadList, onActivated, onIncoming, onSeen, showNotice, startNew, useMessages } from './store';
import type { IncomingPush, SeenPush } from './types';
import { cx } from './util';

// Messages - the character's PHONE texts, through the optional sd-phone link.
// index.tsx owns the window-level concerns (layout breakpoint, launch props, live pushes,
// refresh-on-focus, shortcuts, dialogs); the panes live next to it and all state + server calls
// are in store.ts.

interface Layout {
  /** Too narrow for list + thread side by side: show one at a time. */
  single: boolean;
  listW: number;
}

function layoutFor(w: number): Layout {
  return { single: w < 700, listW: w >= 1200 ? 340 : w >= 820 ? 300 : 280 };
}

function useLayout(): [RefObject<HTMLDivElement | null>, Layout] {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>(() => layoutFor(920));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number) =>
      setLayout(prev => {
        const next = layoutFor(w);
        return prev.single === next.single && prev.listW === next.listW ? prev : next;
      });
    apply(el.clientWidth);
    const ro = new ResizeObserver(entries => apply(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, layout];
}

export default function Messages({ win }: AppProps) {
  const status = useMessages(s => s.status);
  const error = useMessages(s => s.error);
  const composingNew = useMessages(s => s.composingNew);
  const hasThread = useMessages(s => s.thread !== null);
  const notice = useMessages(s => s.notice);
  const confirm = useMessages(s => s.confirm);
  const isActive = useOS(s => selectActiveId(s) === win.id);
  const [rootRef, layout] = useLayout();

  // Boot: the list, then whatever the window was opened for (a new-text toast's conversation).
  useEffect(() => {
    void initMessages(win.id, win.props);
  }, []);

  // A toast clicked while Messages is already open hands the window new props.
  const firstProps = useRef(true);
  useEffect(() => {
    if (firstProps.current) {
      firstProps.current = false;
      return;
    }
    applyLaunch(win.props);
  }, [win.props]);

  useBus<IncomingPush>('messages:incoming', c => onIncoming(c));
  useBus<SeenPush>('messages:seen', d => onSeen(d));

  // Back in front (focused, or restored from the taskbar): texts sent from the phone itself are
  // never pushed, so catch up.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current) onActivated();
    wasActive.current = isActive;
  }, [isActive]);

  // Ctrl+N: new message, while this is the focused window.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useMessages.getState();
      if (s.confirm || s.status !== 'ready') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        startNew();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

  const noticeBar = notice ? (
    <InfoBar severity={notice.severity} onClose={() => showNotice(null)}>
      {notice.text}
    </InfoBar>
  ) : null;

  const showRight = !layout.single || composingNew || hasThread;
  const showList = !layout.single || !showRight;
  const back = layout.single ? () => (composingNew ? cancelNew() : closeThread()) : undefined;

  let content;
  if (status === 'ready') {
    content = (
      <>
        {showList && (
          <div className={cx('min-w-0 flex flex-col bg-win', layout.single && 'flex-1')} style={layout.single ? undefined : { width: layout.listW, flexShrink: 0 }}>
            <ConversationList notice={layout.single ? noticeBar : undefined} />
          </div>
        )}
        {showRight && (
          <section className="flex-1 min-w-0 flex flex-col bg-layer rounded-tl-win border-t border-l border-stroke overflow-hidden">
            {noticeBar && <div className="px-3 pt-3 shrink-0">{noticeBar}</div>}
            <div className="flex-1 min-h-0">{composingNew ? <NewConversation onBack={back} /> : <ThreadView onBack={back} />}</div>
          </section>
        )}
      </>
    );
  } else if (status === 'error') {
    content = (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-[min(420px,100%)] flex flex-col gap-3">
          <InfoBar severity="error" title={t('ui.messages.load_failed')}>
            {error}
          </InfoBar>
          <div>
            <Button onClick={() => void loadList('initial')}>{t('ui.common.retry')}</Button>
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
      {confirm && <ConfirmDialog />}
    </div>
  );
}

function ConfirmDialog() {
  const c = useMessages(s => s.confirm);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm();
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
