import { useMemo, useRef } from 'react';
import { BadgeCheck, ChevronRight, Landmark, Radio, Users, Wallet } from 'lucide-react';
import { Button } from '@/ui/controls';
import { t } from '@/i18n';
import { fmtAgo, fmtMoney } from '@/lib/format';
import BalanceChart, { buildSeries } from './BalanceChart';
import { useBoss } from './context';
import { useWidth } from './hooks';
import { Panel, PageHeader, RefreshButton, StatCard, TxIcon, cx } from './parts';
import { fmtSigned, txDelta } from './util';

/** Dashboard: stat tiles, the balance chart and the latest statement lines. */
export default function Overview() {
  const { overview: ov, overviewLoading, reloadOverview, go, clock24 } = useBoss();
  const bodyRef = useRef<HTMLDivElement>(null);
  const width = useWidth(bodyRef);

  const funds = ov.funds;
  const txs = funds.transactions ?? [];
  const balance = funds.available && typeof funds.balance === 'number' ? funds.balance : null;
  const points = useMemo(() => (balance === null ? [] : buildSeries(txs, balance, ov.job.label)), [txs, balance, ov.job.label]);
  const recent = txs.slice(0, 6);

  // Four tiles: 4 across when they fit, else 2x2 (never an orphaned 3+1), 1 column when tiny.
  const cols = width >= 720 ? 4 : width >= 360 ? 2 : 1;
  const wide = width >= 780;

  const change = points.length >= 2 ? points[points.length - 1].v - points[0].v : 0;
  const changePct = points.length >= 2 && points[0].v !== 0 ? (change / Math.abs(points[0].v)) * 100 : null;

  return (
    <div className="h-full overflow-y-auto os-scroll">
      <div ref={bodyRef} className="px-6 pt-5 pb-8 max-w-[1600px]">
        <PageHeader
          title={t('ui.boss.nav_overview')}
          subtitle={ov.job.label}
          actions={<RefreshButton loading={overviewLoading} onClick={() => void reloadOverview()} />}
        />

        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          <StatCard
            icon={<Wallet size={16} />}
            label={t('ui.boss.stat_balance')}
            value={balance === null ? t('ui.boss.unavailable') : fmtMoney(balance)}
            muted={balance === null}
            caption={t('ui.boss.stat_balance_caption')}
            onClick={funds.available ? () => go('finances') : undefined}
          />
          <StatCard
            icon={<Users size={16} />}
            label={t('ui.boss.stat_employees')}
            value={ov.counts.total}
            caption={t('ui.boss.stat_employees_caption')}
            onClick={() => go('employees')}
          />
          <StatCard
            icon={<Radio size={16} />}
            label={t('ui.boss.stat_online')}
            value={ov.counts.online}
            caption={t('ui.boss.stat_of_total', ov.counts.total)}
          />
          <StatCard
            icon={<BadgeCheck size={16} />}
            label={t('ui.boss.stat_on_duty')}
            value={ov.counts.onDuty}
            caption={t('ui.boss.stat_of_total', ov.counts.total)}
          />
        </div>

        {!funds.available ? (
          <Panel className="mt-3" bodyClass="p-5">
            <div className="flex items-center gap-4">
              <span className="w-10 h-10 rounded-full bg-subtle border border-stroke flex items-center justify-center text-t2 shrink-0">
                <Landmark size={18} />
              </span>
              <div className="min-w-0">
                <div className="text-body font-semibold text-t1">{t('ui.boss.funds_off_title')}</div>
                <div className="text-caption text-t2">{t('ui.boss.funds_off_body')}</div>
              </div>
            </div>
          </Panel>
        ) : (
          <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: wide ? 'minmax(0, 1.75fr) minmax(280px, 1fr)' : 'minmax(0, 1fr)' }}>
            <Panel
              title={t('ui.boss.chart_title')}
              caption={txs.length ? t('ui.boss.chart_caption', txs.length) : undefined}
              actions={
                changePct !== null || change !== 0 ? (
                  <span className={cx('text-body font-semibold tabular-nums', change < 0 ? 'text-critical' : 'text-success')}>
                    {fmtSigned(change)}
                    {changePct !== null && <span className="font-normal opacity-80"> ({changePct >= 0 ? '+' : '−'}{Math.abs(changePct).toFixed(1)}%)</span>}
                  </span>
                ) : undefined
              }
              bodyClass="px-3 pb-3 pt-2"
            >
              {balance === null ? (
                <ChartMessage title={t('ui.boss.unavailable')} body={t('ui.boss.balance_unavailable')} />
              ) : points.length < 2 ? (
                <ChartMessage title={t('ui.boss.no_tx_title')} body={t('ui.boss.no_tx_body')} />
              ) : (
                <BalanceChart points={points} clock24={clock24} height={wide ? 240 : 210} />
              )}
            </Panel>

            <Panel
              title={t('ui.boss.recent_title')}
              actions={
                txs.length > 0 ? (
                  <Button variant="subtle" compact onClick={() => go('finances')} className="-mr-2 -mt-1">
                    {t('ui.boss.view_all')}
                    <ChevronRight size={14} />
                  </Button>
                ) : undefined
              }
              bodyClass="px-5 pb-3 pt-1"
            >
              {recent.length === 0 ? (
                <div className="py-8 text-center text-caption text-t2">{t('ui.boss.no_tx_title')}</div>
              ) : (
                recent.map(tx => {
                  const d = txDelta(tx, ov.job.label);
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-stroke last:border-b-0">
                      <TxIcon delta={d} />
                      <div className="flex-1 min-w-0">
                        <div className="text-body text-t1 truncate">{tx.title}</div>
                        <div className="text-caption text-t2 truncate">
                          {tx.issuer} · {fmtAgo(tx.time)}
                        </div>
                      </div>
                      <div className={cx('text-body font-semibold tabular-nums whitespace-nowrap', d < 0 ? 'text-critical' : 'text-success')}>{fmtSigned(d)}</div>
                    </div>
                  );
                })
              )}
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="h-[210px] flex flex-col items-center justify-center text-center gap-1 px-6">
      <div className="text-body font-semibold text-t1">{title}</div>
      <div className="text-caption text-t2 max-w-[340px]">{body}</div>
    </div>
  );
}
