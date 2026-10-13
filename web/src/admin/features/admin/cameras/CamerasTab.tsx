import { useState } from 'react';
import { Cctv, Lock, Monitor, Move, Navigation, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, ConfirmDialog, Empty, Heading, Hint, SearchInput, Status } from '@/admin/components/shared';
import { ScrollArea } from '@/admin/components/ScrollArea';
import { useAdmin } from '@/admin/store/admin';
import { act, place } from '@/admin/nui/api';
import { t } from '@/admin/i18n';
import type { Camera } from '@/admin/types';
import { CameraSetupModal } from './CameraSetupModal';

type Filter = 'all' | 'placed' | 'config';

const jobsOf = (c: Camera) => Object.entries(c.groups ?? {}).map(([job, grade]) => (grade > 0 ? `${job} ${grade}+` : job));
const whereOf = (c: Camera) => `${c.key} · ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)} · ${Math.round(c.fov)}°`;

const Row = ({ c, onEdit, onDelete }: { c: Camera; onEdit: () => void; onDelete: () => void }) => {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const edit = snapshot.canEdit;
  const jobs = jobsOf(c);
  const from = c.computers ?? [];
  // (taken away here: it is in the list only to be put back, and reads as not there)
  const gone = c.removed === true;
  return (
    <div className="sc-row" style={gone ? { opacity: 0.6 } : undefined}>
      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 38, color: 'var(--text-3)' }}>
        <Cctv size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-medium truncate">{c.label}</span>
          {c.area && <Badge>{c.area}</Badge>}
          <Badge tone={c.source === 'placed' ? 'accent' : 'neutral'}>{t(`cameras.source_${c.source}`)}</Badge>
          {gone && (
            <span title={t('cameras.removed_hint')}>
              <Status>{t('cameras.removed_tag')}</Status>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11.5px] min-w-0" style={{ color: 'var(--text-2)' }} title={jobs.length ? t('cameras.watched_by', jobs.join(', ')) : t('cameras.watched_by_anyone')}>
            <Lock size={11} className="flex-shrink-0" style={{ opacity: jobs.length ? 1 : 0.45 }} />
            <span className="truncate">{jobs.length ? jobs.join(', ') : t('cameras.anyone')}</span>
          </span>
          {from.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11.5px] min-w-0" style={{ color: 'var(--text-2)' }} title={t('cameras.only_from', from.join(', '))}>
              <Monitor size={11} className="flex-shrink-0" />
              <span className="truncate">{from.join(', ')}</span>
            </span>
          )}
        </div>
        <div className="text-[11.5px] mono mt-1 truncate" style={{ color: 'var(--text-3)' }}>
          {whereOf(c)}
        </div>
      </div>
      <div className="sc-row__actions">
        {edit && (
          <button type="button" className="sc-btn sc-btn--icon" title={t('cameras.go')} aria-label={t('cameras.go')} disabled={busy} onClick={() => void act('teleportcamera', { key: c.key })}>
            <Navigation size={14} />
          </button>
        )}
        {edit && c.source === 'placed' && (
          <>
            <button type="button" className="sc-btn sc-btn--icon" title={t('actions.edit')} aria-label={t('actions.edit')} disabled={busy} onClick={onEdit}>
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="sc-btn sc-btn--icon"
              title={t('cameras.aim')}
              aria-label={t('cameras.aim')}
              disabled={busy}
              onClick={() => void place('movecamera', { id: c.id, x: c.x, y: c.y, z: c.z, pitch: c.pitch, yaw: c.yaw, fov: c.fov })}
            >
              <Move size={14} />
            </button>
            <button type="button" className="sc-btn sc-btn--icon sc-btn--danger" title={t('actions.delete')} aria-label={t('actions.delete')} disabled={busy} onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          </>
        )}
        {/* (one of the config's: the file is not this panel's to change, so it is taken away and put back instead) */}
        {edit &&
          c.source === 'config' &&
          (gone ? (
            <button type="button" className="sc-btn sc-btn--icon" title={t('cameras.restore')} aria-label={t('cameras.restore')} disabled={busy} onClick={() => void act('restoreconfigcamera', { key: c.key }, t('cameras.config_restored', c.label))}>
              <RotateCcw size={14} />
            </button>
          ) : (
            <button type="button" className="sc-btn sc-btn--icon sc-btn--danger" title={t('cameras.remove_config')} aria-label={t('cameras.remove_config')} disabled={busy} onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          ))}
      </div>
    </div>
  );
};

// Every security camera on the server: the ones put up from here - which can be renamed, given to
// other jobs, aimed again and taken down - and the ones configs/shared/cameras.lua lists, which can
// be taken away here and put back (the file is not changed). Who may watch a camera is said on its
// row: the jobs it is locked to, or anyone.
export function CamerasTab() {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const edit = snapshot.canEdit;
  const [setup, setSetup] = useState<{ camera?: Camera } | null>(null);
  const [deleting, setDeleting] = useState<Camera | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const all = snapshot.cameras.list;
  const live = all.filter(c => !c.removed);
  const full = all.filter(c => c.source === 'placed').length >= snapshot.cameras.max;
  const query = search.trim().toLowerCase();
  const shown = all.filter(c => (filter === 'all' || filter === c.source) && `${c.label} ${c.area ?? ''} ${c.key} ${Object.keys(c.groups ?? {}).join(' ')} ${(c.computers ?? []).join(' ')}`.toLowerCase().includes(query));

  return (
    <div className="flex flex-col h-full min-h-0 px-6 py-5 gap-4">
      <Heading title={t('tabs.cameras')} count={live.length}>
        {edit && (
          <button type="button" className="sc-btn sc-btn--primary" disabled={busy || full} title={full ? t('cameras.full', snapshot.cameras.max) : undefined} onClick={() => setSetup({})}>
            <Plus size={14} />
            {t('cameras.place')}
          </button>
        )}
      </Heading>

      {!snapshot.cameras.enabled && (
        <Hint className="flex-shrink-0">
          <span style={{ color: 'var(--warn)' }}>
            <TriangleAlert size={12} className="inline-block mr-1" style={{ verticalAlign: -2 }} />
            {t('cameras.disabled')}
          </span>
        </Hint>
      )}

      {all.length > 0 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <SearchInput value={search} onChange={setSearch} placeholder={t('cameras.search')} />
          <div className="sc-segment">
            {(['all', 'placed', 'config'] as const).map(f => (
              <button key={f} type="button" data-on={filter === f} onClick={() => setFilter(f)}>
                {t(`cameras.filter_${f}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {!all.length ? (
          <Empty text={t('cameras.empty')} />
        ) : !shown.length ? (
          <Empty text={t(filter === 'placed' && !query ? 'cameras.none_placed' : 'computers.no_results')} />
        ) : (
          <div className="sc-list">
            {shown.map(c => (
              <Row key={c.key} c={c} onEdit={() => setSetup({ camera: c })} onDelete={() => setDeleting(c)} />
            ))}
          </div>
        )}
      </ScrollArea>

      {setup && <CameraSetupModal camera={setup.camera} onClose={() => setSetup(null)} />}
      {deleting && deleting.source === 'placed' && (
        <ConfirmDialog
          title={t('cameras.delete')}
          body={t('cameras.delete_confirm', deleting.label)}
          confirmLabel={t('actions.delete')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const reply = await act('deletecamera', { id: deleting.id }, t('cameras.deleted', deleting.label));
            if (reply.success) setDeleting(null);
          }}
        />
      )}
      {deleting && deleting.source === 'config' && (
        <ConfirmDialog
          title={t('cameras.remove_config')}
          body={t('cameras.remove_config_confirm', deleting.label)}
          confirmLabel={t('computers.remove_config_action')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const reply = await act('removeconfigcamera', { key: deleting.key }, t('cameras.config_removed', deleting.label));
            if (reply.success) setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
