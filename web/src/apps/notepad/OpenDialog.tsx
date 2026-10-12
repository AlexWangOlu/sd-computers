import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { fmtAgo } from '@/lib/format';
import { Button, Dialog, InfoBar, Spinner } from '@/ui/controls';
import { asNotes, type Note } from './model';

/**
 * File > Open: the character's saved notes (newest edit first) - title, last edit, first line of
 * the body. Click selects, double-click / Enter / Open opens it in a tab.
 */
export default function OpenDialog({ openIds, onOpen, onClose }: { openIds: Set<string>; onOpen: (n: Note) => void; onClose: () => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setNotes(null);
    setError(null);
    void rpc<Note[]>('notes:list').then(r => {
      if (!r.ok) {
        setError(r.error ?? t('ui.common.error'));
        setNotes([]);
        return;
      }
      const list = asNotes(r.data);
      setNotes(list);
      setSel(list[0]?.id ?? null);
    });
  };
  useEffect(load, []);

  useEffect(() => {
    if (notes && notes.length) listRef.current?.focus();
  }, [notes]);

  const selected = notes?.find(n => n.id === sel) ?? null;
  const open = (n: Note | null) => {
    if (n) onOpen(n);
  };

  const move = (d: number) => {
    if (!notes || notes.length === 0) return;
    const i = Math.max(0, notes.findIndex(n => n.id === sel));
    const next = notes[Math.min(notes.length - 1, Math.max(0, i + d))];
    setSel(next.id);
    listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <Dialog
      title={t('ui.notepad.open_title')}
      onClose={onClose}
      actions={
        <>
          <Button variant="accent" disabled={!selected} onClick={() => open(selected)}>
            {t('ui.notepad.open_button')}
          </Button>
          <Button onClick={onClose}>{t('ui.common.cancel')}</Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <InfoBar severity="error">{error}</InfoBar>
        </div>
      )}
      {notes === null ? (
        <div className="h-40 flex items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : notes.length === 0 ? (
        !error && (
          <div className="h-40 flex flex-col items-center justify-center text-center gap-1">
            <FileText size={28} className="text-t3 mb-1" />
            <div className="text-body font-semibold text-t1">{t('ui.notepad.open_empty_title')}</div>
            <div className="text-caption text-t2 max-w-[300px]">{t('ui.notepad.open_empty_body')}</div>
          </div>
        )
      ) : (
        <div
          ref={listRef}
          tabIndex={0}
          role="listbox"
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              move(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              open(selected);
            }
          }}
          className="-mx-2 max-h-[300px] overflow-y-auto os-scroll outline-none flex flex-col gap-0.5"
        >
          {notes.map(n => {
            const isSel = n.id === sel;
            const preview = n.body.split('\n').map(l => l.trim()).filter(Boolean).join('  ').slice(0, 140);
            return (
              <button
                key={n.id}
                type="button"
                tabIndex={-1}
                data-id={n.id}
                role="option"
                aria-selected={isSel}
                onClick={() => setSel(n.id)}
                onDoubleClick={() => open(n)}
                className={`relative w-full flex items-start gap-3 px-3 py-2 rounded-ctl text-left transition-colors duration-150 ${isSel ? 'bg-subtle' : 'hover:bg-subtle'}`}
              >
                {isSel && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-accent fade-in" />}
                <FileText size={16} className="mt-0.5 shrink-0 text-accent-text" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 min-w-0 truncate text-body text-t1">{n.title}</span>
                    {openIds.has(n.id) && <span className="shrink-0 text-caption text-accent-text">{t('ui.notepad.open_in_tab')}</span>}
                    <span className="shrink-0 text-caption text-t3">{fmtAgo(n.updatedAt)}</span>
                  </div>
                  <div className="text-caption text-t2 truncate">{preview || t('ui.notepad.open_no_text')}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
