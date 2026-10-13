import { Check, Lock } from 'lucide-react';
import { Badge, Empty, Heading, Hint, Status } from '@/admin/components/shared';
import { ScrollArea } from '@/admin/components/ScrollArea';
import { Select } from '@/admin/components/Select';
import type { SelectOption } from '@/admin/components/Select';
import { useAdmin } from '@/admin/store/admin';
import { act } from '@/admin/nui/api';
import { styleLike, t } from '@/admin/i18n';
import type { AutoComputer, AutoModel, Computer, OsStyle, Prop } from '@/admin/types';
import { PropImage } from '../computers/ComputerSetupModal';

const Switch = ({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange(on: boolean): void }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} className="sc-switch" data-on={on} disabled={disabled} onClick={() => onChange(!on)} />
);

// How many props are a computer on their own right now.
export const autoCount = (auto: { enabled: boolean; computers: AutoComputer[] }) =>
  auto.enabled ? auto.computers.reduce((n, a) => n + (a.enabled ? a.models.filter(m => m.on).length : 0), 0) : 0;

// One prop of a model computer: tick it on or off (the picture), and give it a style of its own.
const Tile = ({ m, prop, disabled, styles, onToggle, onStyle }: { m: AutoModel; prop: Prop; disabled: boolean; styles: SelectOption<string>[]; onToggle(): void; onStyle(style: string): void }) => {
  const taken = !!m.taken;
  return (
    <div
      className="relative flex flex-col p-1.5 rounded-[8px] transition-colors"
      style={{ background: m.on ? 'var(--surface-3)' : 'var(--surface-2)', border: `1px solid ${m.on ? 'var(--hairline-focus)' : 'var(--hairline)'}`, opacity: taken ? 0.45 : 1 }}
    >
      <button
        type="button"
        aria-pressed={m.on}
        title={taken ? t('auto.taken', m.taken ?? '') : !m.own ? `${m.model} · ${t('auto.spare_hint')}` : m.model}
        disabled={disabled || taken}
        onClick={onToggle}
        className="flex flex-col text-left p-0 bg-transparent border-0 min-w-0"
      >
        <PropImage prop={prop} className="w-full rounded-[5px]" style={{ aspectRatio: '4 / 3', filter: m.on ? undefined : 'grayscale(1) brightness(0.7)' }} />
        <span className="block w-full mt-1.5 px-0.5 text-[11.5px] font-medium truncate" style={{ color: m.on ? 'var(--text-1)' : 'var(--text-3)' }}>
          {prop.label}
        </span>
        <span className="block w-full px-0.5 text-[10.5px] mono truncate" style={{ color: 'var(--text-4)' }}>
          {taken ? t('auto.taken', m.taken ?? '') : m.model}
        </span>
      </button>
      <div className="mt-1.5">
        <Select value={m.style ?? ''} options={styles} onChange={onStyle} width="100%" disabled={disabled || taken || !m.on} ariaLabel={t('auto.style_prop', prop.label)} />
      </div>
      {m.on && (
        <span className="absolute top-2.5 right-2.5 flex items-center justify-center w-4 h-4 rounded-full pointer-events-none" style={{ background: 'var(--text-1)', color: '#0c0d0f' }}>
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {!m.own && !m.on && (
        <span className="absolute top-2.5 left-2.5 pointer-events-none">
          <Badge>{t('auto.spare')}</Badge>
        </span>
      )}
    </div>
  );
};

const Card = ({ a, row, props, dim }: { a: AutoComputer; row?: Computer; props: Record<string, Prop>; dim: boolean }) => {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const edit = snapshot.canEdit;
  const on = a.models.filter(m => m.on).length;
  const jobs = Object.entries(row?.groups ?? {}).map(([job, grade]) => (grade > 0 ? `${job} ${grade}+` : job));
  const users = row?.users.length ?? 0;

  const named = (key: string) => snapshot.styles.find(s => s.key === key)?.name ?? key;
  const each: SelectOption<string>[] = snapshot.styles.map((s: OsStyle) => ({ value: s.key, label: s.name, hint: styleLike(s.key) || undefined }));
  // The computer's own: what the config gives it (or the server default), unless one is picked here.
  const forComputer: SelectOption<string>[] = [{ value: '', label: t('auto.style_default', named(a.base ?? snapshot.defaultStyle)), hint: styleLike(a.base ?? snapshot.defaultStyle) || undefined }, ...each];
  // A prop's: the computer's, unless it is given one of its own.
  const forProp: SelectOption<string>[] = [{ value: '', label: t('auto.style_follow') }, ...each];

  return (
    <div className="sc-card flex-shrink-0 transition-opacity" style={{ opacity: dim || !a.enabled ? 0.6 : 1 }}>
      <div className="flex items-center gap-2.5 pl-5 pr-4 h-12" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <span className="text-[13px] font-semibold truncate">{a.label}</span>
        <Select
          value={a.style ?? ''}
          options={forComputer}
          width={250}
          disabled={!edit || busy}
          ariaLabel={t('auto.style_computer', a.label)}
          onChange={style => void act('setautostyle', { key: a.key, style: style || null }, t('auto.toast_style', a.label, style ? named(style) : named(a.base ?? snapshot.defaultStyle)))}
        />
        {jobs.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11.5px] min-w-0" style={{ color: 'var(--text-2)' }} title={t('computers.locked_to', jobs.join(', '))}>
            <Lock size={11} className="flex-shrink-0" />
            <span className="truncate">{jobs.join(', ')}</span>
          </span>
        )}
        {users > 0 && <Status tone="ok">{t('computers.in_use_count', users)}</Status>}
        <span className="ml-auto mono text-[11.5px] flex-shrink-0" style={{ color: 'var(--text-3)' }}>
          {a.key} · {t('auto.props_on', on, a.models.length)}
        </span>
        <Switch
          on={a.enabled}
          label={a.label}
          disabled={!edit || busy}
          onChange={enabled => void act('setautocomputer', { key: a.key, enabled }, t(enabled ? 'auto.toast_computer_on' : 'auto.toast_computer_off', a.label))}
        />
      </div>
      <div className="px-4 pt-3 pb-4">
        <Hint className="mb-2.5 px-1">{t('auto.computer_hint', a.label)}</Hint>
        <div className="grid grid-cols-6 gap-2">
          {a.models.map(m => {
            const prop = props[m.model] ?? { model: m.model, label: m.model };
            return (
              <Tile
                key={m.model}
                m={m}
                prop={prop}
                disabled={!edit || busy}
                styles={forProp}
                onToggle={() => void act('setautomodel', { key: a.key, model: m.model, enabled: !m.on }, t(m.on ? 'auto.toast_prop_off' : 'auto.toast_prop_on', prop.label))}
                onStyle={style => void act('setautomodelstyle', { key: a.key, model: m.model, style: style || null }, t('auto.toast_style', prop.label, style ? named(style) : t('auto.style_follow')))}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// The props that are a computer on their own: the model computers of configs/shared/computers.lua
// ("every prop of these models is a computer"), with a switch for all of them, one for each, a tick
// for every prop, and the style each opens in - the computer's, or one of its own for a prop. What
// is changed here is kept in the database and wins over the file.
export const AutomaticTab = () => {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const auto = snapshot.auto;
  const props = Object.fromEntries(snapshot.props.map(p => [p.model, p]));
  const rows = Object.fromEntries(snapshot.computers.map(c => [c.key, c]));

  return (
    <ScrollArea className="h-full" viewClassName="flex flex-col px-6 py-5 gap-4">
      <Heading title={t('auto.title')} count={autoCount(auto)} />

      <div className="sc-card flex items-center gap-5 px-5 py-4 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">{t('auto.master')}</div>
          <Hint className="mt-1">{t('auto.master_hint')}</Hint>
        </div>
        <Switch on={auto.enabled} label={t('auto.master')} disabled={!snapshot.canEdit || busy} onChange={enabled => void act('setauto', { enabled }, t(enabled ? 'auto.toast_on' : 'auto.toast_off'))} />
      </div>

      {auto.computers.length === 0 ? <Empty text={t('auto.empty')} /> : auto.computers.map(a => <Card key={a.key} a={a} row={rows[a.key]} props={props} dim={!auto.enabled} />)}
    </ScrollArea>
  );
};
