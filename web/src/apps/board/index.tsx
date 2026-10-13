import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, Megaphone, ShieldCheck } from 'lucide-react';
import { InfoBar, NavItem } from '@/ui/controls';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { AppIcon, Avatar } from '@/os/icons';
import type { AppProps } from '../registry';
import Announcements from './Announcements';
import OnDuty from './OnDuty';
import { useQuery, useWidth } from './hooks';
import { ErrorState, LoadingState, cx } from './parts';
import type { Page, Post } from './types';
import { normState } from './util';

const PAGES: Page[] = ['posts', 'duty'];

/** Below this window width the NavigationView collapses to an icon rail. */
const COMPACT_BELOW = 880;

/**
 * Company Board: a job's notice board, laid out like the Business Manager - a navigation pane
 * (Announcements / On duty) beside the content layer. board:state is loaded here and handed to
 * both pages: it is the whole board (the job, whether this player may post, the announcements,
 * the roster). On duty is only there when the server sent a roster. Visited pages stay mounted
 * (hidden), so a half-written announcement survives a look at who is on duty.
 */
export default function CompanyBoard(_props: AppProps) {
  const q = useQuery('board:state', normState);
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const userName = useOS(s => s.payload?.user.name ?? '');
  const userInitials = useOS(s => s.payload?.user.initials ?? '');
  const [page, setPage] = useState<Page>('posts');
  const [visited, setVisited] = useState<Page[]>(['posts']);
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const compact = width > 0 && width < COMPACT_BELOW;

  const { reload, set } = q;
  useEffect(() => {
    void reload();
  }, [reload]);

  const st = q.data;
  const hasRoster = !!st?.roster;
  // On duty goes away if the roster does (a job change mid-session); fall back to the board.
  const current: Page = page === 'duty' && !hasRoster ? 'posts' : page;

  const go = useCallback(
    (p: Page) => {
      setPage(p);
      setVisited(v => (v.includes(p) ? v : [...v, p]));
      void reload();
    },
    [reload],
  );

  /** Put a write's reply on screen before the refetch lands. */
  const setPosts = useCallback((posts: Post[]) => set(s => (s ? { ...s, posts } : s)), [set]);

  const onDuty = st?.roster ? st.roster.filter(m => m.onDuty).length : 0;
  const nav: { id: Page; icon: ReactNode; label: string; count?: number }[] = [
    { id: 'posts', icon: <Megaphone size={16} />, label: t('ui.board.nav_posts') },
    ...(hasRoster ? [{ id: 'duty' as Page, icon: <BadgeCheck size={16} />, label: t('ui.board.nav_duty'), count: onDuty }] : []),
  ];

  const jobLabel = st?.job.label || '';
  // Under the player's name: their rank where the roster knows it, else the job.
  const rank = st?.roster?.find(m => m.me)?.gradeName || jobLabel;

  const renderPage = (p: Page): ReactNode => {
    if (!st) return null;
    switch (p) {
      case 'posts':
        return <Announcements state={st} loading={q.loading} clock24={clock24} reload={reload} setPosts={setPosts} />;
      case 'duty':
        return <OnDuty state={st} loading={q.loading} reload={reload} />;
    }
  };

  return (
    <div ref={rootRef} className="relative h-full w-full flex bg-win text-t1 overflow-hidden">
      {/* NavigationView pane */}
      <nav className={cx('shrink-0 flex flex-col bg-win min-h-0', compact ? 'w-14 items-center' : 'w-[260px]')}>
        {compact ? (
          <div className="h-14 flex items-center justify-center" title={jobLabel || t('ui.board.app_name')}>
            <AppIcon app="board" size={24} />
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 pt-3 pb-4 min-w-0">
            <AppIcon app="board" size={32} />
            <div className="min-w-0 leading-tight">
              <div className="text-body font-semibold text-t1 truncate" title={jobLabel}>
                {jobLabel || t('ui.board.app_name')}
              </div>
              <div className="text-caption text-t2 truncate">{t('ui.board.app_name')}</div>
            </div>
          </div>
        )}

        <div className={cx('flex flex-col gap-0.5', compact ? 'w-full items-center px-1' : 'px-2')}>
          {st &&
            nav.map(n =>
              compact ? (
                <RailItem key={n.id} icon={n.icon} label={n.label} selected={current === n.id} onClick={() => go(n.id)} />
              ) : (
                <NavItem
                  key={n.id}
                  icon={n.icon}
                  label={n.label}
                  selected={current === n.id}
                  onClick={() => go(n.id)}
                  badge={n.count !== undefined ? <span className="text-caption text-t3 tabular-nums">{n.count}</span> : undefined}
                />
              ),
            )}
        </div>

        <div className={cx('mt-auto', compact ? 'pb-3' : 'mx-2 mb-2 pt-2 border-t border-stroke')}>
          {st &&
            (compact ? (
              <div title={`${userName}\n${rank}`}>
                <Avatar initials={userInitials} size={32} />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar initials={userInitials} size={32} />
                <div className="min-w-0 leading-tight">
                  <div className="text-body text-t1 truncate">{userName}</div>
                  <div className="text-caption text-t2 truncate flex items-center gap-1" title={st.canPost ? t('ui.board.can_post') : undefined}>
                    {st.canPost && <ShieldCheck size={12} className="shrink-0 text-accent-text" />}
                    <span className="truncate">{rank}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </nav>

      {/* Content layer */}
      <main className="flex-1 min-w-0 flex flex-col bg-layer rounded-tl-win border-t border-l border-stroke overflow-hidden">
        {!st ? (
          q.error ? (
            <div className="p-6">
              <ErrorState message={q.error} onRetry={() => void reload()} loading={q.loading} />
            </div>
          ) : (
            <LoadingState />
          )
        ) : (
          <>
            {q.error && (
              <div className="shrink-0 px-6 pt-4">
                <InfoBar severity="error" title={t('ui.board.refresh_failed')}>
                  {q.error}{' '}
                  <button type="button" className="text-accent-text hover:underline ml-1" onClick={() => void reload()}>
                    {t('ui.common.retry')}
                  </button>
                </InfoBar>
              </div>
            )}
            <div className="flex-1 min-h-0">
              {PAGES.filter(p => visited.includes(p) || p === current).map(p =>
                p === 'duty' && !hasRoster ? null : (
                  <div key={p} className={p === current ? 'h-full page-in' : 'hidden'}>
                    {renderPage(p)}
                  </div>
                ),
              )}
            </div>
          </>
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
