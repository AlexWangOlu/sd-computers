import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LayoutDashboard, ShieldCheck, UserPlus, Users, Wallet } from 'lucide-react';
import { InfoBar, NavItem } from '@/ui/controls';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { AppIcon, Avatar } from '@/os/icons';
import type { AppProps } from '../registry';
import { BossContext, type BossCtx } from './context';
import { useQuery, useWidth } from './hooks';
import { ErrorState, LoadingState, cx } from './parts';
import type { Page } from './types';
import { gradeName, normOverview } from './util';
import Overview from './Overview';
import Employees from './Employees';
import Hiring from './Hiring';
import Finances from './Finances';

const PAGES: Page[] = ['overview', 'employees', 'hiring', 'finances'];

/** Below this window width the NavigationView collapses to an icon rail (WinUI "compact" mode). */
const COMPACT_BELOW = 880;

/**
 * Business Manager: a WinUI-style NavigationView (Overview / Employees / Hiring / Finances) over
 * the boss:* endpoints. boss:overview is loaded here and shared through BossContext; each page
 * owns its other data. Visited pages stay mounted (hidden) so a 20s job offer, a search box or a
 * half-typed amount survive switching pages.
 */
export default function BusinessManager(_props: AppProps) {
  const ovq = useQuery('boss:overview', normOverview);
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const userName = useOS(s => s.payload?.user.name ?? '');
  const userInitials = useOS(s => s.payload?.user.initials ?? '');
  const [page, setPage] = useState<Page>('overview');
  const [visited, setVisited] = useState<Page[]>(['overview']);
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const compact = width > 0 && width < COMPACT_BELOW;

  const { reload: reloadOverview, set: setOverview } = ovq;
  useEffect(() => {
    void reloadOverview();
  }, [reloadOverview]);

  const ov = ovq.data;
  const fundsOn = !!ov?.funds.available;
  // Finances disappears if banking goes away mid-session; fall back to the dashboard.
  const current: Page = page === 'finances' && !fundsOn ? 'overview' : page;

  const go = useCallback(
    (p: Page) => {
      setPage(p);
      setVisited(v => (v.includes(p) ? v : [...v, p]));
      if (p === 'overview' || p === 'finances') void reloadOverview();
    },
    [reloadOverview],
  );

  const setBalance = useCallback(
    (balance: number) => setOverview(o => (o ? { ...o, funds: { ...o.funds, balance } } : o)),
    [setOverview],
  );

  const ctx = useMemo<BossCtx | null>(
    () => (ov ? { overview: ov, overviewLoading: ovq.loading, reloadOverview, setBalance, go, clock24 } : null),
    [ov, ovq.loading, reloadOverview, setBalance, go, clock24],
  );

  const nav: { id: Page; icon: ReactNode; label: string }[] = [
    { id: 'overview', icon: <LayoutDashboard size={16} />, label: t('ui.boss.nav_overview') },
    { id: 'employees', icon: <Users size={16} />, label: t('ui.boss.nav_employees') },
    { id: 'hiring', icon: <UserPlus size={16} />, label: t('ui.boss.nav_hiring') },
    ...(fundsOn ? [{ id: 'finances' as Page, icon: <Wallet size={16} />, label: t('ui.boss.nav_finances') }] : []),
  ];

  const jobLabel = ov?.job.label || '';
  const rank = ov ? gradeName(ov.grades, ov.myGrade) : '';

  const renderPage = (p: Page, active: boolean): ReactNode => {
    switch (p) {
      case 'overview':
        return <Overview />;
      case 'employees':
        return <Employees active={active} />;
      case 'hiring':
        return <Hiring active={active} />;
      case 'finances':
        return <Finances />;
    }
  };

  return (
    <div ref={rootRef} className="relative h-full w-full flex bg-win text-t1 overflow-hidden">
      {/* NavigationView pane */}
      <nav className={cx('shrink-0 flex flex-col bg-win min-h-0', compact ? 'w-14 items-center' : 'w-[260px]')}>
        {compact ? (
          <div className="h-14 flex items-center justify-center" title={jobLabel || t('ui.boss.app_name')}>
            <AppIcon app="boss" size={24} />
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 pt-3 pb-4 min-w-0">
            <AppIcon app="boss" size={32} />
            <div className="min-w-0 leading-tight">
              <div className="text-body font-semibold text-t1 truncate" title={jobLabel}>
                {jobLabel || t('ui.boss.app_name')}
              </div>
              <div className="text-caption text-t2 truncate">{t('ui.boss.app_name')}</div>
            </div>
          </div>
        )}

        <div className={cx('flex flex-col gap-0.5', compact ? 'w-full items-center px-1' : 'px-2')}>
          {ov &&
            nav.map(n =>
              compact ? (
                <RailItem key={n.id} icon={n.icon} label={n.label} selected={current === n.id} onClick={() => go(n.id)} />
              ) : (
                <NavItem key={n.id} icon={n.icon} label={n.label} selected={current === n.id} onClick={() => go(n.id)} />
              ),
            )}
        </div>

        <div className={cx('mt-auto', compact ? 'pb-3' : 'mx-2 mb-2 pt-2 border-t border-stroke')}>
          {ov &&
            (compact ? (
              <div title={`${userName}\n${rank}`}>
                <Avatar initials={userInitials} size={32} />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar initials={userInitials} size={32} />
                <div className="min-w-0 leading-tight">
                  <div className="text-body text-t1 truncate">{userName}</div>
                  <div className="text-caption text-t2 truncate flex items-center gap-1" title={t('ui.boss.your_rank')}>
                    <ShieldCheck size={12} className="shrink-0 text-accent-text" />
                    <span className="truncate">{rank}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </nav>

      {/* Content layer */}
      <main className="flex-1 min-w-0 flex flex-col bg-layer rounded-tl-win border-t border-l border-stroke overflow-hidden">
        {!ov || !ctx ? (
          ovq.error ? (
            <div className="p-6">
              <ErrorState message={ovq.error} onRetry={() => void reloadOverview()} loading={ovq.loading} />
            </div>
          ) : (
            <LoadingState />
          )
        ) : (
          <BossContext.Provider value={ctx}>
            {ovq.error && (
              <div className="shrink-0 px-6 pt-4">
                <InfoBar severity="error" title={t('ui.boss.refresh_failed')}>
                  {ovq.error}{' '}
                  <button type="button" className="text-accent-text hover:underline ml-1" onClick={() => void reloadOverview()}>
                    {t('ui.common.retry')}
                  </button>
                </InfoBar>
              </div>
            )}
            <div className="flex-1 min-h-0">
              {PAGES.filter(p => visited.includes(p) || p === current).map(p =>
                p === 'finances' && !fundsOn ? null : (
                  <div key={p} className={p === current ? 'h-full page-in' : 'hidden'}>
                    {renderPage(p, p === current)}
                  </div>
                ),
              )}
            </div>
          </BossContext.Provider>
        )}
      </main>
    </div>
  );
}

/** Compact-mode nav button: icon only, accent pill on the selected one, label as tooltip. */
function RailItem({ icon, label, selected, onClick }: { icon: ReactNode; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx('relative w-10 h-9 flex items-center justify-center rounded-ctl text-t1 transition-colors duration-150', selected ? 'bg-subtle' : 'hover:bg-subtle')}
    >
      {selected && <span className="absolute left-0 top-[10px] w-[3px] h-4 rounded-full bg-accent pill-in" />}
      {icon}
    </button>
  );
}
