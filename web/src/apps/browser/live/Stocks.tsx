import { useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useNow } from '@/lib/format';
import { t } from '@/i18n';
import { cx } from '../model';
import { asStocks, type Asset } from './data';
import { useLive } from './useLive';
import { Failed, Nothing, Site, Waiting, type LiveProps } from './parts';

// The stock market, to watch, as a trading screen: black, amber, and numbers in a fixed width.
// A tape of every price along the top, the asset being looked at with its chart, who has moved
// most, and the whole board under them. Buying and selling stay on the phone, where the wallet is.
// The site is only on the network while the phone's Stocks app is switched on - off, its prices
// never move.

const UP = '#2ebd85';
const DOWN = '#f6465d';

/** 1,234.56, and more places for what is worth cents. */
const price = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 });
const pct = (f: number): string => `${f >= 0 ? '+' : ''}${(f * 100).toFixed(2)}%`;
const side = (f: number): string => (f >= 0 ? 'sx-up' : 'sx-down');

/** A price history as a line, drawn to fill a box of w x h - or, `stretch`, as wide as there is room. */
function Line({ points, w, h, color, fill, stretch }: { points: number[]; w: number; h: number; color: string; fill?: boolean; stretch?: boolean }) {
  if (points.length < 2) return <svg width={stretch ? '100%' : w} height={h} />;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  const xy = points.map((p, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - lo) / span) * (h - 4)).toFixed(1)}`);
  return (
    <svg width={stretch ? '100%' : w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block shrink-0">
      {fill && <polygon points={`0,${h} ${xy.join(' ')} ${w},${h}`} fill={color} opacity={0.1} />}
      <polyline points={xy.join(' ')} fill="none" stroke={color} strokeWidth={fill ? 2 : 1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Movers({ title, list, onPick }: { title: string; list: Asset[]; onPick: (symbol: string) => void }) {
  return (
    <div className="sx-panel">
      <div className="sx-cap px-3 pt-3 pb-2">{title}</div>
      {list.length === 0 && <div className="s-faint px-3 pb-3 text-[12px]">-</div>}
      {list.map(a => (
        <button key={a.symbol} type="button" className="sx-row !py-1.5 last:!border-b-0" onClick={() => onPick(a.symbol)}>
          <span className="s-mono flex-1 text-[13px] font-bold">{a.symbol}</span>
          <span className="s-mono text-[12px] tabular-nums">{price(a.price)}</span>
          <span className={cx('s-mono w-[68px] text-right text-[12px] tabular-nums', side(a.change))}>{pct(a.change)}</span>
        </button>
      ))}
    </div>
  );
}

export default function Stocks({ site, shown }: LiveProps) {
  // (the market ticks every few seconds: looked at again every ten)
  const market = useLive('web:stocks', undefined, asStocks, shown, 10);
  const now = useNow(1000);
  const [kind, setKind] = useState<'all' | 'stock' | 'crypto'>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const d = market.data;

  const all = d?.assets ?? [];
  const assets = all.filter(a => kind === 'all' || a.kind === kind);
  const focus = all.find(a => a.symbol === picked) ?? assets[0];
  const ranked = [...all].sort((a, b) => b.change - a.change);
  const tape = all.map(a => (
    <span key={a.symbol} className="inline-flex items-center gap-2 px-4">
      <b className="text-[#d9dee5]">{a.symbol}</b>
      <span className="tabular-nums">{price(a.price)}</span>
      <span className={cx('tabular-nums', side(a.change))}>{`${a.change >= 0 ? '▲' : '▼'} ${pct(a.change)}`}</span>
    </span>
  ));

  return (
    <Site brand="stocks">
      <header className="sx-head">
        <div className="mx-auto max-w-[1080px] h-12 px-5 flex items-center gap-4">
          <span className="sx-logo">
            <span>LSX</span>
            <span>{site.title}</span>
          </span>
          <span className="flex-1" />
          <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.12em]" style={{ color: UP }}>
            <span className="w-2 h-2 rounded-full" style={{ background: UP, boxShadow: `0 0 0 3px rgba(46,189,133,0.22)` }} />
            {t('ui.browser.stocks_live')}
          </span>
          <span className="s-mono s-muted text-[12px] tabular-nums">{now.toLocaleTimeString('en-GB')}</span>
        </div>
      </header>
      {all.length > 0 && (
        <div className="sx-tape">
          {/* (the tape twice over, slid half its length: where it ends it has already begun again) */}
          <div className="shrink-0 inline-flex items-center s-muted" style={{ animation: `sxTape ${Math.max(30, all.length * 4)}s linear infinite` }}>
            {tape}
            <span className="inline-flex items-center" aria-hidden>
              {tape}
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-[1080px] px-5 py-5 page-in">
        {!d ? (
          market.error ? (
            <Failed error={market.error} onRetry={() => void market.reload()} />
          ) : (
            <Waiting />
          )
        ) : all.length === 0 ? (
          <Nothing title={t('ui.browser.stocks_empty')} />
        ) : (
          <>
            <div className="flex gap-4">
              {focus && (
                <div className="sx-panel flex-1 min-w-0 p-4">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="s-mono text-[22px] font-extrabold text-white">{focus.symbol}</span>
                        <span className="sx-cap">{t(focus.kind === 'crypto' ? 'ui.browser.stocks_crypto_one' : 'ui.browser.stocks_stock_one')}</span>
                      </div>
                      <div className="s-muted text-[13px] truncate">{focus.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="s-mono text-[26px] font-bold text-white tabular-nums leading-tight">{price(focus.price)}</div>
                      <div className={cx('s-mono inline-flex items-center gap-1.5 text-[14px] tabular-nums', side(focus.change))}>
                        {focus.change >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                        {pct(focus.change)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Line points={focus.history} w={600} h={170} color={focus.change >= 0 ? UP : DOWN} fill stretch />
                  </div>
                  <div className="s-faint mt-2 flex justify-between s-mono text-[11px] tabular-nums">
                    <span>{`${t('ui.browser.stocks_low')} ${focus.history.length ? price(Math.min(...focus.history)) : '-'}`}</span>
                    <span>{`${t('ui.browser.stocks_high')} ${focus.history.length ? price(Math.max(...focus.history)) : '-'}`}</span>
                  </div>
                </div>
              )}
              <div className="shrink-0 w-[270px] flex flex-col gap-4">
                <Movers title={t('ui.browser.stocks_gainers')} list={ranked.filter(a => a.change > 0).slice(0, 4)} onPick={setPicked} />
                <Movers title={t('ui.browser.stocks_losers')} list={ranked.filter(a => a.change < 0).slice(-4).reverse()} onPick={setPicked} />
              </div>
            </div>

            <div className="mt-4 mb-2 flex items-center gap-1.5">
              {(['all', 'stock', 'crypto'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKind(k)} className={cx('s-chip', kind === k && 'is-on')} style={{ borderRadius: 3 }}>
                  {t(`ui.browser.stocks_${k}`)}
                </button>
              ))}
              <span className="flex-1" />
              <span className="s-faint text-[12px]">{t('ui.browser.stocks_watch_only')}</span>
            </div>

            <div className="sx-panel overflow-hidden">
              <div className="sx-cap flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid var(--s-line)' }}>
                <span className="w-[64px]">{t('ui.browser.stocks_h_symbol')}</span>
                <span className="flex-1">{t('ui.browser.stocks_h_name')}</span>
                <span className="w-[110px]" />
                <span className="w-[110px] text-right">{t('ui.browser.stocks_h_price')}</span>
                <span className="w-[80px] text-right">{t('ui.browser.stocks_h_change')}</span>
              </div>
              {assets.map(a => (
                <button key={a.symbol} type="button" onClick={() => setPicked(a.symbol)} className={cx('sx-row last:!border-b-0', focus?.symbol === a.symbol && 'is-on')}>
                  <span className="s-mono w-[64px] text-[13px] font-bold text-white">{a.symbol}</span>
                  <span className="s-muted flex-1 min-w-0 text-[13px] truncate">{a.name}</span>
                  <Line points={a.history} w={110} h={26} color={a.change >= 0 ? UP : DOWN} />
                  <span className="s-mono w-[110px] text-right text-[13px] tabular-nums">{price(a.price)}</span>
                  <span className={cx('s-mono w-[80px] text-right text-[13px] tabular-nums', side(a.change))}>{pct(a.change)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </Site>
  );
}
