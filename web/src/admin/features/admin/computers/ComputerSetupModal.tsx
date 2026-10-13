import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, Crosshair, Laptop, Monitor, PcCase, Plus, TriangleAlert, X } from 'lucide-react';
import { Hint, Modal, ModalActions } from '@/admin/components/shared';
import { ScrollArea } from '@/admin/components/ScrollArea';
import { Combobox, matches } from '@/admin/components/Combobox';
import type { ComboOption } from '@/admin/components/Combobox';
import { useAdmin } from '@/admin/store/admin';
import { act, place } from '@/admin/nui/api';
import { styleLike, t, tOr } from '@/admin/i18n';
import type { Computer, Prop } from '@/admin/types';
import { StylePreview } from './StylePreview';
import { AddPropModal } from '../props/AddPropModal';

export const PropIcon = ({ kind, size = 15 }: { kind?: Prop['kind']; size?: number }) =>
  kind === 'laptop' ? <Laptop size={size} /> : kind === 'tower' ? <PcCase size={size} /> : <Monitor size={size} />;

// What a prop looks like: its picture (web/public/props/<model>.jpg - a photograph of the model
// taken in the game - or the `image` its config entry names), and its icon when there is none.
export const PropImage = ({ prop, className = '', style, iconSize = 22 }: { prop?: Prop; className?: string; style?: CSSProperties; iconSize?: number }) => {
  const [missing, setMissing] = useState<string | null>(null);
  const src = prop ? (prop.image ?? `props/${prop.model}.jpg`) : null;
  return (
    <span className={`flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`} style={{ background: 'var(--surface-3)', color: 'var(--text-3)', ...style }}>
      {src && missing !== src ? <img src={src} alt="" draggable={false} className="w-full h-full object-cover" onError={() => setMissing(src)} /> : <PropIcon kind={prop?.kind} size={iconSize} />}
    </span>
  );
};

// (two lines: the style's name, and under it what it resembles - somebody may not know "SD OS Pro")
const segment: CSSProperties = { flex: '1 1 45%', height: 36, padding: '0 8px', fontSize: 11.5, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2 };
const segmentHint: CSSProperties = { fontSize: 10, fontWeight: 400, opacity: 0.7 };

// The Business Manager on a computer: none, for whoever signs in as a boss (their own job), or for
// the boss of one job.
type BossMode = 'off' | 'any' | 'job';
const BOSS_MODES: BossMode[] = ['off', 'any', 'job'];

// Placing a computer, or changing one that is placed: the prop it stands as (every prop on offer,
// pictured), the look it opens in, its name, (optionally) the jobs that may use it, and whether a
// boss gets the Business Manager on it. Placing hands over to the gizmo; the server checks every
// field again either way.
// With `world` it makes a computer of a prop the game already has instead: there is no prop to
// choose (the admin aims at it next), and one made that way keeps the prop it is.
export function ComputerSetupModal({ computer, initialStyle, world = false, onClose }: { computer?: Computer; initialStyle?: string; world?: boolean; onClose(): void }) {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const existing = world || computer?.source === 'world'; // its prop is the game's own
  const [prop, setProp] = useState(computer?.prop ?? snapshot.props[0]?.model ?? '');
  // '' = no style of its own: it opens in whatever the default is.
  const [style, setStyle] = useState(computer ? (computer.styleSet ? computer.style : '') : (initialStyle ?? ''));
  const [label, setLabel] = useState(computer?.label ?? t('computers.default_label'));
  const [jobs, setJobs] = useState(Object.entries(computer?.groups ?? {}).map(([name, grade]) => ({ name, grade })));
  // ('*' is how the server says "whatever job the signed-in player has")
  const [bossMode, setBossMode] = useState<BossMode>(!computer?.boss ? 'off' : computer.boss === '*' ? 'any' : 'job');
  const [bossJob, setBossJob] = useState(computer?.boss && computer.boss !== '*' ? computer.boss : '');
  const [addingProp, setAddingProp] = useState(false);

  // (a picked prop need not be on the placing list: any model known as a computer can be picked)
  const picked = snapshot.props.find(p => p.model === prop) ?? (existing && computer?.prop ? { model: computer.prop, label: computer.prop } : undefined);
  const shown = snapshot.styles.find(s => s.key === (style || snapshot.defaultStyle)) ?? snapshot.styles[0];
  const name = label.trim();

  const canBoss = snapshot.boss.available;
  const bossDef = snapshot.jobs.find(j => j.name === bossJob);
  const bossLabel = bossDef?.label ?? bossJob;
  // The job is typed as the framework spells it, like a job of the lock - or picked from the server's own, listed under the field.
  const jobOptions: ComboOption[] = snapshot.jobs.map(j => ({ value: j.name, label: j.label, hint: j.boss ? j.name : `${j.name} · ${t('computers.boss_no_rank')}` }));
  // What would keep that job's boss from ever getting it here, the most basic first: the server has no
  // such job, none of its grades is a boss, or the job lock leaves it out. Said, not refused: the job
  // may be on its way.
  const bossIssue =
    !canBoss || bossMode !== 'job' || !bossJob ? null : !bossDef ? 'unknown' : !bossDef.boss ? 'no_rank' : jobs.length > 0 && !jobs.some(j => j.name === bossJob) ? 'locked' : null;
  // (not a warning yet while what is typed could still become one of the server's jobs: that is just typing)
  const bossTyping = bossIssue === 'unknown' && jobOptions.some(o => matches(o, bossJob));

  const valid =
    name.length > 0 &&
    (existing || !!picked) &&
    jobs.every(j => /^[\w-]{1,48}$/.test(j.name) && Number.isInteger(j.grade) && j.grade >= 0 && j.grade <= 100) &&
    new Set(jobs.map(j => j.name)).size === jobs.length &&
    (bossMode !== 'job' || bossJob !== '');

  // "One job" starts on the job the computer is locked to, when that is one job a boss can manage.
  function pickBossMode(mode: BossMode) {
    setBossMode(mode);
    if (mode !== 'job' || bossJob) return;
    const locked = snapshot.jobs.filter(j => j.boss && jobs.some(l => l.name === j.name));
    if (locked.length === 1) setBossJob(locked[0].name);
  }

  // One plain sentence for what the choice does - or, first, for what is in its way.
  function bossHint(): string {
    if (!canBoss) return t(`computers.boss_unavailable_${snapshot.boss.reason ?? 'disabled'}`);
    if (bossMode === 'off') return t('computers.boss_off_hint');
    if (bossMode === 'any') return t(jobs.length ? 'computers.boss_any_locked_hint' : 'computers.boss_any_hint');
    if (!bossJob) return t('computers.boss_job_none');
    if (bossIssue === 'unknown') return t(bossTyping ? 'computers.boss_typing' : 'computers.boss_unknown', bossJob);
    if (bossIssue === 'no_rank') return t('computers.boss_no_rank_hint', bossLabel);
    return t(bossIssue === 'locked' ? 'computers.boss_locked_out' : 'computers.boss_job_hint', bossLabel);
  }

  async function save() {
    if (!valid || busy) return;
    const payload = {
      label: name,
      prop,
      style: style || null,
      jobs: jobs.length ? Object.fromEntries(jobs.map(j => [j.name, j.grade])) : null,
      boss: bossMode === 'off' ? null : bossMode === 'any' ? '*' : bossJob,
    };
    if (!computer) {
      onClose();
      await place(world ? 'pickcomputer' : 'placecomputer', payload);
      return;
    }
    const reply = await act('updatecomputer', { id: computer.id, ...payload }, t('computers.saved'));
    if (reply.success) onClose();
  }

  const jobNames = jobs.map(j => j.name).filter(Boolean).join(', ');

  return (
    <Modal title={t(computer ? 'computers.edit' : world ? 'computers.pick_title' : 'computers.place')} onClose={onClose} width={existing ? 760 : 1080}>
      <ScrollArea style={{ maxHeight: 'calc(90vh - 140px)' }} viewStyle={{ paddingRight: 'var(--sa-gutter, 0px)' }}>
        <div className="flex gap-4" style={{ height: 432 }}>
          {/* A prop the game already has: the one it is, or (not picked yet) what happens next. */}
          {existing && (
            <div className="flex flex-col shrink-0" style={{ width: 280 }}>
              <span className="sc-label block mb-1.5">{t(computer ? 'computers.picked_prop' : 'computers.pick_next')}</span>
              {computer ? (
                <PropImage prop={picked} className="w-full rounded-[10px]" style={{ aspectRatio: '4 / 3', border: '1px solid var(--hairline-strong)' }} iconSize={48} />
              ) : (
                <span className="flex items-center justify-center w-full rounded-[10px]" style={{ aspectRatio: '4 / 3', background: 'var(--surface-2)', border: '1px dashed var(--hairline-strong)', color: 'var(--text-3)' }}>
                  <Crosshair size={40} strokeWidth={1.5} />
                </span>
              )}
              {computer && (
                <div className="mt-2 min-w-0">
                  <div className="text-[13px] font-medium truncate">{picked?.label ?? computer.prop}</div>
                  <div className="text-[11.5px] mono truncate" style={{ color: 'var(--text-3)' }}>
                    {computer.prop}
                  </div>
                </div>
              )}
              <Hint className="mt-2.5">{t(computer ? 'computers.picked_hint' : 'computers.pick_hint')}</Hint>
            </div>
          )}

          {/* Every prop on offer, pictured. */}
          <div className="flex flex-col min-h-0 shrink-0" style={{ width: 384, display: existing ? 'none' : undefined }}>
            <span className="sc-label block mb-1.5">{t('computers.prop')}</span>
            <ScrollArea className="flex-1 min-h-0" viewClassName="grid grid-cols-3 gap-2 content-start" viewStyle={{ paddingRight: 'var(--sa-gutter, 0px)' }} role="group">
              {snapshot.props.map(p => {
                const on = prop === p.model;
                return (
                  <button
                    key={p.model}
                    type="button"
                    aria-pressed={on}
                    title={p.model}
                    onClick={() => setProp(p.model)}
                    className="relative flex flex-col text-left p-1.5 rounded-[8px] transition-colors"
                    style={{ background: on ? 'var(--surface-3)' : 'var(--surface-2)', border: `1px solid ${on ? 'var(--hairline-focus)' : 'var(--hairline)'}` }}
                  >
                    <PropImage prop={p} className="w-full rounded-[5px]" style={{ aspectRatio: '4 / 3' }} />
                    <span className="block mt-1.5 px-0.5 text-[11.5px] font-medium truncate" style={{ color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
                      {p.label}
                    </span>
                    {on && (
                      <span className="absolute top-2.5 right-2.5 flex items-center justify-center w-4 h-4 rounded-full" style={{ background: 'var(--text-1)', color: '#0c0d0f' }}>
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
              {/* (one of the server's own: a model name, added to the list for good) */}
              <button
                type="button"
                onClick={() => setAddingProp(true)}
                className="flex flex-col items-center justify-center gap-1.5 p-1.5 rounded-[8px] text-[11.5px] font-medium transition-colors"
                style={{ background: 'transparent', border: '1px dashed var(--hairline-strong)', color: 'var(--text-3)', minHeight: 96 }}
              >
                <Plus size={18} />
                {t('computers.add_prop')}
              </button>
            </ScrollArea>
          </div>

          {/* The one picked, large. */}
          <div className="flex flex-col shrink-0" style={{ width: 280, display: existing ? 'none' : undefined }}>
            <span className="sc-label block mb-1.5">{t('computers.prop_preview')}</span>
            <PropImage key={prop} prop={picked} className="w-full rounded-[10px] animate-fadeIn" style={{ aspectRatio: '1', border: '1px solid var(--hairline-strong)' }} iconSize={56} />
            <div className="mt-2 min-w-0">
              <div className="text-[13px] font-medium truncate">{picked?.label ?? prop}</div>
              <div className="text-[11.5px] mono truncate" style={{ color: 'var(--text-3)' }}>
                {prop}
              </div>
            </div>
          </div>

          {/* The look it opens in. */}
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="sc-label block mb-1.5">{t('computers.style')}</span>
            {shown && <StylePreview key={shown.key} style={shown} className="animate-fadeIn" />}
            {/* (one row, whatever the styles are called: each takes the room its name needs) */}
            <div className="sc-segment mt-2.5" style={{ display: 'flex', flexWrap: 'wrap' }}>
              <button type="button" style={segment} data-on={style === ''} aria-pressed={style === ''} onClick={() => setStyle('')}>
                {t('computers.style_default')}
                <span style={segmentHint}>{snapshot.styles.find(s => s.key === snapshot.defaultStyle)?.name ?? snapshot.defaultStyle}</span>
              </button>
              {snapshot.styles.map(s => (
                <button key={s.key} type="button" style={segment} data-on={style === s.key} aria-pressed={style === s.key} onClick={() => setStyle(s.key)}>
                  {s.name}
                  {styleLike(s.key) && <span style={segmentHint}>{styleLike(s.key)}</span>}
                </button>
              ))}
            </div>
            <Hint className="mt-2.5">{shown ? (style === '' ? t('computers.style_default_hint', shown.name) : tOr(`styles.about.${shown.key}`, t('styles.about.other'))) : ''}</Hint>
          </div>
        </div>

        {/* Its name, and who may use it. One fixed height: listing jobs fills this, it never makes the dialog taller. */}
        <div className="flex gap-4 mt-4" style={{ height: 138 }}>
          <div className="flex flex-col shrink-0" style={{ width: existing ? 280 : 680 }}>
            <label className="sc-label block mb-1.5" style={{ height: 16, lineHeight: '16px' }} htmlFor="computer-label">
              {t('computers.name')}
            </label>
            <input id="computer-label" className="sc-input w-full" maxLength={snapshot.rules.maxLabel} value={label} onChange={e => setLabel(e.target.value)} placeholder={t('computers.name_placeholder')} />
            {!computer && !world && <Hint className="mt-2.5">{t('computers.aim_hint')}</Hint>}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1.5" style={{ height: 16 }}>
              <span className="sc-label">{t('computers.access')}</span>
              <span className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>
                {jobNames || t('computers.access_anyone')}
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
                  <input aria-label={t('computers.job_name')} className="sc-input flex-1 min-w-0" value={j.name} onChange={e => setJobs(jobs.map((v, n) => (n === i ? { ...v, name: e.target.value.trim() } : v)))} placeholder="police" maxLength={48} />
                  <input aria-label={t('computers.grade')} title={t('computers.grade')} className="sc-input" style={{ width: 68, flex: '0 0 68px' }} type="number" min={0} max={100} step={1} value={j.grade} onChange={e => setJobs(jobs.map((v, n) => (n === i ? { ...v, grade: Number(e.target.value) } : v)))} />
                  <button type="button" className="sc-btn sc-btn--icon" aria-label={t('computers.remove_job')} onClick={() => setJobs(jobs.filter((_, n) => n !== i))}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {!jobs.length && (
                <Hint>
                  {t('computers.jobs_empty')} {t('computers.jobs_hint')}
                </Hint>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* The Business Manager: who gets it here, and a sentence saying what that means. One fixed height again. */}
        <div className="mt-4" style={{ height: 112 }}>
          <span className="sc-label block mb-1.5">{t('computers.boss')}</span>
          <div className="flex items-center gap-2.5">
            <div className="sc-segment" style={{ display: 'flex', flex: '0 0 420px', opacity: canBoss ? undefined : 0.5 }}>
              {BOSS_MODES.map(mode => (
                <button key={mode} type="button" style={{ ...segment, flex: '1 1 0' }} data-on={bossMode === mode} aria-pressed={bossMode === mode} disabled={!canBoss} onClick={() => pickBossMode(mode)}>
                  {t(`computers.boss_${mode}`)}
                  <span style={segmentHint}>{t(`computers.boss_${mode}_sub`)}</span>
                </button>
              ))}
            </div>
            {/* (there only while it is one job's: nothing to choose otherwise. A job name takes letters, digits, - and _) */}
            <div style={{ width: 240, visibility: bossMode === 'job' ? 'visible' : 'hidden' }}>
              <Combobox value={bossJob} options={jobOptions} onChange={v => setBossJob(v.replace(/[^\w-]/g, ''))} placeholder={t('computers.boss_pick')} maxLength={48} disabled={!canBoss} ariaLabel={t('computers.job_name')} />
            </div>
          </div>
          <Hint className="mt-2.5">
            {bossIssue && !bossTyping ? (
              <span style={{ color: 'var(--warn)' }}>
                <TriangleAlert size={12} className="inline-block mr-1" style={{ verticalAlign: -2 }} />
                {bossHint()}
                {/* (the way out, in one click: the lock wants the job as the framework spells it) */}
                {bossIssue === 'locked' && jobs.length < 16 && (
                  <button type="button" className="ml-1.5 p-0 bg-transparent border-0 text-[11.5px] font-medium" style={{ color: 'var(--text-1)' }} onClick={() => setJobs([...jobs, { name: bossJob, grade: 0 }])}>
                    {t('computers.boss_locked_fix', bossJob)}
                  </button>
                )}
              </span>
            ) : (
              bossHint()
            )}
          </Hint>
        </div>
      </ScrollArea>
      <ModalActions>
        <button type="button" className="sc-btn" onClick={onClose}>
          {t('actions.cancel')}
        </button>
        <button type="button" className="sc-btn sc-btn--primary" disabled={!valid || busy} onClick={() => void save()}>
          {t(computer ? 'actions.save' : world ? 'computers.pick_world' : 'computers.place_world')}
        </button>
      </ModalActions>
      {addingProp && <AddPropModal onClose={() => setAddingProp(false)} onAdded={setProp} />}
    </Modal>
  );
}
