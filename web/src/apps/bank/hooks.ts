import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';

export interface Query<T> {
  data: T | null;
  error: string | null;
  /** True during ANY fetch - the first one (no data yet) and quiet refetches alike. */
  loading: boolean;
  reload: () => Promise<boolean>;
}

/**
 * A read endpoint as state. Refetches keep the previous data on screen (a failed refetch only sets
 * `error`), and a stale reply that lands after a newer request is dropped. `normalize` must be a
 * stable (module-level) function.
 */
export function useQuery<T>(endpoint: string, normalize: (raw: unknown) => T): Query<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const reload = useCallback(async (): Promise<boolean> => {
    const n = ++seq.current;
    setLoading(true);
    const res = await rpc<unknown>(endpoint);
    if (n !== seq.current) return res.ok;
    setLoading(false);
    if (res.ok) {
      setData(normalize(res.data));
      setError(null);
      return true;
    }
    setError(res.error || t('ui.common.error'));
    return false;
  }, [endpoint, normalize]);

  return { data, error, loading, reload };
}

/** Live content-box width of an element (0 until first measured). */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // observe() always delivers an initial entry, so no separate first measurement is needed.
    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(Math.round(cr.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
