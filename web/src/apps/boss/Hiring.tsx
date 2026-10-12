import { useEffect, useMemo, useState } from 'react';
import { MapPin, Send, UserPlus } from 'lucide-react';
import { Button, Empty, Spinner } from '@/ui/controls';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { useBoss } from './context';
import { useNotices, useQuery } from './hooks';
import { ErrorState, Initials, LoadingState, Notices, PageHeader, RefreshButton } from './parts';
import type { Nearby } from './types';
import { normNearby } from './util';

/**
 * Hire someone standing near this computer. boss:hire blocks until the target answers their
 * accept/decline prompt (up to ~20s), so each row carries its own pending state - and people with
 * an offer out stay listed even if a refresh no longer returns them.
 */
export default function Hiring({ active }: { active: boolean }) {
  const { overview: ov, reloadOverview } = useBoss();
  const q = useQuery('boss:nearby', normNearby);
  const notices = useNotices();
  const [pending, setPending] = useState<Record<number, Nearby>>({});

  const { reload } = q;
  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);

  const people = useMemo(() => {
    const list = q.data ?? [];
    const extra = Object.values(pending).filter(p => !list.some(x => x.id === p.id));
    return [...list, ...extra];
  }, [q.data, pending]);

  const offer = async (p: Nearby) => {
    setPending(s => ({ ...s, [p.id]: p }));
    const res = await rpc<{ name?: string }>('boss:hire', { id: p.id });
    setPending(s => {
      const next = { ...s };
      delete next[p.id];
      return next;
    });
    if (res.ok) {
      notices.push('success', t('ui.boss.hired', res.data?.name || p.name, ov.job.label));
      void reloadOverview();
    } else {
      notices.push('error', res.error || t('ui.common.error'), p.name);
    }
    void reload();
  };

  return (
    <div className="h-full overflow-y-auto os-scroll">
      <div className="px-6 pt-5 pb-8 max-w-[900px]">
        <PageHeader title={t('ui.boss.nav_hiring')} actions={<RefreshButton loading={q.loading} onClick={() => void reload()} />} />

        <div className="flex items-start gap-3 mb-5 text-body text-t2">
          <MapPin size={16} className="mt-0.5 shrink-0 text-accent-text" />
          <p className="max-w-[640px]">{t('ui.boss.hiring_explain', ov.job.label)}</p>
        </div>

        <Notices list={notices.list} onClose={notices.dismiss} />

        {!q.data ? (
          q.error ? <ErrorState message={q.error} onRetry={() => void reload()} loading={q.loading} /> : <LoadingState />
        ) : (
          <section className="rounded-win bg-card border border-stroke shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 h-11 border-b border-stroke">
              <h2 className="text-body font-semibold text-t1">{t('ui.boss.nearby_title')}</h2>
              <span className="text-caption text-t2">{t('ui.boss.nearby_count', people.length)}</span>
            </div>
            {people.length === 0 ? (
              <div className="h-[240px]">
                <Empty icon={<UserPlus size={40} />} title={t('ui.boss.nearby_empty_title')}>
                  {t('ui.boss.nearby_empty_body')}
                </Empty>
              </div>
            ) : (
              people.map(p => {
                const isPending = !!pending[p.id];
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-stroke last:border-b-0 flex-wrap">
                    <Initials name={p.name} size={36} />
                    <div className="flex-1 min-w-[140px]">
                      <div className="text-body text-t1 truncate">{p.name}</div>
                      <div className="text-caption text-t2">{t('ui.boss.player_id', p.id)}</div>
                    </div>
                    {isPending ? (
                      <div className="h-8 flex items-center gap-2.5 px-1 text-body text-t2" aria-live="polite">
                        <Spinner size={16} />
                        {t('ui.boss.waiting')}
                      </div>
                    ) : (
                      <Button variant="accent" icon={<Send size={14} />} onClick={() => void offer(p)}>
                        {t('ui.boss.send_offer')}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>
    </div>
  );
}
