import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from 'react';
import {
  ArrowLeft, ArrowRight, Copy, Eraser, Eye, FileText, Filter, FolderInput, FolderOpen, HelpCircle, ListFilter, Monitor, PanelLeft, PanelRight,
  Printer, RotateCw, Save, Search, Settings2, Trash2, X,
} from 'lucide-react';
import { Button, Dialog, IconButton, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { useOS } from '@/store/os';
import { t, useI18n } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import type { AppProps } from '../registry';
import type { Entry, MenuItem, NodeId, Sort, UserFilter } from './types';
import {
  EMPTY_FILTER, L, LOG_DEFS, applyFilter, copyText, cx, describeFilter, eventText, filterActive, fmtNum, levelLabel, nodeLabel, parentOf,
  serverFilterFor, sortEntries, taskCategory, userOf,
} from './model';
import { useLogs } from './useLogs';
import { MenuBar, MenuList, useOutside } from './Menus';
import { ConsoleTree } from './Tree';
import { EventGrid } from './EventGrid';
import { EventDetails } from './EventDetails';
import { ActionsPane, type ActionDef } from './ActionsPane';
import { FolderView, Overview } from './Overview';
import { AboutDialog, EventPropertiesDialog, FilterDialog, LogPropertiesDialog } from './Dialogs';
import { NodeIcon } from './icons';
import { PrintSlot, askPrint, usePrinting } from '@/os/print/PrintDialog';

type DialogState =
  | { kind: 'clear' }
  | { kind: 'filter'; custom: boolean }
  | { kind: 'event'; id: number }
  | { kind: 'logprops' }
  | { kind: 'about' }
  | { kind: 'notice'; title: string; body: string }
  | null;

function useSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 1000, h: 560 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setSize(s => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function ToolButton({ title, onClick, disabled, active, children }: { title: string; onClick?: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <IconButton title={title} onClick={onClick} disabled={disabled} className={cx('!w-7 !h-7', active && 'bg-subtle')}>
      {children}
    </IconButton>
  );
}

const Sep = () => <span className="mx-1 h-4 w-px bg-stroke-strong" />;

const matches = (e: Entry, q: string): boolean =>
  e.message.toLowerCase().includes(q) ||
  e.source.toLowerCase().includes(q) ||
  String(e.event_id).includes(q) ||
  userOf(e).toLowerCase().includes(q) ||
  taskCategory(e).toLowerCase().includes(q) ||
  levelLabel(e.level).toLowerCase().includes(q);

/**
 * Event Viewer - this computer's System Logs as Windows' MMC console: menu bar + toolbar, the
 * console tree (left), the selected node (center: Overview and Summary, a folder listing, or a log's
 * event grid over its General/Details preview pane) and the Actions pane (right). Logs are carved
 * out of the one server log client-side by source (Security / System = Eventlog+Shell / Application).
 */
export default function EventViewer({ win }: AppProps) {
  useI18n();
  const payload = useOS(s => s.payload);
  const clock24 = payload?.desktop.clock24 ?? false;

  const rootRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const statusTimer = useRef(0);
  const root = useSize(rootRef);
  const center = useSize(centerRef);

  const [node, setNode] = useState<NodeId>('root');
  const [expanded, setExpanded] = useState<Set<NodeId>>(() => new Set<NodeId>(['root', 'windows']));
  const [filter, setFilter] = useState<UserFilter>(EMPTY_FILTER);
  const [selId, setSelId] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>({ key: 'ts', dir: 'desc' });
  const [showTree, setShowTree] = useState(true);
  const [actionsPref, setActionsPref] = useState<boolean | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [split, setSplit] = useState(0.44);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [find, setFind] = useState({ open: false, text: '' });
  const findRef = useExitFx('pop-out');
  const [status, setStatus] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ right: number; top: number; items: MenuItem[] } | null>(null);
  useOutside(menuRef, menu !== null, () => setMenu(null));

  const def = LOG_DEFS[node];
  const sf = useMemo(() => serverFilterFor(node, filter), [node, filter]);
  const logs = useLogs(sf);
  const hostname = logs.computer?.hostname || payload?.computer.hostname || '';
  const filtered = filterActive(filter);
  const visible = useMemo(() => sortEntries(applyFilter(logs.entries, node, filter), sort), [logs.entries, node, filter, sort]);
  const selected = selId !== null ? visible.find(e => e.id === selId) ?? null : null;
  const canClearHere = logs.canClear && !!def?.clearable;
  const printing = usePrinting();
  /** Print the log as it is listed: the server reads it again through the filter that is on. */
  const printLog = () => askPrint('logs', { source: 'logs', title: t('ui.print.log_title', hostname), data: { filter: { ...sf } } });

  // The log's unfiltered size, remembered while a filter narrows the list ("Number of events").
  const totals = useRef<Partial<Record<NodeId, { n: number; more: boolean }>>>({});
  if (def && !filtered && !logs.loading && !logs.error) totals.current[node] = { n: visible.length, more: logs.more && !def.empty };
  const total = def ? totals.current[node] ?? { n: visible.length, more: logs.more && !def.empty } : null;

  // Like Windows, opening a log selects its newest event so the preview pane has something to show.
  useEffect(() => {
    if (!selected && visible.length && def) setSelId(visible[0].id);
  }, [selected, visible, def]);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(''), 4500);
  }, []);
  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  const selectNode = (id: NodeId) => {
    if (id === node) return;
    setNode(id);
    setFilter(EMPTY_FILTER);
    setSelId(null);
    setFind(f => ({ ...f, open: false }));
    setExpanded(prev => {
      const n = new Set(prev);
      for (let p = parentOf(id); p; p = parentOf(p.id)) n.add(p.id);
      return n;
    });
  };

  const toggleNode = (id: NodeId, open?: boolean) =>
    setExpanded(prev => {
      const n = new Set(prev);
      if (open ?? !n.has(id)) n.add(id);
      else n.delete(id);
      return n;
    });

  const refresh = () => {
    void logs.reload(true);
  };
  const openFilter = (custom = false) => {
    if (def) setDialog({ kind: 'filter', custom });
  };
  const notice = (title: string, body = L('not_available')) => setDialog({ kind: 'notice', title, body });
  const openClear = () => {
    setClearError(null);
    setDialog({ kind: 'clear' });
  };
  const openFind = () => {
    if (def) setFind(f => ({ ...f, open: true }));
  };
  const copyEvent = async (e: Entry) => flash((await copyText(eventText(e, hostname, clock24))) ? L('copied') : L('copy_failed'));
  const loadMore = async () => {
    const err = await logs.loadMore();
    if (err) flash(err);
  };
  const exit = () => useOS.getState().close(win.id);

  const findNext = () => {
    const q = find.text.trim().toLowerCase();
    if (!q || !visible.length) return;
    const start = selected ? visible.indexOf(selected) : -1;
    for (let k = 1; k <= visible.length; k++) {
      const idx = (start + k) % visible.length;
      if (matches(visible[idx], q)) {
        setSelId(visible[idx].id);
        if (start >= 0 && idx <= start) flash(L('find_wrapped'));
        return;
      }
    }
    flash(L('find_none', find.text.trim()));
  };

  const doClear = async () => {
    setClearing(true);
    setClearError(null);
    const err = await logs.clear();
    setClearing(false);
    if (err) {
      setClearError(err);
      return;
    }
    setDialog(null);
    setSelId(null);
    flash(L('cleared_status', nodeLabel(node)));
  };

  const actionsVisible = actionsPref ?? root.w >= 860;
  const narrow = root.w < 860;
  const treeW = narrow ? 176 : 220;
  const actW = narrow ? 188 : 220;

  // ── Menus / actions ──────────────────────────────────────────────────────────────────────
  const viewItems: MenuItem[] = [
    { label: L('m_console_tree'), checked: showTree, onClick: () => setShowTree(v => !v) },
    { label: L('m_action_pane'), checked: actionsVisible, onClick: () => setActionsPref(!actionsVisible) },
    { label: L('m_preview_pane'), checked: showPreview, disabled: !def, onClick: () => setShowPreview(v => !v) },
    { separator: true },
    { label: L('m_customize'), disabled: true },
  ];
  const helpItems: MenuItem[] = [
    { label: L('m_help_topics'), onClick: () => notice(L('m_help_topics')) },
    { separator: true },
    { label: L('m_about'), onClick: () => setDialog({ kind: 'about' }) },
  ];
  const actionItems: MenuItem[] = [
    { label: L('a_open_saved'), onClick: () => notice(L('a_open_saved')) },
    { label: L('a_create_view'), disabled: !def, onClick: () => openFilter(true) },
    { label: L('a_import_view'), disabled: true },
    { separator: true },
    ...(canClearHere ? [{ label: L('a_clear_log'), onClick: openClear }] : []),
    { label: L('a_filter'), disabled: !def, onClick: () => openFilter() },
    ...(filtered ? [{ label: L('a_clear_filter'), onClick: () => setFilter(EMPTY_FILTER) }] : []),
    { label: L('a_properties'), disabled: !def, onClick: () => setDialog({ kind: 'logprops' }) },
    { label: L('a_find'), disabled: !def, onClick: openFind },
    ...(printing && def ? [{ label: L('a_print'), onClick: printLog }] : []),
    { separator: true },
    { label: L('a_refresh'), onClick: refresh },
    { separator: true },
    { label: L('a_help'), onClick: () => setDialog({ kind: 'about' }) },
  ];
  const fileItems: MenuItem[] = [
    { label: L('a_open_saved'), onClick: () => notice(L('a_open_saved')) },
    { label: L('a_import_view'), disabled: true },
    { separator: true },
    { label: L('m_exit'), onClick: exit },
  ];

  const nodeActions: ActionDef[] = def
    ? [
        { key: 'open', label: L('a_open_saved'), icon: <FolderOpen size={14} />, onClick: () => notice(L('a_open_saved')) },
        { key: 'create', label: L('a_create_view'), icon: <ListFilter size={14} />, onClick: () => openFilter(true) },
        { key: 'import', label: L('a_import_view'), icon: <FolderInput size={14} />, disabled: true },
        ...(canClearHere ? [{ key: 'clear', label: L('a_clear_log'), icon: <Trash2 size={14} />, onClick: openClear }] : []),
        { key: 'filter', label: L('a_filter'), icon: <Filter size={14} />, onClick: () => openFilter() },
        ...(filtered ? [{ key: 'unfilter', label: L('a_clear_filter'), icon: <Eraser size={14} />, onClick: () => setFilter(EMPTY_FILTER) }] : []),
        { key: 'props', label: L('a_properties'), icon: <Settings2 size={14} />, onClick: () => setDialog({ kind: 'logprops' }) },
        { key: 'find', label: L('a_find'), icon: <Search size={14} />, onClick: openFind },
        ...(printing ? [{ key: 'print', label: L('a_print'), icon: <Printer size={14} />, onClick: printLog }] : []),
        { key: 'refresh', label: L('a_refresh'), icon: <RotateCw size={14} />, onClick: refresh },
        { key: 'view', label: L('a_view'), icon: <Eye size={14} />, submenu: viewItems },
        { key: 'help', label: L('a_help'), icon: <HelpCircle size={14} />, submenu: helpItems },
      ]
    : [
        { key: 'open', label: L('a_open_saved'), icon: <FolderOpen size={14} />, onClick: () => notice(L('a_open_saved')) },
        { key: 'create', label: L('a_create_view'), icon: <ListFilter size={14} />, disabled: true },
        { key: 'import', label: L('a_import_view'), icon: <FolderInput size={14} />, disabled: true },
        { key: 'connect', label: L('a_connect'), icon: <Monitor size={14} />, onClick: () => notice(L('a_connect'), L('access_denied')) },
        { key: 'refresh', label: L('a_refresh'), icon: <RotateCw size={14} />, onClick: refresh },
        { key: 'view', label: L('a_view'), icon: <Eye size={14} />, submenu: viewItems },
        { key: 'help', label: L('a_help'), icon: <HelpCircle size={14} />, submenu: helpItems },
      ];

  const eventActions: ActionDef[] = selected
    ? [
        { key: 'evprops', label: L('a_event_props'), icon: <FileText size={14} />, onClick: () => setDialog({ kind: 'event', id: selected.id }) },
        { key: 'copy', label: L('a_copy'), icon: <Copy size={14} />, onClick: () => void copyEvent(selected) },
        { key: 'save', label: L('a_save_selected'), icon: <Save size={14} />, onClick: () => notice(L('a_save_selected')) },
        { key: 'refresh', label: L('a_refresh'), icon: <RotateCw size={14} />, onClick: refresh },
        { key: 'help', label: L('a_help'), icon: <HelpCircle size={14} />, submenu: helpItems },
      ]
    : [];

  const openSubmenu = (el: HTMLElement, items: MenuItem[]) => {
    const host = rootRef.current;
    if (!host) return;
    const r = el.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const height = items.reduce((s, i) => s + (i.separator ? 9 : 26), 8);
    setMenu({ right: Math.max(4, h.right - r.left + 2), top: Math.max(4, Math.min(r.top - h.top, h.height - height - 4)), items });
  };

  // ── Splitter (grid / preview pane) ───────────────────────────────────────────────────────
  const dragSplit = useRef(false);
  const onSplitMove = (e: RPointerEvent) => {
    const el = centerRef.current;
    if (!dragSplit.current || !el) return;
    const r = el.getBoundingClientRect();
    setSplit(Math.max(0.18, Math.min(0.78, (r.bottom - e.clientY) / r.height)));
  };
  const detailsH = Math.round(Math.max(120, Math.min(center.h - 110, split * center.h)));

  const onRootKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (menu) setMenu(null);
      else if (dialog) setDialog(null);
      else if (find.open) setFind(f => ({ ...f, open: false }));
      else return;
      e.stopPropagation();
    } else if (e.key === 'F5') {
      e.preventDefault();
      refresh();
    } else if ((e.key === 'f' || e.key === 'F') && e.ctrlKey && def) {
      e.preventDefault();
      openFind();
    }
  };

  // ── Center pane ──────────────────────────────────────────────────────────────────────────
  let body: ReactNode;
  if (node === 'root') {
    body = <Overview entries={logs.entries} counts={logs.counts} refreshedAt={logs.refreshedAt} clock24={clock24} loading={logs.loading} onOpenLog={selectNode} />;
  } else if (!def) {
    body = (
      <FolderView
        node={node}
        onOpen={selectNode}
        countOf={id => {
          const d = LOG_DEFS[id];
          return !d || d.empty ? { n: 0, more: false } : { n: logs.entries.filter(d.match).length, more: logs.more };
        }}
      />
    );
  } else {
    const count = total ? fmtNum(total.n) + (total.more ? '+' : '') : '0';
    body = (
      <>
        <div className="shrink-0 bg-layer border-b border-stroke">
          <div className="h-[26px] flex items-center gap-2 px-2 min-w-0">
            <NodeIcon kind={def.kind === 'custom' ? 'custom' : 'log'} />
            <span className="font-semibold text-t1 shrink-0">{nodeLabel(node)}</span>
            <span className="ml-4 text-t2 truncate">{L('num_events', count)}</span>
            {logs.loading && <Spinner size={12} className="shrink-0" />}
          </div>
          {filtered && (
            <div className="min-h-[22px] flex items-center gap-1.5 px-2 py-[3px] border-t border-stroke bg-subtle text-t1 min-w-0">
              <Filter size={12} className="shrink-0 text-accent-text" />
              <span className="truncate" title={describeFilter(node, filter)}>
                {L('filtered', describeFilter(node, filter), fmtNum(visible.length) + (logs.more ? '+' : ''))}
              </span>
            </div>
          )}
        </div>
        <div className="relative flex-1 min-h-0">
          <EventGrid
            entries={visible}
            selId={selected?.id ?? null}
            onSelect={setSelId}
            onOpen={id => setDialog({ kind: 'event', id })}
            sort={sort}
            onSort={setSort}
            clock24={clock24}
            loading={logs.loading}
            more={logs.more && !def.empty}
            loadingMore={logs.loadingMore}
            onLoadMore={() => void loadMore()}
          />
          {find.open && (
            <div ref={findRef} className="absolute right-3 top-7 z-30 w-[min(380px,calc(100%-24px))] flex items-center gap-1.5 p-2 rounded-win acrylic shadow-flyout pop-in origin-top-right">
              <Search size={14} className="shrink-0 text-t2" />
              <TextInput
                autoFocus
                value={find.text}
                placeholder={L('find_what')}
                onChange={e => setFind({ open: true, text: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') findNext();
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setFind(f => ({ ...f, open: false }));
                  }
                }}
                className="!h-7 !text-[12px]"
              />
              <Button compact onClick={findNext} disabled={!find.text.trim()} className="!text-[12px]">{L('find_next')}</Button>
              <IconButton title={t('ui.common.close')} onClick={() => setFind(f => ({ ...f, open: false }))} className="!w-7 !h-7 shrink-0">
                <X size={14} />
              </IconButton>
            </div>
          )}
        </div>
        {showPreview && (
          <>
            <div
              className="h-[5px] shrink-0 cursor-row-resize bg-win border-y border-stroke"
              onPointerDown={e => {
                dragSplit.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={onSplitMove}
              onPointerUp={() => (dragSplit.current = false)}
              onPointerCancel={() => (dragSplit.current = false)}
            />
            <div className="shrink-0 flex flex-col min-h-0 bg-layer" style={{ height: detailsH }}>
              <div className="h-[24px] shrink-0 flex items-center gap-2 pl-2 pr-1 bg-win border-b border-stroke">
                <span className="flex-1 truncate font-semibold text-t1">{selected ? L('event_title', selected.event_id, selected.source) : ''}</span>
                <button type="button" title={L('close_preview')} onClick={() => setShowPreview(false)} className="w-5 h-5 flex items-center justify-center rounded-[3px] text-t2 hover:bg-subtle hover:text-t1">
                  <X size={12} />
                </button>
              </div>
              <div className="flex-1 min-h-0">{selected && <EventDetails entry={selected} hostname={hostname} clock24={clock24} />}</div>
            </div>
          </>
        )}
      </>
    );
  }

  const evDialog = dialog?.kind === 'event' ? visible.findIndex(e => e.id === dialog.id) : -1;

  return (
    <div ref={rootRef} className="relative h-full w-full flex flex-col bg-win text-t1 text-[12px] select-none" onKeyDown={onRootKey}>
      <PrintSlot app="logs" />
      <MenuBar
        menus={[
          { key: 'file', label: L('m_file'), items: fileItems },
          { key: 'action', label: L('m_action'), items: actionItems },
          { key: 'view', label: L('m_view'), items: viewItems },
          { key: 'help', label: L('m_help'), items: helpItems },
        ]}
      />
      <div className="h-[30px] shrink-0 flex items-center gap-0.5 px-1 bg-win border-b border-stroke">
        <ToolButton title={L('t_back')} disabled><ArrowLeft size={15} /></ToolButton>
        <ToolButton title={L('t_forward')} disabled><ArrowRight size={15} /></ToolButton>
        <Sep />
        <ToolButton title={L('t_tree')} active={showTree} onClick={() => setShowTree(v => !v)}><PanelLeft size={15} /></ToolButton>
        <Sep />
        <ToolButton title={L('a_refresh')} onClick={refresh}><RotateCw size={15} /></ToolButton>
        <ToolButton title={L('a_filter')} disabled={!def} onClick={() => openFilter()}><Filter size={15} /></ToolButton>
        <ToolButton title={L('a_properties')} disabled={!def} onClick={() => setDialog({ kind: 'logprops' })}><Settings2 size={15} /></ToolButton>
        <Sep />
        <ToolButton title={L('a_help')} onClick={() => setDialog({ kind: 'about' })}><HelpCircle size={15} /></ToolButton>
        <Sep />
        <ToolButton title={L('t_actions')} active={actionsVisible} onClick={() => setActionsPref(!actionsVisible)}><PanelRight size={15} /></ToolButton>
      </div>

      <div className="flex-1 min-h-0 flex">
        {showTree && (
          <div className="shrink-0 bg-layer border-r border-stroke fade-in" style={{ width: treeW }}>
            <ConsoleTree node={node} onSelect={selectNode} expanded={expanded} onToggle={toggleNode} />
          </div>
        )}
        <div ref={centerRef} className="relative flex-1 min-w-0 flex flex-col bg-layer">
          {logs.error && (
            <div className="shrink-0 p-2">
              <InfoBar severity="error" title={L('load_failed')}>
                {logs.error}{' '}
                <button type="button" onClick={refresh} className="text-accent-text hover:underline">{t('ui.common.retry')}</button>
              </InfoBar>
            </div>
          )}
          {body}
        </div>
        {actionsVisible && (
          <div className="shrink-0 border-l border-stroke fade-in" style={{ width: actW }}>
            <ActionsPane
              title={nodeLabel(node)}
              items={nodeActions}
              eventTitle={selected && def ? L('event_title', selected.event_id, selected.source) : null}
              eventItems={eventActions}
              onSubmenu={openSubmenu}
            />
          </div>
        )}
      </div>

      <div className="h-[22px] shrink-0 flex items-center px-2 border-t border-stroke bg-win text-[11px] text-t2 truncate">
        {status || (logs.loading ? t('ui.common.loading') : '')}
      </div>

      {/* The holder stays mounted so the menu's way out has somewhere to play. */}
      <div ref={menuRef}>{menu && <MenuList items={menu.items} onClose={() => setMenu(null)} style={{ right: menu.right, top: menu.top }} />}</div>

      {dialog?.kind === 'clear' && (
        <Dialog
          title={L('clear_title', nodeLabel(node))}
          onClose={() => !clearing && setDialog(null)}
          actions={
            <>
              <Button variant="danger" onClick={() => void doClear()} disabled={clearing}>{clearing ? L('clearing') : L('clear')}</Button>
              <Button onClick={() => setDialog(null)} disabled={clearing}>{t('ui.common.cancel')}</Button>
            </>
          }
        >
          <p>{L('clear_body', hostname)}</p>
          <p className="mt-2">{L('clear_body_1102')}</p>
          {clearError && (
            <div className="mt-3">
              <InfoBar severity="error">{clearError}</InfoBar>
            </div>
          )}
        </Dialog>
      )}

      {dialog?.kind === 'filter' && (
        <FilterDialog
          title={dialog.custom ? L('create_view_title') : L('filter_title')}
          node={node}
          initial={filter}
          sources={logs.sources}
          onClose={() => setDialog(null)}
          onApply={f => {
            setFilter(f);
            setSelId(null);
            setDialog(null);
          }}
        />
      )}

      {dialog?.kind === 'logprops' && (
        <LogPropertiesDialog node={node} entries={def ? logs.entries.filter(def.match) : []} count={total?.n ?? 0} clock24={clock24} onClose={() => setDialog(null)} />
      )}

      {dialog?.kind === 'event' && evDialog >= 0 && (
        <EventPropertiesDialog
          entry={visible[evDialog]}
          hostname={hostname}
          clock24={clock24}
          onPrev={evDialog > 0 ? () => {
            const id = visible[evDialog - 1].id;
            setSelId(id);
            setDialog({ kind: 'event', id });
          } : null}
          onNext={evDialog < visible.length - 1 ? () => {
            const id = visible[evDialog + 1].id;
            setSelId(id);
            setDialog({ kind: 'event', id });
          } : null}
          onCopy={() => void copyEvent(visible[evDialog])}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'about' && (
        <AboutDialog osName={payload?.desktop.osName ?? 'SD OS'} osBuild={payload?.desktop.osBuild ?? ''} onClose={() => setDialog(null)} />
      )}

      {dialog?.kind === 'notice' && (
        <Dialog title={dialog.title} onClose={() => setDialog(null)} actions={<Button variant="accent" onClick={() => setDialog(null)}>{t('ui.common.ok')}</Button>}>
          {dialog.body}
        </Dialog>
      )}
    </div>
  );
}
