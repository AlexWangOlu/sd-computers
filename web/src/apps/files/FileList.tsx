import { useEffect, useMemo, useRef } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, FileText, Image as ImageIcon, Lock, Paperclip, Pencil, RefreshCw, Search, SearchX, Smartphone, Trash2, X } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtMailDate } from '@/lib/format';
import { Button, Empty, IconButton, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { askDelete, askRename, isDirty, load, loadPhone, newDocument, openKey, selectRow, setSearch, setSort, useFiles } from './store';
import { buildRows, cx, fmtSize, type Row, type Sort, type SortBy } from './model';
import { useWidth } from './hooks';

/**
 * The bar across the top of the main area: New document, Rename and Delete for the open document,
 * the search box and Refresh. `width` is the main area's, so the buttons lose their labels before
 * the search box runs out of room. The phone's place has nothing to create or change, and says so.
 */
export function Toolbar({ width }: { width: number }) {
  const place = useFiles(s => s.place);
  const search = useFiles(s => s.search);
  const refreshing = useFiles(s => s.refreshing);
  // Rename and Delete act on the document in the editor, once it has loaded.
  const canAct = useFiles(s => !!s.open && s.open.kind === 'file' && s.open.status === 'ready' && !s.busy);
  const labels = width >= 620;

  return (
    <div className="h-12 shrink-0 flex items-center gap-1.5 px-3 border-b border-stroke">
      {place === 'documents' ? (
        <>
          <Button variant="accent" icon={<FilePlus2 size={16} />} onClick={newDocument} title={t('ui.files.new_hint')} className="shrink-0">
            {t(width >= 500 ? 'ui.files.new' : 'ui.files.new_short')}
          </Button>
          {labels ? (
            <>
              <Button variant="subtle" icon={<Pencil size={16} />} onClick={askRename} disabled={!canAct} title={t('ui.files.rename_hint')} className="shrink-0">
                {t('ui.files.rename')}
              </Button>
              <Button variant="subtle" icon={<Trash2 size={16} />} onClick={askDelete} disabled={!canAct} title={t('ui.files.delete_hint')} className="shrink-0">
                {t('ui.common.delete')}
              </Button>
            </>
          ) : (
            <>
              <IconButton title={t('ui.files.rename_hint')} onClick={askRename} disabled={!canAct} className="shrink-0">
                <Pencil size={16} />
              </IconButton>
              <IconButton title={t('ui.files.delete_hint')} onClick={askDelete} disabled={!canAct} className="shrink-0">
                <Trash2 size={16} />
              </IconButton>
            </>
          )}
        </>
      ) : (
        <div className="min-w-0 flex items-center gap-2 pl-1 text-caption text-t2" title={t('ui.files.phone_readonly')}>
          <Smartphone size={16} className="shrink-0" />
          <span className="truncate">{t('ui.files.phone_readonly')}</span>
        </div>
      )}
      <div className="flex-1 min-w-[8px]" />
      <SearchBox value={search} />
      <IconButton title={t('ui.common.refresh')} onClick={() => void load({ manual: true })} disabled={refreshing} className="shrink-0">
        {refreshing ? <Spinner size={16} /> : <RefreshCw size={16} />}
      </IconButton>
    </div>
  );
}

function SearchBox({ value }: { value: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative w-[220px] min-w-[110px] shrink">
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
        placeholder={t('ui.files.search_placeholder')}
        aria-label={t('ui.files.search_placeholder')}
        className="pl-8 pr-8"
      />
      {value && (
        <button
          type="button"
          title={t('ui.files.clear_search')}
          aria-label={t('ui.files.clear_search')}
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

/** The list of the place that is showing: name, modified, size, sorted by a click on a heading. */
export default function FileList() {
  const place = useFiles(s => s.place);
  const files = useFiles(s => s.files);
  const phoneFiles = useFiles(s => s.phoneFiles);
  const phoneStatus = useFiles(s => s.phoneStatus);
  const phoneError = useFiles(s => s.phoneError);
  const search = useFiles(s => s.search);
  const sort = useFiles(s => s.sort);
  // The new document has a line of its own until its first save.
  const draftName = useFiles(s => (s.open && s.open.kind === 'file' && s.open.id === null ? s.open.name : null));
  const selected = useFiles(s => openKey(s.open));
  const dirty = useFiles(s => isDirty(s.open));
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const [ref, width] = useWidth<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => buildRows({ place, files, phoneFiles, draftName, search, sort }), [place, files, phoneFiles, draftName, search, sort]);
  const total = place === 'phone' ? phoneFiles.length : files.length + (draftName !== null ? 1 : 0);
  // The size column is the first to go when the list is squeezed beside the editor.
  const showSize = width === 0 || width >= 330;

  // Keep the open document's line in view (arrow keys, a new document at the top).
  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector(`[data-key="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  let content;
  if (place === 'phone' && phoneStatus !== 'ready') {
    content =
      phoneStatus === 'error' ? (
        <div className="p-4 flex flex-col gap-3 items-start">
          <InfoBar severity="error" title={t('ui.files.phone_load_failed')}>
            {phoneError}
          </InfoBar>
          <Button onClick={() => void loadPhone()}>{t('ui.common.retry')}</Button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size={24} />
        </div>
      );
  } else if (total === 0) {
    content =
      place === 'phone' ? (
        <Empty icon={<Smartphone size={40} strokeWidth={1.25} />} title={t('ui.files.phone_empty_title')}>
          {t('ui.files.phone_empty_hint')}
        </Empty>
      ) : (
        <Empty icon={<FileText size={40} strokeWidth={1.25} />} title={t('ui.files.empty_title')}>
          {t('ui.files.empty_hint')}
        </Empty>
      );
  } else if (rows.length === 0) {
    content = (
      <Empty icon={<SearchX size={40} strokeWidth={1.25} />} title={t('ui.files.no_results')}>
        {t('ui.files.no_results_hint', search.trim())}
      </Empty>
    );
  } else {
    content = (
      <div ref={listRef} data-files-list role="listbox" aria-label={t(place === 'phone' ? 'ui.files.phone' : 'ui.files.documents')} tabIndex={0} className="flex-1 min-h-0 overflow-y-auto os-scroll outline-none">
        {/* Inside the scroller, so the headings stay over their columns when a scrollbar appears. */}
        <div className="sticky top-0 z-10 h-8 flex items-center gap-2 px-3 bg-layer border-b border-stroke text-caption text-t2 select-none">
          <SortHead by="name" label={t('ui.files.col_name')} sort={sort} className="flex-1 min-w-0" />
          <SortHead by="modified" label={t('ui.files.col_modified')} sort={sort} className="shrink-0 w-[72px]" />
          {showSize && <SortHead by="size" label={t('ui.files.col_size')} sort={sort} className="shrink-0 w-[56px] justify-end" />}
        </div>
        {rows.map(r => (
          <RowView key={r.key} r={r} selected={r.key === selected} dirty={dirty && r.key === selected} showSize={showSize} clock24={clock24} />
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="h-full flex flex-col min-h-0">
      {content}
    </div>
  );
}

function SortHead({ by, label, sort, className }: { by: SortBy; label: string; sort: Sort; className?: string }) {
  const active = sort.by === by;
  return (
    <button type="button" title={t('ui.files.sort_by', label)} onClick={() => setSort(by)} className={cx('h-full flex items-center gap-1 text-left hover:text-t1', active && 'text-t1 font-semibold', className)}>
      <span className="truncate">{label}</span>
      {active && (sort.dir === 1 ? <ArrowUp size={12} className="shrink-0" /> : <ArrowDown size={12} className="shrink-0" />)}
    </button>
  );
}

function RowView({ r, selected, dirty, showSize, clock24 }: { r: Row; selected: boolean; dirty: boolean; showSize: boolean; clock24: boolean }) {
  const draft = r.id === null;
  const Icon = draft ? FilePlus2 : r.kind === 'image' ? ImageIcon : r.kind === 'file' ? Paperclip : FileText;
  // The phone keeps no size for a picture or an attachment: an empty cell says more than "0 B".
  const size = r.size === null || (r.size === 0 && r.kind !== 'text') ? '' : fmtSize(r.size);
  return (
    <div
      data-key={r.key}
      role="option"
      aria-selected={selected}
      onClick={() => selectRow(r)}
      className={cx('scroll-mt-8 h-9 flex items-center gap-2 px-3 cursor-default border-b border-stroke transition-colors duration-150', selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-subtle')}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Icon size={16} className={cx('shrink-0', selected ? 'text-accent-text' : 'text-t2')} />
        <span className={cx('min-w-0 truncate text-body', r.name ? 'text-t1' : 'text-t3')} title={r.name || undefined}>
          {r.name || t('ui.files.untitled')}
        </span>
        {dirty && <span title={t('ui.files.unsaved')} className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />}
        {r.locked && (
          <span title={t('ui.files.locked')} className="shrink-0 text-t3">
            <Lock size={12} />
          </span>
        )}
      </div>
      <span className="shrink-0 w-[72px] truncate text-caption text-t2 tabular-nums">{draft ? t('ui.files.not_saved') : r.updatedAt ? fmtMailDate(r.updatedAt, clock24) : ''}</span>
      {showSize && <span className="shrink-0 w-[56px] text-right text-caption text-t2 tabular-nums">{size}</span>}
    </div>
  );
}
