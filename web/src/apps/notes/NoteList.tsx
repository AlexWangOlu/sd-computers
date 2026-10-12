import { Fragment, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, Image as ImageIcon, PenLine, RefreshCw, Search, SearchX, SquarePen, StickyNote, X } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtMailDate } from '@/lib/format';
import { Button, Empty, IconButton, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { loadList, newNote, selectNote, setSearch, showNotice, useNotes } from './store';
import { cx, dayGroup, matches, toMs, type DayGroup, type Row } from './model';

/** Left pane: title, refresh, New note, search, and the notes grouped by when they were edited. */
export default function NoteList() {
  const rows = useNotes(s => s.rows);
  const search = useNotes(s => s.search);
  const selected = useNotes(s => s.selected);
  const refreshing = useNotes(s => s.refreshing);
  const notice = useNotes(s => s.notice);
  const saves = useNotes(s => s.saves);
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => rows.filter(r => matches(r, search)), [rows, search]);
  const saved = useMemo(() => rows.reduce((n, r) => (r.id ? n + 1 : n), 0), [rows]);

  // Keep the selected row in view (arrow keys, a new note at the top).
  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector(`[data-key="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  let lastGroup: DayGroup | null = null;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1 h-8 pl-1">
          <div className="flex-1 min-w-0 text-subtitle font-semibold text-t1 truncate">{t('ui.notes.title')}</div>
          <IconButton title={t('ui.common.refresh')} onClick={() => void loadList({ manual: true })} disabled={refreshing}>
            {refreshing ? <Spinner size={16} /> : <RefreshCw size={16} />}
          </IconButton>
          <Button variant="accent" compact icon={<SquarePen size={15} />} onClick={newNote} title={t('ui.notes.new_note_hint')} className="shrink-0">
            {t('ui.notes.new_note')}
          </Button>
        </div>
        <div className="pl-1 -mt-0.5 mb-2 text-caption text-t2 truncate">
          {saved === 1 ? t('ui.notes.count_one') : t('ui.notes.count_many', saved)}
        </div>
        <SearchBox value={search} />
      </div>

      {notice && (
        <div className="px-3 pb-2 shrink-0 flex flex-col gap-2">
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
      )}

      <div ref={listRef} data-notes-list role="listbox" aria-label={t('ui.notes.title')} tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto os-scroll outline-none">
        {rows.length === 0 ? (
          <Empty icon={<StickyNote size={40} strokeWidth={1.25} />} title={t('ui.notes.empty_title')}>
            {t('ui.notes.empty_hint')}
          </Empty>
        ) : visible.length === 0 ? (
          <Empty icon={<SearchX size={40} strokeWidth={1.25} />} title={t('ui.notes.no_results')}>
            {t('ui.notes.no_results_hint', search.trim())}
          </Empty>
        ) : (
          <div className="pb-2">
            {visible.map(r => {
              const g = dayGroup(toMs(r.updatedAt));
              const header = g !== lastGroup;
              lastGroup = g;
              return (
                <Fragment key={r.key}>
                  {header && <div className="sticky top-0 z-10 bg-win px-4 pt-3 pb-1 text-caption font-semibold text-t2">{t(`ui.notes.group_${g}`)}</div>}
                  <NoteRowView r={r} selected={r.key === selected} clock24={clock24} failed={saves[r.key]?.state === 'error'} />
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchBox({ value }: { value: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t2 pointer-events-none z-[1]" />
      <TextInput
        ref={ref}
        value={value}
        onChange={e => setSearch(e.target.value.slice(0, 64))}
        onKeyDown={e => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            setSearch('');
          }
        }}
        placeholder={t('ui.notes.search_placeholder')}
        aria-label={t('ui.notes.search_placeholder')}
        className="pl-8 pr-8"
      />
      {value && (
        <button
          type="button"
          title={t('ui.notes.clear_search')}
          aria-label={t('ui.notes.clear_search')}
          onClick={() => {
            setSearch('');
            ref.current?.focus();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-ctl text-t2 hover:bg-subtle hover:text-t1"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function NoteRowView({ r, selected, clock24, failed }: { r: Row; selected: boolean; clock24: boolean; failed: boolean }) {
  const ms = toMs(r.updatedAt);
  return (
    <div
      data-key={r.key}
      role="option"
      aria-selected={selected}
      onClick={() => selectNote(r.key)}
      className={cx('px-4 py-2.5 cursor-default border-b border-stroke transition-colors duration-150', selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-subtle')}
    >
      <div className="flex items-center gap-2">
        <span className={cx('flex-1 min-w-0 truncate text-body font-semibold', r.title ? 'text-t1' : 'text-t3')}>{r.title || t('ui.notes.untitled')}</span>
        {failed && (
          <span title={t('ui.notes.not_saved')} className="shrink-0 text-critical">
            <AlertCircle size={14} />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-caption">
        {ms > 0 && <span className="shrink-0 text-t2 tabular-nums">{fmtMailDate(ms / 1000, clock24)}</span>}
        <span className="flex-1 min-w-0 truncate text-t3">{r.preview || t('ui.notes.no_text')}</span>
        {r.images > 0 && (
          <span title={r.images === 1 ? t('ui.notes.photos_one') : t('ui.notes.photos_many', r.images)} className="shrink-0 text-t2">
            <ImageIcon size={14} />
          </span>
        )}
        {r.sketches > 0 && (
          <span title={r.sketches === 1 ? t('ui.notes.sketches_one') : t('ui.notes.sketches_many', r.sketches)} className="shrink-0 text-t2">
            <PenLine size={14} />
          </span>
        )}
      </div>
    </div>
  );
}
