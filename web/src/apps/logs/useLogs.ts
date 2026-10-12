import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import type { Entry, Level, ServerFilter } from './types';
import { normalizePage } from './model';

export interface LogsState {
  entries: Entry[];
  counts: Partial<Record<Level, number>>;
  sources: string[];
  pageSize: number;
  canClear: boolean;
  computer: { hostname: string; label: string } | null;
  /** The last page came back full: there may be older entries. */
  more: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  refreshedAt: number;
}

const INITIAL: LogsState = {
  entries: [],
  counts: {},
  sources: [],
  pageSize: 0,
  canClear: false,
  computer: null,
  more: false,
  loading: true,
  loadingMore: false,
  error: null,
  refreshedAt: 0,
};

/**
 * One server query (logs:page) and its pages. A new server filter drops the list and loads page 1;
 * loadMore() appends the page before the oldest loaded id. Late replies from a superseded query
 * are ignored (generation counter).
 */
export function useLogs(sf: ServerFilter) {
  const key = JSON.stringify(sf);
  const [st, setSt] = useState<LogsState>(INITIAL);
  const sfRef = useRef(sf);
  sfRef.current = sf;
  const gen = useRef(0);
  const stRef = useRef(st);
  stRef.current = st;

  const reload = useCallback(async (keep: boolean) => {
    const g = ++gen.current;
    setSt(s => (keep ? { ...s, loading: true, error: null } : { ...s, entries: [], more: false, loading: true, loadingMore: false, error: null }));
    const res = await rpc<unknown>('logs:page', { filter: { ...sfRef.current } });
    if (g !== gen.current) return;
    if (!res.ok) {
      setSt(s => ({ ...s, loading: false, error: res.error ?? t('ui.common.error') }));
      return;
    }
    const p = normalizePage(res.data);
    setSt({
      entries: p.entries,
      counts: p.counts,
      sources: p.sources,
      pageSize: p.pageSize,
      canClear: p.canClear,
      computer: p.computer,
      more: p.pageSize > 0 && p.entries.length >= p.pageSize,
      loading: false,
      loadingMore: false,
      error: null,
      refreshedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    void reload(false);
  }, [key, reload]);

  /** Fetch the next (older) page. Resolves to an error sentence, or null. */
  const loadMore = useCallback(async (): Promise<string | null> => {
    const cur = stRef.current;
    const last = cur.entries[cur.entries.length - 1];
    if (!last || cur.loadingMore || !cur.more) return null;
    const g = gen.current;
    setSt(s => ({ ...s, loadingMore: true }));
    const res = await rpc<unknown>('logs:page', { filter: { ...sfRef.current, beforeId: Math.trunc(last.id) } });
    if (g !== gen.current) return null;
    if (!res.ok) {
      setSt(s => ({ ...s, loadingMore: false }));
      return res.error ?? t('ui.common.error');
    }
    const p = normalizePage(res.data);
    setSt(s => {
      const seen = new Set(s.entries.map(e => e.id));
      return {
        ...s,
        entries: [...s.entries, ...p.entries.filter(e => !seen.has(e.id))],
        counts: p.counts,
        sources: p.sources,
        canClear: p.canClear,
        more: p.pageSize > 0 && p.entries.length >= p.pageSize,
        loadingMore: false,
      };
    });
    return null;
  }, []);

  /** logs:clear, then reload. Resolves to an error sentence, or null. */
  const clear = useCallback(async (): Promise<string | null> => {
    const res = await rpc('logs:clear');
    if (!res.ok) return res.error ?? t('ui.common.error');
    await reload(false);
    return null;
  }, [reload]);

  return { ...st, reload, loadMore, clear };
}
