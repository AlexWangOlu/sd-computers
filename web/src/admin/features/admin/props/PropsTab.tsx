import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Empty, Heading, Hint, SearchInput } from '@/admin/components/shared';
import { ScrollArea } from '@/admin/components/ScrollArea';
import { useAdmin } from '@/admin/store/admin';
import { act } from '@/admin/nui/api';
import { t } from '@/admin/i18n';
import type { Prop } from '@/admin/types';
import { PropImage } from '../computers/ComputerSetupModal';
import { AddPropModal } from './AddPropModal';

type Filter = 'all' | 'monitor' | 'tower' | 'laptop' | 'custom';
const FILTERS: Filter[] = ['all', 'monitor', 'tower', 'laptop', 'custom'];

// The catalogue of props: every model a computer can be - placed as, picked from the world as, or
// ticked in the Automatic tab. The ones from configs/shared/admin.lua are shown as they are; the
// ones added here (a model name, kept in the database) can be taken away again. Each says where it
// is in use, so it is plain what removing or unticking one would touch.
export const PropsTab = () => {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const edit = snapshot.canEdit;
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  // Where each prop is in use: how many computers are placed (or picked) as it, and the automatic
  // computer every prop of it in the world is.
  const { placedAs, autoOf } = useMemo(() => {
    const placed: Record<string, number> = {};
    snapshot.computers.forEach(c => {
      if (c.prop) placed[c.prop] = (placed[c.prop] ?? 0) + 1;
    });
    const auto: Record<string, string> = {};
    snapshot.auto.computers.forEach(a => a.models.forEach(m => m.on && (auto[m.model] = a.label)));
    return { placedAs: placed, autoOf: auto };
  }, [snapshot.computers, snapshot.auto]);

  const query = search.trim().toLowerCase();
  const shown = snapshot.props.filter(
    (p: Prop) => (filter === 'all' || (filter === 'custom' ? !!p.custom : (p.kind ?? 'monitor') === filter)) && `${p.label} ${p.model}`.toLowerCase().includes(query),
  );

  return (
    <div className="flex flex-col h-full min-h-0 px-6 py-5 gap-4">
      <Heading title={t('tabs.props')} count={snapshot.props.length}>
        {edit && (
          <button type="button" className="sc-btn sc-btn--primary" disabled={busy} onClick={() => setAdding(true)}>
            <Plus size={14} />
            {t('props.add')}
          </button>
        )}
      </Heading>

      <div className="flex items-center gap-2 flex-shrink-0">
        <SearchInput value={search} onChange={setSearch} placeholder={t('props.search')} />
        <div className="sc-segment">
          {FILTERS.map(f => (
            <button key={f} type="button" data-on={filter === f} onClick={() => setFilter(f)}>
              {t(`props.filter_${f}`)}
            </button>
          ))}
        </div>
      </div>
      <Hint className="flex-shrink-0 -mt-1.5">{t('props.tab_hint')}</Hint>

      <ScrollArea className="flex-1 min-h-0" viewClassName="grid grid-cols-6 gap-2 content-start" viewStyle={{ paddingRight: 'var(--sa-gutter, 0px)' }}>
        {shown.map(p => {
          const uses = [autoOf[p.model] ? t('props.auto', autoOf[p.model]) : null, placedAs[p.model] ? t('props.placed', placedAs[p.model]) : null].filter(Boolean);
          return (
            <div key={p.model} className="relative flex flex-col p-1.5 rounded-[8px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
              <PropImage prop={p} className="w-full rounded-[5px]" style={{ aspectRatio: '4 / 3' }} />
              <span className="block mt-1.5 px-0.5 text-[11.5px] font-medium truncate" title={p.label}>
                {p.label}
              </span>
              <span className="block px-0.5 text-[10.5px] mono truncate" style={{ color: 'var(--text-3)' }} title={p.model}>
                {p.model}
              </span>
              <span className="block px-0.5 mt-1 text-[10.5px] truncate" style={{ color: uses.length ? 'var(--text-2)' : 'var(--text-4)' }} title={uses.join(' · ')}>
                {uses.length ? uses.join(' · ') : t('props.unused')}
              </span>
              {p.custom && (
                <span className="absolute top-2.5 left-2.5 pointer-events-none">
                  <Badge tone="accent">{t('props.custom')}</Badge>
                </span>
              )}
              {p.custom && edit && (
                <button
                  type="button"
                  className="sc-btn sc-btn--icon sc-btn--danger absolute top-2 right-2"
                  style={{ background: 'rgba(12,13,15,0.75)' }}
                  title={t('props.remove')}
                  aria-label={t('props.remove')}
                  disabled={busy}
                  onClick={() => void act('removeprop', { model: p.model }, t('props.removed', p.label))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
        {!shown.length && (
          <div className="col-span-6">
            <Empty text={t(filter === 'custom' && !query ? 'props.none' : 'computers.no_results')} />
          </div>
        )}
      </ScrollArea>

      {adding && <AddPropModal onClose={() => setAdding(false)} />}
    </div>
  );
};
