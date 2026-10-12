import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Spinner } from '@/ui/controls';
import { fmtStamp } from '@/lib/format';
import type { Entry, Sort, SortKey } from './types';
import { LevelIcon } from './icons';
import { L, cx, levelLabel, taskCategory, userOf } from './model';

const ROW_H = 21;
const HEAD_H = 22;
const MIN_COL = 36;

const COLS: { key: SortKey; label: string }[] = [
  { key: 'level', label: 'col_level' },
  { key: 'ts', label: 'col_date' },
  { key: 'source', label: 'col_source' },
  { key: 'event_id', label: 'col_event_id' },
  { key: 'task', label: 'col_task' },
  { key: 'user', label: 'col_user' },
];

/** Column widths survive switching logs (module-level, like MMC remembering them per session). */
let savedWidths: Record<SortKey, number> = { level: 118, ts: 168, source: 104, event_id: 64, task: 112, user: 120 };

interface Props {
  entries: Entry[];
  selId: number | null;
  onSelect: (id: number) => void;
  onOpen: (id: number) => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  clock24: boolean;
  loading: boolean;
  more: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * The event list: a dense MMC ListView. Headers sort (click again to flip) and resize (drag the
 * separator); rows select on click, open Event Properties on double-click / Enter; arrow keys,
 * Home/End and PageUp/PageDown move the selection and keep it in view under the sticky header.
 */
export function EventGrid({ entries, selId, onSelect, onOpen, sort, onSort, clock24, loading, more, loadingMore, onLoadMore }: Props) {
  const [widths, setWidths] = useState(savedWidths);
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const resizing = useRef<{ key: SortKey; x: number; w: number } | null>(null);

  useEffect(() => {
    savedWidths = widths;
  }, [widths]);

  const template = COLS.map(c => `${widths[c.key]}px`).join(' ') + ' minmax(0,1fr)';
  const total = COLS.reduce((s, c) => s + widths[c.key], 0);

  // Keep the selected row visible (keyboard, Find, Properties prev/next).
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || selId === null) return;
    const row = box.querySelector<HTMLElement>(`[data-row="${selId}"]`);
    if (!row) return;
    const top = row.offsetTop;
    if (top - HEAD_H < box.scrollTop) box.scrollTop = top - HEAD_H;
    else if (top + ROW_H > box.scrollTop + box.clientHeight) box.scrollTop = top + ROW_H - box.clientHeight;
  }, [selId]);

  const onKey = (e: KeyboardEvent) => {
    if (!entries.length) return;
    const i = selId === null ? -1 : entries.findIndex(x => x.id === selId);
    const page = Math.max(1, Math.floor(((boxRef.current?.clientHeight ?? 200) - HEAD_H) / ROW_H) - 1);
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(entries.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = entries.length - 1;
    else if (e.key === 'PageDown') next = Math.min(entries.length - 1, i + page);
    else if (e.key === 'PageUp') next = Math.max(0, i - page);
    else if (e.key === 'Enter') {
      if (selId !== null) onOpen(selId);
      e.preventDefault();
      return;
    } else return;
    e.preventDefault();
    if (next >= 0 && next !== i) onSelect(entries[next].id);
  };

  const startResize = (key: SortKey) => (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = { key, x: e.clientX, w: widths[key] };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveResize = (e: RPointerEvent<HTMLDivElement>) => {
    const r = resizing.current;
    if (!r) return;
    const w = Math.max(MIN_COL, Math.round(r.w + e.clientX - r.x));
    setWidths(ws => (ws[r.key] === w ? ws : { ...ws, [r.key]: w }));
  };
  const endResize = () => {
    resizing.current = null;
  };

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      onKeyDown={onKey}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="relative h-full overflow-auto os-scroll outline-none text-[12px] bg-layer"
    >
      <div className="relative" style={{ minWidth: total + 24 }}>
        <div className="sticky top-0 z-10 grid bg-layer border-b border-stroke-strong text-t2" style={{ gridTemplateColumns: template, height: HEAD_H }}>
          {COLS.map(c => (
            <div
              key={c.key}
              onClick={() => onSort({ key: c.key, dir: sort.key === c.key ? (sort.dir === 'asc' ? 'desc' : 'asc') : c.key === 'ts' ? 'desc' : 'asc' })}
              className="relative flex items-center gap-1 px-1.5 border-r border-stroke hover:bg-subtle cursor-default select-none"
            >
              <span className="truncate">{L(c.label)}</span>
              {sort.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={11} className="shrink-0" /> : <ChevronDown size={11} className="shrink-0" />)}
              <div
                className="absolute -right-[4px] top-0 h-full w-[7px] z-10 cursor-col-resize"
                onPointerDown={startResize(c.key)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onClick={e => e.stopPropagation()}
              />
            </div>
          ))}
          <div />
        </div>

        {entries.map(e => {
          const sel = e.id === selId;
          return (
            <div
              key={e.id}
              data-row={e.id}
              onMouseDown={() => onSelect(e.id)}
              onDoubleClick={() => onOpen(e.id)}
              className={cx(
                'grid items-center cursor-default select-none',
                sel ? (focused ? 'bg-accent text-accent-on' : 'bg-control-hover text-t1') : 'text-t1 hover:bg-subtle',
              )}
              style={{ gridTemplateColumns: template, height: ROW_H }}
            >
              <div className="flex items-center gap-1.5 px-1.5 min-w-0">
                <LevelIcon level={e.level} />
                <span className="truncate">{levelLabel(e.level)}</span>
              </div>
              <div className="px-1.5 truncate">{fmtStamp(e.ts, clock24)}</div>
              <div className="px-1.5 truncate">{e.source}</div>
              <div className="px-1.5 truncate">{e.event_id}</div>
              <div className="px-1.5 truncate">{taskCategory(e)}</div>
              <div className="px-1.5 truncate">{userOf(e)}</div>
              <div />
            </div>
          );
        })}

        {more && entries.length > 0 && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full flex items-center gap-2 px-2 text-left text-accent-text hover:bg-subtle disabled:text-t3"
            style={{ height: ROW_H + 4 }}
          >
            {loadingMore && <Spinner size={12} />}
            {loadingMore ? L('loading_more') : L('load_more')}
          </button>
        )}
      </div>

      {entries.length === 0 && (
        <div className="absolute inset-x-0 top-[22px] flex items-start justify-center pt-5 text-t2">
          {loading ? <Spinner size={18} /> : more ? (
            <button type="button" onClick={onLoadMore} className="text-accent-text hover:underline">{L('load_more')}</button>
          ) : (
            L('no_items')
          )}
        </div>
      )}
    </div>
  );
}
