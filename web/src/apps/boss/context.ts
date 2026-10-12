import { createContext, useContext } from 'react';
import type { Overview, Page } from './types';

export interface BossCtx {
  /** Always loaded while a page is mounted (the root shows a spinner/error until it is). */
  overview: Overview;
  overviewLoading: boolean;
  /** Quietly refetch boss:overview (after every mutation). */
  reloadOverview: () => Promise<boolean>;
  /** Patch the society balance from a deposit/withdraw reply before the refetch lands. */
  setBalance: (balance: number) => void;
  go: (page: Page) => void;
  clock24: boolean;
}

export const BossContext = createContext<BossCtx | null>(null);

export function useBoss(): BossCtx {
  const ctx = useContext(BossContext);
  if (!ctx) throw new Error('useBoss outside BusinessManager');
  return ctx;
}
