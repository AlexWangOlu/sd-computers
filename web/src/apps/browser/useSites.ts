import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import type { Network } from './types';
import { asNetwork } from './model';

export interface SitesState {
  net: Network | null;
  loading: boolean;
  error: string | null;
}

/**
 * The network (browser:sites): loaded when the window opens, and again on Reload. A reload that
 * fails keeps the pages already here and only reports the error. Late replies from a request that
 * has been superseded are ignored (generation counter).
 */
export function useSites() {
  const [st, setSt] = useState<SitesState>({ net: null, loading: true, error: null });
  const gen = useRef(0);

  const reload = useCallback(async () => {
    const g = ++gen.current;
    setSt(s => ({ ...s, loading: true, error: null }));
    const res = await rpc<unknown>('browser:sites');
    if (g !== gen.current) return;
    if (!res.ok) {
      setSt(s => ({ ...s, loading: false, error: res.error ?? t('ui.common.error') }));
      return;
    }
    setSt({ net: asNetwork(res.data), loading: false, error: null });
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      gen.current++;
    };
  }, [reload]);

  return { ...st, reload };
}
