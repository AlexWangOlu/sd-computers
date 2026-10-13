import { useEffect, useRef, useState } from 'react';
import type { AppProps } from '../registry';
import { selectActiveId, setCloseGuard, useOS } from '@/store/os';
import { t } from '@/i18n';
import { Button, Dialog, InfoBar, Spinner, TextInput } from '@/ui/controls';
import Editor from './Editor';
import FileList, { Toolbar } from './FileList';
import Sidebar from './Sidebar';
import {
  askDelete,
  askRename,
  backToList,
  closeDialog,
  confirmDelete,
  guardLeave,
  initFiles,
  isDirty,
  load,
  newDocument,
  rename,
  resolveUnsaved,
  save,
  showNotice,
  stepSelection,
  teardownFiles,
  useFiles,
} from './store';
import { cx } from './model';
import { useWidth } from './hooks';
import { PrintSlot } from '@/os/print/PrintDialog';

// Files - the character's documents (files:*), which roam with them to every computer, and beside
// them the phone's own documents while sd-phone is linked. index.tsx owns the window-level
// concerns (layout, the close guard, shortcuts, dialogs); the panes live next to it and all state
// + server calls are in store.ts.

/** Narrower than this, the list and the document take turns (with a Back button). */
const SINGLE_BELOW = 760;
/** Narrower than this, the places pane gives some of its width to the rest. */
const SLIM_SIDE_BELOW = 900;

export default function Files({ win }: AppProps) {
  const status = useFiles(s => s.status);
  const error = useFiles(s => s.error);
  const hasOpen = useFiles(s => s.open !== null);
  const view = useFiles(s => s.view);
  const dialog = useFiles(s => s.dialog);
  const isActive = useOS(s => selectActiveId(s) === win.id);
  const [rootRef, width] = useWidth<HTMLDivElement>();

  const single = width > 0 && width < SINGLE_BELOW;
  const slim = width > 0 && width < SLIM_SIDE_BELOW;
  const mainWidth = Math.max(0, width - (slim ? 190 : 220));

  // Load on open.
  useEffect(() => {
    initFiles();
    return () => teardownFiles();
  }, []);

  // Closing the window (title-bar X, Alt+F4) with unsaved changes asks first, like Notepad. Once
  // that's settled the document is clean - saved or reverted - so the second close goes through.
  useEffect(() => {
    setCloseGuard(win.id, () => {
      if (!isDirty(useFiles.getState().open)) return true;
      guardLeave(() => window.setTimeout(() => useOS.getState().close(win.id), 30));
      return false;
    });
    return () => setCloseGuard(win.id, null);
  }, [win.id]);

  // Nothing is pushed: a document made on the phone, or copied there from another app, shows up
  // when the window comes back to the front.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current && useFiles.getState().status === 'ready') void load({ silent: true });
    wasActive.current = isActive;
  }, [isActive]);

  // Shortcuts while this is the focused window: Ctrl+S save, Ctrl+N new document, F2 rename;
  // Up/Down and Delete while the list has focus; Escape closes a prompt.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      const s = useFiles.getState();
      if (s.dialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDialog();
        }
        return;
      }
      if (s.status !== 'ready') return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.altKey && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 's') void save();
        else if (k === 'n') newDocument();
        else return;
        e.preventDefault();
        return;
      }
      if (ctrl || e.altKey) return;
      if (e.key === 'F2') {
        e.preventDefault();
        askRename();
        return;
      }
      // Only while the list has focus, so the arrows and Delete still work in the editor.
      const el = e.target as HTMLElement | null;
      if (!el || !el.closest('[data-files-list]')) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        stepSelection(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        askDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive]);

  let content;
  if (status === 'ready') {
    const showDoc = !single || (hasOpen && view === 'doc');
    const showList = !single || !showDoc;
    // Beside the editor the list takes a little under half of the main area, within reason.
    const listWidth = Math.round(Math.min(460, Math.max(280, mainWidth * 0.48)));
    content = (
      <>
        <Sidebar narrow={slim} />
        <main className="flex-1 min-w-0 flex flex-col bg-layer rounded-tl-win border-t border-l border-stroke overflow-hidden">
          {showList && <Toolbar width={mainWidth} />}
          <NoticeBar />
          <div className="flex-1 min-h-0 flex">
            {showList && (
              <div className={cx('min-w-0 flex flex-col', single ? 'flex-1' : 'shrink-0 border-r border-stroke')} style={single ? undefined : { width: listWidth }}>
                <FileList />
              </div>
            )}
            {showDoc && (
              <section className="flex-1 min-w-0 flex flex-col">
                <Editor onBack={single ? backToList : undefined} />
              </section>
            )}
          </div>
        </main>
      </>
    );
  } else if (status === 'error') {
    content = (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-[min(420px,100%)] flex flex-col gap-3">
          <InfoBar severity="error" title={t('ui.files.load_failed')}>
            {error}
          </InfoBar>
          <div>
            <Button onClick={() => void load()}>{t('ui.common.retry')}</Button>
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
      <PrintSlot app="files" />
      {dialog?.kind === 'unsaved' && <UnsavedDialog />}
      {dialog?.kind === 'delete' && <DeleteDialog />}
      {dialog?.kind === 'rename' && <RenameDialog id={dialog.id} name={dialog.name} />}
    </div>
  );
}

/** What just happened (a copy made, a refresh that failed), under the toolbar. */
function NoticeBar() {
  const notice = useFiles(s => s.notice);
  const refreshing = useFiles(s => s.refreshing);
  if (!notice) return null;
  return (
    <div className="shrink-0 p-3 flex flex-col gap-2 border-b border-stroke">
      <InfoBar severity={notice.severity} title={notice.title} onClose={() => showNotice(null)}>
        {notice.text}
      </InfoBar>
      {notice.retry && (
        <div>
          <Button compact onClick={notice.retry} disabled={refreshing}>
            {t('ui.common.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The open Documents file's name, for the prompts. */
const useOpenName = (): string => useFiles(s => (s.open && s.open.kind === 'file' ? s.open.savedName.trim() || s.open.name.trim() : '')) || t('ui.files.untitled');

/** Leaving a document with unsaved changes: save them, drop them, or stay. */
function UnsavedDialog() {
  const busy = useFiles(s => s.busy !== null);
  const name = useOpenName();
  return (
    <Dialog
      title={t('ui.files.unsaved_title')}
      onClose={closeDialog}
      actions={
        <>
          <Button variant="accent" autoFocus disabled={busy} onClick={() => void resolveUnsaved('save')}>
            {t('ui.common.save')}
          </Button>
          <Button disabled={busy} onClick={() => void resolveUnsaved('discard')}>
            {t('ui.files.dont_save')}
          </Button>
          <Button disabled={busy} onClick={() => void resolveUnsaved('cancel')}>
            {t('ui.common.cancel')}
          </Button>
        </>
      }
    >
      {t('ui.files.unsaved_body', name)}
    </Dialog>
  );
}

function DeleteDialog() {
  const busy = useFiles(s => s.busy !== null);
  const name = useOpenName();
  return (
    <Dialog
      title={t('ui.files.delete_title')}
      onClose={closeDialog}
      actions={
        <>
          <Button variant="danger" autoFocus disabled={busy} className="min-w-[120px]" onClick={() => void confirmDelete()}>
            {t('ui.common.delete')}
          </Button>
          <Button disabled={busy} className="min-w-[120px]" onClick={closeDialog}>
            {t('ui.common.cancel')}
          </Button>
        </>
      }
    >
      {t('ui.files.delete_body', name)}
    </Dialog>
  );
}

/** Rename prompt. A refusal (a name already in use) shows here, with the prompt still open. */
function RenameDialog({ id, name }: { id: number; name: string }) {
  const busy = useFiles(s => s.busy !== null);
  const maxName = useFiles(s => s.limits.maxName);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const unchanged = value.trim() === name;
  const submit = () => {
    if (busy || unchanged || value.trim() === '') return;
    setError(null);
    void rename(id, value).then(refused => {
      if (refused) setError(refused);
    });
  };

  return (
    <Dialog
      title={t('ui.files.rename_title')}
      onClose={closeDialog}
      actions={
        <>
          <Button variant="accent" disabled={busy || unchanged || value.trim() === ''} className="min-w-[120px]" onClick={submit}>
            {t('ui.files.rename')}
          </Button>
          <Button disabled={busy} className="min-w-[120px]" onClick={closeDialog}>
            {t('ui.common.cancel')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextInput
          ref={inputRef}
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={maxName}
          autoComplete="off"
          aria-label={t('ui.files.rename_label')}
          placeholder={t('ui.files.rename_label')}
        />
        {error && <InfoBar severity="error">{error}</InfoBar>}
      </div>
    </Dialog>
  );
}
