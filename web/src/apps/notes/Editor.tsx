import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, ImageOff, NotebookPen, Smartphone, Trash2 } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Button, Empty, IconButton, InfoBar, Spinner } from '@/ui/controls';
import { askDelete, clearFocus, closeNote, editBody, openViewer, retryOpen, saveNow, useNotes, type OpenNote, type SaveState } from './store';
import { MAX_BODY, createdLabel, cx, editedLabel, type Row } from './model';

/** Right pane: the open note (text editor + read-only photos/sketches), or "No note selected". */
export default function Editor({ onBack }: { onBack?: () => void }) {
  const open = useNotes(s => s.open);
  const row = useNotes(s => (s.open ? s.rows.find(r => r.key === s.open!.key) : undefined));
  const save = useNotes(s => (s.open ? s.saves[s.open.key] : undefined));

  if (!open) {
    return (
      <Empty icon={<NotebookPen size={48} strokeWidth={1} />} title={t('ui.notes.select_title')}>
        {t('ui.notes.select_hint')}
      </Empty>
    );
  }

  // Keyed by note (a stable client key, not the server id), so each one opened rises in.
  return (
    <div key={open.key} className="h-full flex flex-col min-h-0 page-in">
      <Header open={open} row={row} save={save} onBack={onBack} />
      {open.status === 'loading' ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : open.status === 'error' ? (
        <div className="p-6 flex flex-col gap-3 items-start">
          <InfoBar severity="error" title={t('ui.notes.open_failed')}>
            {open.error}
          </InfoBar>
          <Button onClick={retryOpen}>{t('ui.common.retry')}</Button>
        </div>
      ) : (
        <Body open={open} save={save} />
      )}
    </div>
  );
}

function Header({ open, row, save, onBack }: { open: OpenNote; row?: Row; save?: SaveState; onBack?: () => void }) {
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  // A new note nobody has typed into yet: discard it without asking.
  const blankDraft = !row?.id && open.body.trim() === '';
  const label = blankDraft || !row ? t('ui.notes.draft_header') : editedLabel(row.updatedAt, clock24);
  const created = row?.id ? createdLabel(row.createdAt, clock24) : '';
  return (
    <div className="h-12 shrink-0 flex items-center gap-1 px-2 border-b border-stroke">
      {onBack && (
        <IconButton title={t('ui.notes.back')} onClick={onBack} className="shrink-0">
          <ArrowLeft size={16} />
        </IconButton>
      )}
      <div className="flex-1 min-w-0 px-2 text-caption text-t2 truncate" title={created || undefined}>
        {open.status === 'loading' ? '' : label}
      </div>
      {open.status === 'ready' && <SaveStatus save={save} />}
      <IconButton title={t('ui.notes.delete')} onClick={blankDraft ? closeNote : askDelete} disabled={open.status === 'loading'} className="shrink-0">
        <Trash2 size={16} />
      </IconButton>
    </div>
  );
}

function SaveStatus({ save }: { save?: SaveState }) {
  if (!save) return null;
  if (save.state === 'saving') {
    return (
      <span className="shrink-0 flex items-center gap-1.5 px-2 text-caption text-t2">
        <Spinner size={12} />
        {t('ui.notes.saving')}
      </span>
    );
  }
  if (save.state === 'saved') {
    return (
      <span className="shrink-0 flex items-center gap-1 px-2 text-caption text-t3">
        <Check size={14} />
        {t('ui.notes.saved')}
      </span>
    );
  }
  return (
    <span className="shrink-0 flex items-center gap-1 px-2 text-caption text-critical">
      <AlertCircle size={14} />
      {t('ui.notes.not_saved')}
    </span>
  );
}

function Body({ open, save }: { open: OpenNote; save?: SaveState }) {
  const focusKey = useNotes(s => s.focusKey);
  const ref = useRef<HTMLTextAreaElement>(null);

  // A new note takes the caret as soon as its editor is on screen.
  useEffect(() => {
    if (focusKey !== open.key || !ref.current) return;
    ref.current.focus();
    clearFocus();
  }, [focusKey, open.key]);

  const media = open.images.length + open.sketches.length;

  return (
    <>
      {save?.state === 'error' && (
        <div className="shrink-0 px-3 pt-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <InfoBar severity="error" title={t('ui.notes.save_failed')}>
              {save.error}
            </InfoBar>
          </div>
          <Button onClick={saveNow} className="shrink-0">
            {t('ui.common.retry')}
          </Button>
        </div>
      )}
      <textarea
        ref={ref}
        value={open.body}
        onChange={e => editBody(e.target.value)}
        maxLength={MAX_BODY}
        spellCheck={false}
        autoComplete="off"
        placeholder={t('ui.notes.placeholder')}
        aria-label={t('ui.notes.editor_label')}
        className="flex-1 min-h-[96px] w-full resize-none border-0 outline-none bg-layer text-t1 placeholder:text-t3 px-6 py-4 os-scroll"
        style={{
          // Retro swaps the editor font through the same variable Notepad reads.
          fontFamily: 'var(--notepad-font, "Inter Variable", system-ui, sans-serif)',
          fontSize: 15,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}
      />
      {media > 0 && <MediaStrip open={open} />}
    </>
  );
}

/** Read-only thumbnails of the note's photos then sketches; a click opens the viewer. */
function MediaStrip({ open }: { open: OpenNote }) {
  const items = [...open.images.map(src => ({ src, sketch: false })), ...open.sketches.map(src => ({ src, sketch: true }))];
  return (
    <div className="shrink-0 border-t border-stroke px-4 pt-2.5 pb-3">
      <div className="flex items-center gap-1.5 mb-2 text-caption text-t2">
        <Smartphone size={14} className="shrink-0" />
        <span className="truncate">{t('ui.notes.media_caption')}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto os-scroll pb-1">
        {items.map((m, i) => {
          const n = m.sketch ? i - open.images.length + 1 : i + 1;
          return <Thumb key={`${i}:${m.src.length}`} src={m.src} sketch={m.sketch} label={t(m.sketch ? 'ui.notes.sketch_n' : 'ui.notes.photo_n', n)} onOpen={() => openViewer(i)} />;
        })}
      </div>
    </div>
  );
}

function Thumb({ src, sketch, label, onOpen }: { src: string; sketch: boolean; label: string; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onOpen}
      className={cx(
        'shrink-0 w-24 h-16 rounded-ctl overflow-hidden border border-stroke flex items-center justify-center transition-shadow duration-150',
        'hover:ring-2 hover:ring-[var(--accent-fill)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-fill)]',
        // Content, not chrome: the phone draws sketches as transparent PNGs over a white board.
        sketch ? 'bg-white' : 'bg-card',
      )}
    >
      {broken ? (
        <ImageOff size={18} className="text-t3" />
      ) : (
        <img src={src} alt="" draggable={false} onError={() => setBroken(true)} className={cx('w-full h-full', sketch ? 'object-contain' : 'object-cover')} />
      )}
    </button>
  );
}
