import { useState } from 'react';
import { ChevronDown, Landmark, Scale, Search } from 'lucide-react';
import { fmtMoney } from '@/lib/format';
import { t } from '@/i18n';
import { cx } from '../model';
import { asLaws, type Offence, type OffenceClass } from './data';
import { useLive } from './useLive';
import { Failed, Input, Nothing, Site, Waiting, type LiveProps } from './parts';

// Laws and fines: the penal code the police terminal works from, as the state's own site - the
// "official website" line, a navy banner with the seal, and a table with nothing playful about it.
// Anyone can look a charge up: what it is called, what it costs and what it carries. It is the
// list as it stands today: a charge the department changed, added or dropped is changed, there or
// gone here too.

const CLASSES: OffenceClass[] = ['felony', 'misdemeanor', 'infraction'];

function Row({ o, open, onToggle }: { o: Offence; open: boolean; onToggle: () => void }) {
  return (
    <div className="gv-tr">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-4 px-4 py-2.5 text-left cursor-pointer" aria-expanded={open}>
        <span className="s-mono shrink-0 w-[76px] text-[12px] s-muted">{o.code}</span>
        <span className="min-w-0 flex-1 text-[14px] font-semibold truncate">{o.label}</span>
        <span className={`gv-class gv-class--${o.class} shrink-0 w-[104px]`}>{t(`ui.browser.laws_${o.class}`)}</span>
        <span className="shrink-0 w-[84px] text-right text-[14px] tabular-nums">{fmtMoney(o.fine)}</span>
        <span className="s-muted shrink-0 w-[96px] text-right text-[13px] tabular-nums">{o.months > 0 ? t('ui.browser.laws_months', o.months) : t('ui.browser.laws_no_jail')}</span>
        <ChevronDown size={14} className={cx('s-faint shrink-0 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && <p className="s-muted px-4 pb-3 pl-[108px] text-[13px] leading-5 select-text">{o.description || t('ui.browser.laws_no_description')}</p>}
    </div>
  );
}

export default function Laws({ site, shown }: LiveProps) {
  // (the law does not change by the half minute: looked at again every five)
  const laws = useLive('web:laws', undefined, asLaws, shown, 300);
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<OffenceClass | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const d = laws.data;

  const q = query.trim().toLowerCase();
  const all = d?.offences ?? [];
  const found = all.filter(o => (!only || o.class === only) && (!q || o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)));

  return (
    <Site brand="laws">
      <div className="gv-strip">
        <div className="mx-auto max-w-[1000px] px-6 h-7 flex items-center gap-2">
          <Landmark size={12} />
          {t('ui.browser.laws_official')}
        </div>
      </div>
      <header className="gv-head">
        <div className="mx-auto max-w-[1000px] px-6 py-6 flex items-center gap-5">
          <span className="gv-seal" aria-hidden>
            <Scale size={28} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#d9b95c]">{t('ui.browser.laws_state')}</div>
            <h1 className="mt-1">{site.title}</h1>
            <div className="mt-1 text-[13px] opacity-80">{t('ui.browser.laws_dept')}</div>
          </div>
        </div>
      </header>
      <nav className="gv-nav">
        <div className="mx-auto max-w-[1000px] px-6 flex">
          {[null, ...CLASSES].map(c => (
            <button key={c ?? 'all'} type="button" onClick={() => setOnly(c)} className={cx(only === c && 'is-on')}>
              {c ? t(`ui.browser.laws_${c}_many`) : t('ui.browser.laws_all_many')}
              <span className="s-faint ml-1.5 text-[12px] font-normal tabular-nums">{c ? all.filter(o => o.class === c).length : all.length}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 mx-auto w-full max-w-[1000px] px-6 py-7 page-in">
        {!d ? (
          laws.error ? (
            <Failed error={laws.error} onRetry={() => void laws.reload()} />
          ) : (
            <Waiting />
          )
        ) : (
          <>
            <h2 className="text-[22px] font-bold">{t('ui.browser.laws_heading')}</h2>
            <p className="s-muted mt-1.5 max-w-[680px] text-[14px]">{t('ui.browser.laws_intro')}</p>

            <div className="mt-5 mb-4 max-w-[420px]">
              <span className="s-label">{t('ui.browser.laws_search_label')}</span>
              <div className="relative">
                <Search size={15} className="s-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input value={query} maxLength={60} placeholder={t('ui.browser.laws_search')} aria-label={t('ui.browser.laws_search')} className="!pl-9" onChange={e => setQuery(e.target.value)} />
              </div>
            </div>

            {found.length === 0 ? (
              <div className="gv-table">
                <Nothing title={q ? t('ui.browser.laws_no_match', query.trim()) : t('ui.browser.laws_empty')} />
              </div>
            ) : (
              <div className="gv-table">
                <div className="gv-th flex items-center gap-4 px-4 py-2.5">
                  <span className="w-[76px]">{t('ui.browser.laws_h_code')}</span>
                  <span className="flex-1">{t('ui.browser.laws_h_charge')}</span>
                  <span className="w-[104px]">{t('ui.browser.laws_h_class')}</span>
                  <span className="w-[84px] text-right">{t('ui.browser.laws_h_fine')}</span>
                  <span className="w-[96px] text-right">{t('ui.browser.laws_h_sentence')}</span>
                  <span className="w-[14px]" />
                </div>
                {found.map(o => (
                  <Row key={o.code} o={o} open={open === o.code} onToggle={() => setOpen(x => (x === o.code ? null : o.code))} />
                ))}
              </div>
            )}
            <p className="s-faint mt-3 text-[12px]">{t('ui.browser.laws_count', found.length)}</p>
          </>
        )}
      </main>
      <footer className="gv-foot">
        <div className="mx-auto max-w-[1000px] px-6 py-4">{t('ui.browser.laws_foot')}</div>
      </footer>
    </Site>
  );
}
