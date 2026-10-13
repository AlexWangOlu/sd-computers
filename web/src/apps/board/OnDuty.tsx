import { useMemo, type ReactNode } from 'react';
import { Users } from 'lucide-react';
import { Card, Empty } from '@/ui/controls';
import { t } from '@/i18n';
import { Initials, PageHeader, RefreshButton, StatusDot, YouChip } from './parts';
import type { BoardState, Member } from './types';
import { groupRoster } from './util';

interface Props {
  state: BoardState;
  loading: boolean;
  reload: () => Promise<boolean>;
}

/**
 * Who is at work right now: the job's roster in three groups - on duty, online but off duty, and
 * offline - each with its people highest rank first. Read-only for everyone; managing the roster
 * is the Business Manager's job.
 */
export default function OnDuty({ state, loading, reload }: Props) {
  const roster = useMemo(() => state.roster ?? [], [state.roster]);
  const groups = useMemo(() => groupRoster(roster), [roster]);

  return (
    <div className="h-full overflow-y-auto os-scroll">
      <div className="px-6 pt-5 pb-8 max-w-[1200px]">
        <PageHeader
          title={t('ui.board.nav_duty')}
          subtitle={roster.length === 0 ? state.job.label : t('ui.board.duty_subtitle', groups.onDuty.length, roster.length, state.job.label)}
          actions={<RefreshButton loading={loading} onClick={() => void reload()} />}
        />

        {roster.length === 0 ? (
          <div className="h-[300px]">
            <Empty icon={<Users size={40} />} title={t('ui.board.roster_empty_title')}>
              {t('ui.board.roster_empty_body', state.job.label)}
            </Empty>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Group status="duty" title={t('ui.board.group_duty')} members={groups.onDuty} empty={t('ui.board.none_on_duty')} />
            {groups.online.length > 0 && <Group status="online" title={t('ui.board.group_online')} members={groups.online} />}
            {groups.offline.length > 0 && <Group status="offline" title={t('ui.board.group_offline')} members={groups.offline} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** One status group: a heading with its head count, then a tile per person (as many across as fit). */
function Group({ status, title, members, empty }: { status: 'duty' | 'online' | 'offline'; title: string; members: Member[]; empty?: ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 mb-2.5 text-body font-semibold text-t1">
        <StatusDot status={status} />
        {title}
        <span className="font-normal text-t3 tabular-nums">{members.length}</span>
      </h2>
      {members.length === 0 ? (
        <div className="text-body text-t2">{empty}</div>
      ) : (
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {members.map((m, i) => (
            // (the roster carries no ids; it is replaced whole on every refresh, so position will do)
            <Card key={`${i}:${m.name}`} icon={<Initials name={m.name} size={36} />} title={m.name} description={m.gradeName} className="!gap-3">
              {m.me && <YouChip />}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
