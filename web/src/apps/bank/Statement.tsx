import { useMemo, useState } from 'react';
import { ArrowRight, Receipt, Search, X } from 'lucide-react';
import { Empty, TextInput } from '@/ui/controls';
import { t } from '@/i18n';
import { fmtStamp } from '@/lib/format';
import { Chip, Panel, TxIcon, cx } from './parts';
import type { Filter, Source, Tx } from './types';
import { fmtSigned, matchesSearch, txDelta } from './util';

/**
 * The statement: every listed transaction in a table, narrowed by direction (All / In / Out) and
 * by the search box. The chips count what the search leaves, so they always say how many lines a
 * click would show. The Message column is only drawn when a line has one: the phone's banking
 * history keeps none, and a column of dashes would just push the amounts off a narrow window.
 */
export default function Statement({ txs, source, clock24 }: { txs: Tx[]; source: Source; clock24: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => txs.map(tx => ({ tx, d: txDelta(tx) })), [txs]);
  const found = useMemo(() => rows.filter(r => matchesSearch(r.tx, search)), [rows, search]);
  const nIn = found.filter(r => r.d >= 0).length;
  const shown = filter === 'all' ? found : found.filter(r => (filter === 'in' ? r.d >= 0 : r.d < 0));
  const withMessage = rows.some(r => r.tx.message !== '');

  return (
    <Panel
      className="mt-3"
      title={t('ui.bank.tx_title')}
      caption={rows.length ? t(source === 'phone' ? 'ui.bank.tx_from_phone' : 'ui.bank.tx_from_banking') : undefined}
      actions={
        rows.length > 0 ? (
          <>
            <Chip selected={filter === 'all'} onClick={() => setFilter('all')} count={found.length}>
              {t('ui.bank.filter_all')}
            </Chip>
            <Chip selected={filter === 'in'} onClick={() => setFilter('in')} count={nIn}>
              {t('ui.bank.filter_in')}
            </Chip>
            <Chip selected={filter === 'out'} onClick={() => setFilter('out')} count={found.length - nIn}>
              {t('ui.bank.filter_out')}
            </Chip>
            <div className="relative flex w-[210px] max-w-full">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
              <TextInput
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('ui.bank.search_placeholder')}
                aria-label={t('ui.bank.search_placeholder')}
                autoComplete="off"
                maxLength={60}
                className="pl-8 pr-8"
              />
              {search !== '' && (
                <button
                  type="button"
                  title={t('ui.bank.search_clear')}
                  aria-label={t('ui.bank.search_clear')}
                  onClick={() => setSearch('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-ctl text-t2 hover:bg-subtle hover:text-t1"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </>
        ) : undefined
      }
      bodyClass="pt-3 pb-2"
    >
      {rows.length === 0 ? (
        <div className="h-[220px]">
          <Empty icon={<Receipt size={32} />} title={t('ui.bank.no_tx_title')}>
            {t('ui.bank.no_tx_body')}
          </Empty>
        </div>
      ) : (
        <div className="overflow-x-auto os-scroll">
          <table className={cx('w-full border-separate border-spacing-0 text-body', withMessage ? 'min-w-[780px]' : 'min-w-[600px]')}>
            <thead>
              <tr className="text-caption text-t2 text-left">
                <th className="h-9 pl-5 pr-3 border-b border-stroke font-semibold w-[170px]">{t('ui.bank.col_date')}</th>
                <th className="h-9 px-3 border-b border-stroke font-semibold">{t('ui.bank.col_description')}</th>
                <th className="h-9 px-3 border-b border-stroke font-semibold">{t('ui.bank.col_parties')}</th>
                {withMessage && <th className="h-9 px-3 border-b border-stroke font-semibold">{t('ui.bank.col_message')}</th>}
                <th className="h-9 pl-3 pr-5 border-b border-stroke font-semibold text-right w-[130px]">{t('ui.bank.col_amount')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={withMessage ? 5 : 4} className="px-5 py-10 text-center text-caption text-t2">
                    {t('ui.bank.tx_none_match')}
                  </td>
                </tr>
              )}
              {shown.map(({ tx, d }) => (
                <tr key={tx.id} className="hover:bg-subtle [&:last-child>td]:border-b-0">
                  <td className="h-12 pl-5 pr-3 border-b border-stroke text-t2 whitespace-nowrap tabular-nums">{tx.time > 0 ? fmtStamp(tx.time, clock24) : '—'}</td>
                  <td className="h-12 px-3 border-b border-stroke">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TxIcon delta={d} />
                      <span className="text-t1 truncate max-w-[240px]" title={tx.title}>
                        {tx.title}
                      </span>
                    </div>
                  </td>
                  <td className="h-12 px-3 border-b border-stroke text-t2">
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[280px]">
                      <Party name={tx.issuer} />
                      <ArrowRight size={12} className="shrink-0 text-t3" />
                      <Party name={tx.receiver} />
                    </div>
                  </td>
                  {withMessage && (
                    <td className="h-12 px-3 border-b border-stroke text-t2">
                      <div className="truncate max-w-[260px]" title={tx.message}>
                        {tx.message || '—'}
                      </div>
                    </td>
                  )}
                  <td className={cx('h-12 pl-3 pr-5 border-b border-stroke text-right font-semibold tabular-nums whitespace-nowrap', d < 0 ? 'text-critical' : 'text-success')}>
                    {fmtSigned(d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** One side of a transaction; a dash when the statement's source does not say who it was. */
function Party({ name }: { name: string }) {
  if (!name) return <span className="text-t3">—</span>;
  return (
    <span className="truncate" title={name}>
      {name}
    </span>
  );
}
