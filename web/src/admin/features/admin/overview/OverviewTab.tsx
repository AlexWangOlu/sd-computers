import { useState } from 'react';
import { ArrowUpRight, MonitorUp } from 'lucide-react';
import { useAdmin } from '@/admin/store/admin';
import { t } from '@/admin/i18n';
import { ScrollArea } from '@/admin/components/ScrollArea';
import { BarChart, Status } from '@/admin/components/shared';
import type { Tab } from '@/admin/types';
import { ComputerSetupModal } from '../computers/ComputerSetupModal';

const Stat = ({ label, value, tab, index, columns }: { label: string; value: string; tab: Tab; index: number; columns: number }) => {
  const setTab = useAdmin(s => s.setTab);
  return (
    <button
      type="button"
      onClick={() => setTab(tab)}
      className="group text-left px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
      style={{
        background: 'none',
        border: 'none',
        borderLeft: index % columns === 0 ? 'none' : '1px solid var(--hairline)',
        borderTop: index < columns ? 'none' : '1px solid var(--hairline)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-3)' }}>
          {label}
        </span>
        <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-3)' }} />
      </div>
      <div className="text-[26px] font-semibold mono tracking-[-0.02em] mt-1.5 leading-none">{value}</div>
    </button>
  );
};

const NoData = () => (
  <div className="flex items-center justify-center text-[12.5px]" style={{ height: 106, color: 'var(--text-3)' }}>
    {t('overview.no_data')}
  </div>
);

export const OverviewTab = () => {
  const snapshot = useAdmin(s => s.snapshot)!;
  const recent = useAdmin(s => s.recent);
  const busy = useAdmin(s => s.busy);
  const [placing, setPlacing] = useState(false);

  const all = snapshot.computers.filter(c => !c.removed); // (one taken away in the panel is not a computer: it counts for nothing)
  const placed = all.filter(c => c.source === 'placed' || c.source === 'world'); // (made from this panel: placed, or picked)
  const stats: { label: string; value: string; tab: Tab }[] = [
    { label: t('stats.computers'), value: String(all.length), tab: 'computers' },
    { label: t('stats.placed'), value: String(placed.length), tab: 'computers' },
    { label: t('stats.config'), value: String(all.length - placed.length), tab: 'computers' },
    { label: t('stats.in_use'), value: String(all.reduce((n, c) => n + c.users.length, 0)), tab: 'computers' },
    { label: t('stats.locked'), value: String(all.filter(c => c.groups && Object.keys(c.groups).length > 0).length), tab: 'computers' },
    { label: t('stats.pin'), value: String(all.filter(c => c.pin).length), tab: 'computers' },
    { label: t('stats.props'), value: String(snapshot.props.length), tab: 'props' },
    { label: t('stats.styles'), value: String(snapshot.styles.length), tab: 'styles' },
  ];

  // Computers per style (every style, in the order the Styles tab lists them) and placed computers
  // per prop (only the props in use, most used first).
  const perStyle = snapshot.styles.map(s => ({ label: s.name, n: all.filter(c => c.style === s.key).length }));
  const perProp = snapshot.props.map(p => ({ label: p.label, n: placed.filter(c => c.prop === p.model).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const defaultStyle = snapshot.styles.find(s => s.key === snapshot.defaultStyle);

  return (
    <ScrollArea className="h-full" viewClassName="flex flex-col px-6 py-5 gap-6">
      <div className="sc-card grid grid-cols-4 overflow-hidden flex-shrink-0">
        {stats.map((s, i) => (
          <Stat key={s.label} index={i} columns={4} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 flex-shrink-0">
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="sc-heading">{t('overview.by_style')}</div>
          <div className="sc-card px-4 py-4">{all.length > 0 ? <BarChart values={perStyle.map(x => x.n)} labels={perStyle.map(x => x.label)} height={84} /> : <NoData />}</div>
        </div>
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="sc-heading">{t('overview.by_prop')}</div>
          <div className="sc-card px-4 py-4">{perProp.length > 0 ? <BarChart values={perProp.map(x => x.n)} labels={perProp.map(x => x.label)} height={84} /> : <NoData />}</div>
        </div>
      </div>

      {snapshot.canEdit && (
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <button type="button" className="sc-btn" disabled={busy || snapshot.props.length === 0} onClick={() => setPlacing(true)}>
            <MonitorUp size={14} />
            {t('computers.place')}
          </button>
          <span className="ml-auto text-[11.5px]" style={{ color: 'var(--text-4)' }}>
            {t('common.shortcuts')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="sc-heading">{t('overview.rules')}</div>
          <div className="sc-list">
            <div className="sc-row" style={{ minHeight: 40 }}>
              <span className="text-[12.5px] truncate">{t('overview.rule_style')}</span>
              <span className="ml-auto pr-1 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
                {defaultStyle?.name ?? snapshot.defaultStyle}
              </span>
            </div>
            <div className="sc-row" style={{ minHeight: 40 }}>
              <span className="text-[12.5px] truncate">{t('overview.rule_boot')}</span>
              <span className="ml-auto pr-1">
                <Status tone={snapshot.rules.boot ? 'ok' : 'neutral'}>{snapshot.rules.boot ? t('overview.on') : t('overview.off')}</Status>
              </span>
            </div>
            <div className="sc-row" style={{ minHeight: 40 }}>
              <span className="text-[12.5px] truncate">{t('overview.rule_reach', String(snapshot.rules.reach))}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className="sc-heading">{t('recent.title')}</div>
          {recent.length === 0 ? (
            <div className="sc-card px-4 py-6 text-[12.5px] text-center" style={{ color: 'var(--text-3)' }}>
              {t('recent.empty')}
            </div>
          ) : (
            <div className="sc-list">
              {recent.map(r => (
                <div key={r.id} className="sc-row" style={{ minHeight: 40 }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.ok ? 'var(--ok)' : 'var(--danger)' }} />
                  <span className="text-[12.5px] truncate">{r.text}</span>
                  <span className="ml-auto mono text-[11.5px] pr-1" style={{ color: 'var(--text-3)' }}>
                    {new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {placing && <ComputerSetupModal onClose={() => setPlacing(false)} />}
    </ScrollArea>
  );
};
