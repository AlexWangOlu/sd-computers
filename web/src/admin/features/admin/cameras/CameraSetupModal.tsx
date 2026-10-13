import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Hint, Modal, ModalActions } from '@/admin/components/shared';
import { ScrollArea } from '@/admin/components/ScrollArea';
import { Combobox } from '@/admin/components/Combobox';
import type { ComboOption } from '@/admin/components/Combobox';
import { useAdmin } from '@/admin/store/admin';
import { act, place } from '@/admin/nui/api';
import { t } from '@/admin/i18n';
import type { Camera } from '@/admin/types';

// Putting a security camera up, or changing one that is: what it is called, the heading the app
// lists it under, and the jobs that may watch it (none = anyone the app is offered to). Putting one
// up hands over to the camera tool, which flies it into place; the server checks every field again
// either way.
export function CameraSetupModal({ camera, onClose }: { camera?: Camera; onClose(): void }) {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const [label, setLabel] = useState(camera?.label ?? t('cameras.default_label'));
  const [area, setArea] = useState(camera?.area ?? '');
  const [jobs, setJobs] = useState(Object.entries(camera?.groups ?? {}).map(([name, grade]) => ({ name, grade })));

  const name = label.trim();
  // The headings in use already, to pick from: cameras under one heading are listed together.
  const areas: ComboOption[] = [...new Set(snapshot.cameras.list.map(c => c.area ?? '').filter(Boolean))].sort().map(a => ({ value: a, label: a }));
  // A job is typed as the framework spells it - or picked from the server's own, listed under the field.
  const jobOptions: ComboOption[] = snapshot.jobs.map(j => ({ value: j.name, label: j.label, hint: j.name }));

  const valid =
    name.length > 0 &&
    jobs.every(j => /^[\w-]{1,48}$/.test(j.name) && Number.isInteger(j.grade) && j.grade >= 0 && j.grade <= 100) &&
    new Set(jobs.map(j => j.name)).size === jobs.length;

  async function save() {
    if (!valid || busy) return;
    const payload = {
      label: name,
      area: area.trim() || null,
      jobs: jobs.length ? Object.fromEntries(jobs.map(j => [j.name, j.grade])) : null,
    };
    if (!camera) {
      onClose();
      await place('placecamera', payload);
      return;
    }
    const reply = await act('updatecamera', { id: camera.id, ...payload }, t('cameras.saved'));
    if (reply.success) onClose();
  }

  const jobNames = jobs.map(j => j.name).filter(Boolean).join(', ');

  return (
    <Modal title={t(camera ? 'cameras.edit' : 'cameras.place')} onClose={onClose} width={560}>
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <label className="sc-label block mb-1.5" htmlFor="camera-label">
            {t('cameras.name')}
          </label>
          <input id="camera-label" className="sc-input w-full" maxLength={snapshot.rules.maxLabel} value={label} onChange={e => setLabel(e.target.value)} placeholder={t('cameras.name_placeholder')} autoFocus />
        </div>
        <div className="flex-1 min-w-0">
          <span className="sc-label block mb-1.5">{t('cameras.area')}</span>
          <Combobox value={area} options={areas} onChange={setArea} placeholder={t('cameras.area_placeholder')} maxLength={snapshot.rules.maxLabel} ariaLabel={t('cameras.area')} />
        </div>
      </div>
      <Hint className="mt-2">{t('cameras.area_hint')}</Hint>

      {/* Who may watch it. One fixed height: listing jobs fills this, it never makes the dialog taller. */}
      <div className="flex flex-col mt-4" style={{ height: 178 }}>
        <div className="flex items-center gap-2 mb-1.5" style={{ height: 16 }}>
          <span className="sc-label">{t('cameras.access')}</span>
          <span className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>
            {jobNames || t('cameras.access_anyone')}
          </span>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 flex-shrink-0 p-0 bg-transparent border-0 text-[11.5px] font-medium"
            style={{ color: jobs.length >= 16 ? 'var(--text-4)' : 'var(--text-1)' }}
            disabled={jobs.length >= 16}
            onClick={() => setJobs([...jobs, { name: '', grade: 0 }])}
          >
            <Plus size={12} />
            {t('computers.add_job')}
          </button>
        </div>
        <ScrollArea className="flex-1 min-h-0" viewClassName="space-y-2" viewStyle={{ paddingRight: 'var(--sa-gutter, 0px)' }}>
          {jobs.map((j, i) => (
            <div className="flex gap-2" key={i}>
              <div className="flex-1 min-w-0">
                <Combobox
                  value={j.name}
                  options={jobOptions}
                  onChange={v => setJobs(jobs.map((x, n) => (n === i ? { ...x, name: v.replace(/[^\w-]/g, '') } : x)))}
                  placeholder="police"
                  maxLength={48}
                  ariaLabel={t('computers.job_name')}
                />
              </div>
              <input
                aria-label={t('computers.grade')}
                title={t('computers.grade')}
                className="sc-input"
                style={{ width: 68, flex: '0 0 68px' }}
                type="number"
                min={0}
                max={100}
                step={1}
                value={j.grade}
                onChange={e => setJobs(jobs.map((x, n) => (n === i ? { ...x, grade: Number(e.target.value) } : x)))}
              />
              <button type="button" className="sc-btn sc-btn--icon" aria-label={t('computers.remove_job')} onClick={() => setJobs(jobs.filter((_, n) => n !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
          {!jobs.length && (
            <Hint>
              {t('cameras.jobs_empty')} {t('cameras.jobs_hint')}
            </Hint>
          )}
        </ScrollArea>
      </div>

      {!camera && <Hint className="mt-3">{t('cameras.fly_hint')}</Hint>}
      <ModalActions>
        <button type="button" className="sc-btn" onClick={onClose}>
          {t('actions.cancel')}
        </button>
        <button type="button" className="sc-btn sc-btn--primary" disabled={!valid || busy} onClick={() => void save()}>
          {t(camera ? 'actions.save' : 'cameras.place_next')}
        </button>
      </ModalActions>
    </Modal>
  );
}
