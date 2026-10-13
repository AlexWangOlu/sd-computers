import { useEffect, useMemo, type ReactNode } from 'react';
import { Banknote, Landmark, ReceiptText, RefreshCw } from 'lucide-react';
import { Button, InfoBar, Spinner } from '@/ui/controls';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtMoney } from '@/lib/format';
import type { AppProps } from '../registry';
import BalanceChart, { buildSeries } from './BalanceChart';
import { useQuery } from './hooks';
import { Figure, Panel, cx } from './parts';
import Statement from './Statement';
import type { Overview } from './types';
import { fmtBalance, fmtSigned, normOverview, txDelta } from './util';

/**
 * Bank: the character's own money on one page, to look at. Both balances, what came in and went
 * out over the listed transactions, the balance drawn over time and the statement itself. It only
 * ever reads (bank:overview): nothing here moves money.
 */
export default function Bank(_props: AppProps) {
  const query = useQuery('bank:overview', normOverview);
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const userName = useOS(s => s.payload?.user.name ?? '');

  const { reload } = query;
  useEffect(() => {
    void reload();
  }, [reload]);

  const ov = query.data;

  return (
    <div className="relative h-full w-full flex flex-col bg-win text-t1 overflow-hidden">
      <main className="flex-1 min-h-0 bg-layer border-t border-stroke overflow-y-auto os-scroll">
        {ov ? (
          <Page ov={ov} holder={ov.name || userName} error={query.error} loading={query.loading} onReload={() => void reload()} clock24={clock24} />
        ) : query.error ? (
          <div className="p-6 flex flex-col items-start gap-3 max-w-[560px]">
            <div className="w-full">
              <InfoBar severity="error" title={t('ui.bank.load_failed')}>
                {query.error}
              </InfoBar>
            </div>
            <Button icon={query.loading ? <Spinner size={14} /> : <RefreshCw size={16} />} onClick={() => void reload()} disabled={query.loading}>
              {t('ui.common.retry')}
            </Button>
          </div>
        ) : (
          <div className="h-full min-h-[200px] w-full flex flex-col items-center justify-center gap-3 text-caption text-t2">
            <Spinner size={28} />
            {t('ui.common.loading')}
          </div>
        )}
      </main>
    </div>
  );
}

function Page({ ov, holder, error, loading, onReload, clock24 }: { ov: Overview; holder: string; error: string | null; loading: boolean; onReload: () => void; clock24: boolean }) {
  const txs = ov.transactions;
  const points = useMemo(() => buildSeries(txs, ov.bank), [txs, ov.bank]);
  const [moneyIn, moneyOut] = useMemo(() => {
    let i = 0;
    let o = 0;
    for (const tx of txs) {
      const d = txDelta(tx);
      if (d > 0) i += d;
      else o -= d;
    }
    return [i, o];
  }, [txs]);
  const change = points.length >= 2 ? points[points.length - 1].v - points[0].v : 0;

  return (
    <div className="px-6 pt-5 pb-8 max-w-[1400px] mx-auto page-in">
      <header className="flex items-end justify-between gap-x-4 gap-y-2 flex-wrap mb-5">
        <div className="min-w-0">
          <h1 className="font-display text-title font-semibold text-t1 truncate">{holder || t('ui.bank.account')}</h1>
          {holder && <div className="text-body text-t2 mt-0.5">{t('ui.bank.account')}</div>}
        </div>
        <Button icon={<RefreshCw size={16} className={loading ? 'spin' : ''} />} onClick={onReload} disabled={loading}>
          {t('ui.common.refresh')}
        </Button>
      </header>

      {error && (
        <div className="mb-4">
          <InfoBar severity="error" title={t('ui.bank.refresh_failed')}>
            {error}{' '}
            <button type="button" className="text-accent-text hover:underline ml-1" onClick={onReload}>
              {t('ui.common.retry')}
            </button>
          </InfoBar>
        </div>
      )}

      <section className="ctl-card rounded-win bg-card border border-stroke shadow-card p-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4 min-w-0">
          <Balance icon={<Landmark size={16} />} label={t('ui.bank.bank_balance')} value={fmtBalance(ov.bank)} caption={t('ui.bank.bank_caption')} hero />
          <Balance icon={<Banknote size={16} />} label={t('ui.bank.cash')} value={fmtBalance(ov.cash)} caption={t('ui.bank.cash_caption')} />
        </div>
        {txs.length > 0 && (
          <div className="min-w-0">
            <div className="flex gap-8">
              <Figure label={t('ui.bank.money_in')} value={fmtSigned(moneyIn)} tone="text-success" />
              <Figure label={t('ui.bank.money_out')} value={(moneyOut > 0 ? '−' : '') + fmtMoney(moneyOut)} tone="text-critical" />
            </div>
            <div className="text-caption text-t3">{t('ui.bank.totals_caption')}</div>
          </div>
        )}
      </section>

      {ov.source === 'none' ? (
        <Panel className="mt-3" bodyClass="p-5">
          <div className="flex items-center gap-4">
            <span className="w-10 h-10 rounded-full bg-subtle border border-stroke flex items-center justify-center text-t2 shrink-0">
              <ReceiptText size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-body font-semibold text-t1">{t('ui.bank.no_statement_title')}</div>
              <div className="text-caption text-t2">{t('ui.bank.no_statement_body')}</div>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          {points.length >= 2 && (
            <Panel
              className="mt-3"
              title={t('ui.bank.chart_title')}
              caption={t('ui.bank.chart_caption')}
              actions={
                change !== 0 ? (
                  <span title={t('ui.bank.chart_change')} className={cx('text-body font-semibold tabular-nums', change < 0 ? 'text-critical' : 'text-success')}>
                    {fmtSigned(change)}
                  </span>
                ) : undefined
              }
              bodyClass="px-3 pb-3 pt-2"
            >
              <BalanceChart points={points} clock24={clock24} />
            </Panel>
          )}
          <Statement txs={txs} source={ov.source} clock24={clock24} />
        </>
      )}
    </div>
  );
}

/** One of the two balances: icon and label, the figure, a line saying what it is. */
function Balance({ icon, label, value, caption, hero }: { icon: ReactNode; label: string; value: string; caption: string; hero?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-body text-t2">
        <span className="shrink-0 text-accent-text">{icon}</span>
        {label}
      </div>
      <div className={cx('font-display font-semibold tabular-nums mt-1 truncate text-t1', hero ? 'text-hero' : 'text-title')}>{value}</div>
      <div className="text-caption text-t3">{caption}</div>
    </div>
  );
}
