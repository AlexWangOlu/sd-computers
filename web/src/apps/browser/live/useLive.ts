import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';

// How a live page gets what is on it. A page is drawn afresh every time the tab goes somewhere
// (the Browser keys it by address), so what an endpoint last answered is kept here, outside any
// one page: going from the front page to a story and back shows what was there at once, and asks
// again behind it. While a page is being looked at it asks again every so often by itself - the
// city moves, and nothing pushes to a desk.

/** Seconds between two looks at a page that is on screen. */
const REFRESH_S = 30;

const kept = new Map<string, unknown>();

export interface Live<T> {
  data: T | null;
  /** Why the last ask failed, while there is nothing to show instead. */
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** Put what an action answered straight on the page (and in what is kept), without asking again. */
  put: (next: T) => void;
}

/**
 * @param endpoint a web:* endpoint
 * @param payload what it is asked with (part of what the answer is kept under)
 * @param read the reply's reader (src/apps/browser/live/data.ts) - the same function every render
 * @param shown whether this page is the one being looked at: only then does it keep itself fresh
 * @param every seconds between looks while shown
 */
export function useLive<T>(endpoint: string, payload: Record<string, unknown> | undefined, read: (raw: unknown) => T, shown: boolean, every = REFRESH_S): Live<T> {
  const key = `${endpoint}:${JSON.stringify(payload ?? {})}`;
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>(() => ({
    data: kept.has(key) ? (kept.get(key) as T) : null,
    error: null,
    loading: true,
  }));
  const gen = useRef(0);
  const asked = useRef(payload);
  asked.current = payload;

  const reload = useCallback(async () => {
    const g = ++gen.current;
    setState(s => ({ ...s, loading: true }));
    const res = await rpc<unknown>(endpoint, asked.current);
    if (g !== gen.current) return;
    if (!res.ok) {
      // (what is on the page stays on it: a look that failed is only an error when there is nothing else)
      setState(s => ({ data: s.data, loading: false, error: s.data === null ? res.error ?? t('ui.common.error') : null }));
      return;
    }
    const data = read(res.data);
    kept.set(key, data);
    setState({ data, error: null, loading: false });
  }, [endpoint, key, read]);

  useEffect(() => {
    void reload();
    return () => {
      gen.current++;
    };
  }, [reload]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setInterval(() => void reload(), every * 1000);
    return () => window.clearInterval(timer);
  }, [shown, every, reload]);

  const put = useCallback(
    (next: T) => {
      gen.current++; // (an answer still on its way is older than this)
      kept.set(key, next);
      setState({ data: next, error: null, loading: false });
    },
    [key],
  );

  return { ...state, reload, put };
}

/** Forget what an endpoint answered, whatever it was asked with: something was just changed there. */
export function forget(endpoint: string): void {
  for (const k of kept.keys()) {
    if (k.startsWith(`${endpoint}:`)) kept.delete(k);
  }
}

/** One action (save, delete, send): its reply, as the page needs it - the data, or why not. */
export async function act<T = unknown>(endpoint: string, payload: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await rpc<T>(endpoint, payload);
  return res.ok ? { ok: true, data: res.data as T } : { ok: false, error: res.error ?? t('ui.common.error') };
}
