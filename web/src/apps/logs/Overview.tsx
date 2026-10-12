import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '@/ui/controls';
import { fmtStamp } from '@/lib/format';
import type { Entry, Level, NodeId } from './types';
import { LevelIcon, NodeIcon } from './icons';
import { L, LEVELS, LOG_DEFS, cx, entryLogName, findNode, fmtNum, fmtSize, levelLabel, logBytes, nodeLabel } from './model';

function Band({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-[24px] flex items-center gap-1.5 px-2 bg-win border-y border-stroke text-left font-semibold text-t1 hover:bg-subtle"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3 pt-2">{children}</div>}
    </div>
  );
}

const th = 'h-[22px] px-2 text-left font-normal text-t2 border-b border-r border-stroke whitespace-nowrap';
const td = 'h-[21px] px-2 whitespace-nowrap';

const WINDOWS: NodeId[] = ['application', 'security', 'setup', 'system', 'forwarded'];

/**
 * "Overview and Summary" - Event Viewer (Local)'s landing page: the Summary of Administrative
 * Events (per level: totals from the server's counts, recent windows from the loaded page, each
 * level expandable into its event id / source groups) and the Log Summary.
 */
export function Overview({ entries, counts, refreshedAt, clock24, loading, onOpenLog }: {
  entries: Entry[];
  counts: Partial<Record<Level, number>>;
  refreshedAt: number;
  clock24: boolean;
  loading: boolean;
  onOpenLog: (id: NodeId) => void;
}) {
  const [openLevels, setOpenLevels] = useState<Set<Level>>(new Set());
  const now = refreshedAt ? refreshedAt / 1000 : Date.now() / 1000;

  const summary = useMemo(() => {
    const win = (list: Entry[]) => [3600, 86400, 604800].map(s => list.filter(e => e.ts >= now - s).length);
    return LEVELS.map(level => {
      const list = entries.filter(e => e.level === level);
      const groups = new Map<string, Entry[]>();
      for (const e of list) {
        const k = `${e.event_id}|${e.source}`;
        const g = groups.get(k);
        if (g) g.push(e);
        else groups.set(k, [e]);
      }
      return {
        level,
        windows: win(list),
        total: counts[level] ?? 0,
        groups: [...groups.values()]
          .map(g => ({ e: g[0], windows: win(g), n: g.length }))
          .sort((a, b) => b.n - a.n || a.e.event_id - b.e.event_id),
      };
    });
  }, [entries, counts, now]);

  const logRows = WINDOWS.map(id => {
    const def = LOG_DEFS[id]!;
    const list = def.empty ? [] : entries.filter(def.match);
    const modified = list.reduce((m, e) => Math.max(m, e.ts), 0);
    return { id, size: `${fmtSize(logBytes(list.length))}/${fmtSize(def.maxKb * 1024)}`, modified };
  });

  return (
    <div className="h-full overflow-auto os-scroll bg-layer text-[12px]">
      <div className="flex items-center gap-2 px-3 h-[34px] border-b border-stroke">
        <NodeIcon kind="root" />
        <span className="text-[14px] font-semibold text-t1">{L('overview_title')}</span>
        <span className="flex-1" />
        {loading ? <Spinner size={14} /> : refreshedAt > 0 && <span className="text-t3">{L('last_refreshed', fmtStamp(Math.floor(refreshedAt / 1000), clock24))}</span>}
      </div>

      <div className="pt-2">
        <Band title={L('overview_band')}>
          <p className="text-t2 max-w-[720px] pb-1">{L('overview_text')}</p>
        </Band>

        <Band title={L('summary_band')}>
          <div className="overflow-x-auto os-scroll pb-2">
            <table className="border-collapse min-w-full">
              <thead>
                <tr>
                  <th className={th}>{L('col_event_type')}</th>
                  <th className={th}>{L('col_event_id')}</th>
                  <th className={th}>{L('col_source')}</th>
                  <th className={th}>{L('col_log')}</th>
                  <th className={cx(th, 'text-right')}>{L('col_last_hour')}</th>
                  <th className={cx(th, 'text-right')}>{L('col_24h')}</th>
                  <th className={cx(th, 'text-right')}>{L('col_7d')}</th>
                  <th className={cx(th, 'text-right border-r-0')}>{L('col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(s => {
                  const open = openLevels.has(s.level);
                  return (
                    <Fragment key={s.level}>
                      <tr
                        className="hover:bg-subtle cursor-default"
                        onClick={() =>
                          setOpenLevels(prev => {
                            const n = new Set(prev);
                            if (n.has(s.level)) n.delete(s.level);
                            else n.add(s.level);
                            return n;
                          })
                        }
                      >
                        <td className={td}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 text-t2">{s.groups.length > 0 && (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}</span>
                            <LevelIcon level={s.level} />
                            {levelLabel(s.level)}
                          </span>
                        </td>
                        <td className={cx(td, 'text-t3')}>-</td>
                        <td className={cx(td, 'text-t3')}>-</td>
                        <td className={cx(td, 'text-t3')}>-</td>
                        {s.windows.map((n, i) => (
                          <td key={i} className={cx(td, 'text-right')}>{fmtNum(n)}</td>
                        ))}
                        <td className={cx(td, 'text-right font-semibold')}>{fmtNum(s.total)}</td>
                      </tr>
                      {open &&
                        s.groups.map(g => (
                          <tr key={`${g.e.event_id}|${g.e.source}`} className="hover:bg-subtle text-t2">
                            <td className={td} />
                            <td className={td}>{g.e.event_id}</td>
                            <td className={td}>{g.e.source}</td>
                            <td className={td}>{entryLogName(g.e)}</td>
                            {g.windows.map((n, i) => (
                              <td key={i} className={cx(td, 'text-right')}>{fmtNum(n)}</td>
                            ))}
                            <td className={cx(td, 'text-right')}>{fmtNum(g.n)}</td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Band>

        <Band title={L('log_summary_band')}>
          <div className="overflow-x-auto os-scroll pb-3">
            <table className="border-collapse min-w-full">
              <thead>
                <tr>
                  <th className={th}>{L('col_log_name')}</th>
                  <th className={th}>{L('col_size')}</th>
                  <th className={th}>{L('col_modified')}</th>
                  <th className={th}>{L('col_enabled')}</th>
                  <th className={cx(th, 'border-r-0')}>{L('col_retention')}</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map(r => (
                  <tr key={r.id} className="hover:bg-subtle cursor-default" onDoubleClick={() => onOpenLog(r.id)} title={L('open_hint')}>
                    <td className={td}>
                      <span className="inline-flex items-center gap-1.5">
                        <NodeIcon kind="log" />
                        {nodeLabel(r.id)}
                      </span>
                    </td>
                    <td className={td}>{r.size}</td>
                    <td className={td}>{r.modified ? fmtStamp(r.modified, clock24) : L('na')}</td>
                    <td className={td}>{L('enabled')}</td>
                    <td className={td}>{L('retention_overwrite')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Band>
      </div>
    </div>
  );
}

/** A folder node's contents (Windows Logs, Custom Views, …): Name / Type / Number of Events / Size. */
export function FolderView({ node, countOf, onOpen }: { node: NodeId; countOf: (id: NodeId) => { n: number; more: boolean }; onOpen: (id: NodeId) => void }) {
  const [sel, setSel] = useState<NodeId | null>(null);
  const kids = findNode(node)?.children ?? [];
  const typeOf = (id: NodeId): string => {
    const def = LOG_DEFS[id];
    if (!def) return L('type_folder');
    return L(def.kind === 'custom' ? 'type_custom' : def.kind === 'operational' ? 'type_operational' : 'type_admin');
  };
  return (
    <div className="h-full flex flex-col bg-layer text-[12px]">
      <div className="h-[26px] shrink-0 flex items-center gap-2 px-2 border-b border-stroke">
        <NodeIcon kind="folder" open />
        <span className="font-semibold text-t1">{nodeLabel(node)}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto os-scroll">
        {kids.length === 0 ? (
          <div className="pt-5 text-center text-t2">{L('no_items')}</div>
        ) : (
          <table className="border-collapse min-w-full">
            <thead className="sticky top-0 bg-layer">
              <tr>
                <th className={th}>{L('col_name')}</th>
                <th className={th}>{L('col_type')}</th>
                <th className={cx(th, 'text-right')}>{L('col_events')}</th>
                <th className={cx(th, 'border-r-0')}>{L('col_size')}</th>
              </tr>
            </thead>
            <tbody>
              {kids.map(k => {
                const def = LOG_DEFS[k.id];
                const c = def ? countOf(k.id) : null;
                const s = sel === k.id;
                return (
                  <tr
                    key={k.id}
                    onMouseDown={() => setSel(k.id)}
                    onDoubleClick={() => onOpen(k.id)}
                    className={cx('cursor-default', s ? 'bg-accent text-accent-on' : 'hover:bg-subtle')}
                  >
                    <td className={td}>
                      <span className="inline-flex items-center gap-1.5">
                        <NodeIcon kind={k.icon} />
                        {nodeLabel(k.id)}
                      </span>
                    </td>
                    <td className={td}>{typeOf(k.id)}</td>
                    <td className={cx(td, 'text-right')}>{c ? fmtNum(c.n) + (c.more ? '+' : '') : ''}</td>
                    <td className={td}>{c && def && def.kind !== 'custom' ? fmtSize(logBytes(c.n)) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
