import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { AppProps } from '../registry';
import { selectActiveId, useOS } from '@/store/os';
import { t } from '@/i18n';
import { Button, Dialog, InfoBar, Spinner } from '@/ui/controls';
import Editor from './Editor';
import MediaViewer from './MediaViewer';
import NoteList from './NoteList';
import { cancelDelete, closeNote, closeViewer, deleteOpen, initNotes, loadList, newNote, saveNow, stepSelection, stepViewer, teardownNotes, useNotes } from './store';
import { cx } from './model';

// Notes - the character's PHONE notes over the optional sd-phone link (phonenotes:*), not
// Notepad's own files. index.tsx owns the window-level concerns (layout, re-activation refresh,
// shortcuts, dialogs); the panes live next to it and all state + server calls are in store.ts.

/** Narrower than this, list and editor take turns (with a Back button). */
const SINGLE_BELOW = 640;

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

export default function Notes({ win }: AppProps) {
  const status = useNotes(s => s.status);
  const error = useNotes(s => s.error);
  const selected = useNotes(s => s.selected);
  const confirm = useNotes(s => s.confirm);
  const viewer = useNotes(s => s.viewer);
  const isActive = useOS(s => selectActiveId(s) === win.id);
  const [rootRef, single] = useSinglePane();

  // Load on open; on close, flush every pending save (fire-and-forget) so nothing typed is lost.
  useEffect(() => {
    initNotes();
    return () => teardownNotes();
  }, []);

  // Phone edits aren't pushed: re-read the list whenever the window comes back to the front.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current && useNotes.getState().status === 'ready') void loadList({ silent: true });
    wasActive.current = isActive;
  }, [isActive]);

  // Shortcuts while this is the focused window: Ctrl+N new note, Ctrl+S save now, Up/Down in the
  // list, and Escape / arrows for the viewer and the delete prompt.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      const s = useNotes.getState();
      if (s.viewer !== null) {
        if (e.key === 'Escape') closeViewer();
        else if (e.key === 'ArrowLeft') stepViewer(-1);
        else if (e.key === 'ArrowRight') stepViewer(1);
        else return;
        e.preventDefault();
        return;
      }
      if (s.confirm) {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelDelete();
        }
        return;
      }
      if (s.status !== 'ready') return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'n') newNote();
        else if (k === 's') saveNow();
        else return;
        e.preventDefault();
        return;
      }
      if (ctrl || e.altKey || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      // Only while the list has focus, so the arrows still move the caret in the editor.
      const el = e.target as HTMLElement | null;
      if (!el || !el.closest('[data-notes-list]')) return;
      e.preventDefault();
      stepSelection(e.key === 'ArrowDown' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

  let content;
  if (status === 'ready') {
    const showEditor = !single || selected !== null;
    const showList = !single || selected === null;
    content = (
      <>
        {showList && (
          <aside className={cx('min-w-0 flex flex-col bg-win', single ? 'flex-1' : 'w-[280px] shrink-0')}>
            <NoteList />
          </aside>
        )}
        {showEditor && (
          <section className={cx('flex-1 min-w-0 flex flex-col bg-layer border-t border-stroke overflow-hidden', !single && 'rounded-tl-win border-l')}>
            <Editor onBack={single ? closeNote : undefined} />
          </section>
        )}
      </>
    );
  } else if (status === 'error') {
    content = (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-[min(420px,100%)] flex flex-col gap-3">
          <InfoBar severity="error" title={t('ui.notes.load_failed')}>
            {error}
          </InfoBar>
          <div>
            <Button onClick={() => void loadList()}>{t('ui.common.retry')}</Button>
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
      {confirm && <DeleteDialog />}
      {viewer !== null && <MediaViewer />}
    </div>
  );
}

function DeleteDialog() {
  const row = useNotes(s => (s.selected ? s.rows.find(r => r.key === s.selected) : undefined));
  const open = useNotes(s => s.open);
  const title = row?.title || t('ui.notes.untitled');
  const media = !!open && open.images.length + open.sketches.length > 0;
  return (
    <Dialog
      title={t('ui.notes.delete_title')}
      onClose={cancelDelete}
      actions={
        <>
          <Button variant="danger" autoFocus className="min-w-[120px]" onClick={deleteOpen}>
            {t('ui.common.delete')}
          </Button>
          <Button className="min-w-[120px]" onClick={cancelDelete}>
            {t('ui.common.cancel')}
          </Button>
        </>
      }
    >
      {t(media ? 'ui.notes.delete_body_media' : 'ui.notes.delete_body', title)}
    </Dialog>
  );
}
