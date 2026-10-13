import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { MapPin, Send, UserPlus } from 'lucide-react';
import { Button, Empty, Spinner, TextInput } from '@/ui/controls';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { useBoss } from './context';
import { useNotices, useQuery } from './hooks';
import { ErrorState, Initials, LoadingState, Notices, PageHeader, RefreshButton } from './parts';
import type { Nearby } from './types';
import { normNearby } from './util';

/**
 * Hire someone standing near this computer - or, where the server allows it (overview.hireById),
 * anyone online by their player ID. boss:hire blocks until the target answers their accept/decline
 * prompt (up to ~20s), so each row carries its own pending state - and people with an offer out
 * stay listed even if a refresh no longer returns them. An offer sent by ID shows the ID alone
 * while it waits: who it belongs to is only told once they accept.
 */
export default function Hiring({ active }: { active: boolean }) {
  const { overview: ov, reloadOverview } = useBoss();
  const q = useQuery('boss:nearby', normNearby);
  const notices = useNotices();
  const [pending, setPending] = useState<Record<number, Nearby>>({});
  const [idText, setIdText] = useState('');
  const [sent, setSent] = useState<number[]>([]); // player IDs with an offer out

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

  const id = /^[1-9]\d{0,4}$/.test(idText) ? Number(idText) : null;
  const offerById = async (e: FormEvent) => {
    e.preventDefault();
    if (id === null || sent.includes(id)) return;
    const who = t('ui.boss.player_id', id);
    setIdText('');
    setSent(s => [...s, id]);
    const res = await rpc<{ name?: string }>('boss:hire', { id, byId: true });
    setSent(s => s.filter(x => x !== id));
    if (res.ok) {
      notices.push('success', t('ui.boss.hired', res.data?.name || who, ov.job.label));
      void reloadOverview();
    } else {
      notices.push('error', res.error || t('ui.common.error'), who);
    }
    void reload();
  };

  return (
    <div className="h-full overflow-y-auto os-scroll">
      <div className="px-6 pt-5 pb-8 max-w-[900px]">
        <PageHeader title={t('ui.boss.nav_hiring')} actions={<RefreshButton loading={q.loading} onClick={() => void reload()} />} />

        <div className="flex items-start gap-3 mb-5 text-body text-t2">
          <MapPin size={16} className="mt-0.5 shrink-0 text-accent-text" />
          <p className="max-w-[640px]">{t(ov.hireById ? 'ui.boss.hiring_explain_id' : 'ui.boss.hiring_explain', ov.job.label)}</p>
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
                  {t(ov.hireById ? 'ui.boss.nearby_empty_body_id' : 'ui.boss.nearby_empty_body')}
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

        {/* Someone who is not at the computer: the offer goes to their player ID, wherever they are. */}
        {ov.hireById && (
          <section className="rounded-win bg-card border border-stroke shadow-card overflow-hidden mt-3">
            <div className="flex items-center justify-between gap-3 px-5 h-11 border-b border-stroke">
              <h2 className="text-body font-semibold text-t1">{t('ui.boss.byid_title')}</h2>
              {sent.length > 0 && <span className="text-caption text-t2">{t('ui.boss.byid_count', sent.length)}</span>}
            </div>
            <form onSubmit={e => void offerById(e)} className="flex items-end gap-3 px-5 py-4 flex-wrap">
              <label className="flex flex-col gap-1.5 w-[150px]">
                <span className="text-caption text-t2">{t('ui.boss.byid_label')}</span>
                <TextInput inputMode="numeric" maxLength={5} placeholder={t('ui.boss.byid_placeholder')} value={idText} onChange={e => setIdText(e.target.value.replace(/\D/g, ''))} />
              </label>
              <Button type="submit" variant="accent" icon={<Send size={14} />} disabled={id === null || sent.includes(id)}>
                {t('ui.boss.send_offer')}
              </Button>
              <p className="flex-1 min-w-[220px] text-caption text-t3">{t('ui.boss.byid_hint')}</p>
            </form>
            {sent.map(n => (
              <div key={n} className="flex items-center gap-3 px-5 py-3 border-t border-stroke flex-wrap">
                <Initials name="#" size={36} />
                <div className="flex-1 min-w-[140px] text-body text-t1">{t('ui.boss.player_id', n)}</div>
                <div className="h-8 flex items-center gap-2.5 px-1 text-body text-t2" aria-live="polite">
                  <Spinner size={16} />
                  {t('ui.boss.waiting')}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
