import type { InputHTMLAttributes, ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { Button, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { t } from '@/i18n';
import type { Notice } from './hooks';
import { initials } from './util';

// Small building blocks shared by the Business Manager pages. Colours come only from theme tokens.

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Page title row (WinUI "header"): title + optional subtitle, actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-x-4 gap-y-2 flex-wrap mb-5">
      <div className="min-w-0">
        <h1 className="font-display text-title font-semibold text-t1 truncate">{title}</h1>
        {subtitle && <div className="text-body text-t2 mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Standard Refresh button; the glyph spins while a fetch is in flight. */
export function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <Button icon={<RefreshCw size={16} className={loading ? 'spin' : ''} />} onClick={onClick} disabled={loading}>
      {t('ui.common.refresh')}
    </Button>
  );
}

/** A card surface with an optional header row. */
export function Panel({ title, caption, actions, children, className, bodyClass }: { title?: ReactNode; caption?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('rounded-win bg-card border border-stroke shadow-card min-w-0', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 flex-wrap px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-body font-semibold text-t1">{title}</h2>}
            {caption && <div className="text-caption text-t2 mt-0.5">{caption}</div>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      )}
      <div className={bodyClass ?? 'px-5 pb-5 pt-3'}>{children}</div>
    </section>
  );
}

/** Dashboard stat tile. */
export function StatCard({ icon, label, value, caption, muted, onClick }: { icon: ReactNode; label: ReactNode; value: ReactNode; caption?: ReactNode; muted?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'rounded-win bg-card border border-stroke shadow-card p-4 flex flex-col gap-2 min-w-0 transition-colors duration-150',
        onClick && 'cursor-pointer hover:bg-card-hover',
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-8 h-8 rounded-ctl shrink-0 flex items-center justify-center bg-[var(--accent-soft)] text-accent-text">{icon}</span>
        <span className="text-body text-t2 truncate">{label}</span>
      </div>
      <div className={cx('font-display font-semibold truncate tabular-nums mt-1', muted ? 'text-subtitle text-t3' : 'text-title text-t1')}>{value}</div>
      {caption && <div className="text-caption text-t3 truncate">{caption}</div>}
    </div>
  );
}

/** Round initials avatar tinted with the accent. */
export function Initials({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="shrink-0 rounded-full flex items-center justify-center font-semibold bg-[var(--accent-soft)] text-accent-text select-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

export function YouChip() {
  return (
    <span className="shrink-0 h-5 px-2 rounded-full text-[11px] font-semibold inline-flex items-center bg-[var(--accent-soft)] text-accent-text">
      {t('ui.boss.you')}
    </span>
  );
}

/** Green dot = on duty, grey dot = online, hollow ring = offline. */
export function StatusPill({ online, onDuty }: { online: boolean; onDuty: boolean }) {
  const dot = onDuty ? 'bg-success' : online ? 'bg-t3' : 'border-[1.5px] border-[var(--text-3)]';
  const label = onDuty ? t('ui.boss.status_on_duty') : online ? t('ui.boss.status_online') : t('ui.boss.status_offline');
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cx('w-2 h-2 rounded-full shrink-0', dot)} />
      <span className={onDuty ? 'text-t1' : 'text-t2'}>{label}</span>
    </span>
  );
}

/** Filter chip (Fluent "pill" toggle). */
export function Chip({ selected, onClick, children, count }: { selected: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'h-7 px-3 rounded-full text-caption border inline-flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap',
        selected ? 'bg-accent text-accent-on border-transparent font-semibold' : 'bg-control border-stroke-strong text-t1 hover:bg-control-hover',
      )}
    >
      {children}
      {count !== undefined && <span className="opacity-70 tabular-nums">{count}</span>}
    </button>
  );
}

/** Money in (arrow down-left, success) / out (arrow up-right, critical). */
export function TxIcon({ delta, size = 32 }: { delta: number; size?: number }) {
  return (
    <span className="shrink-0 rounded-full bg-subtle border border-stroke flex items-center justify-center" style={{ width: size, height: size }}>
      {delta < 0 ? <ArrowUpRight size={16} className="text-critical" /> : <ArrowDownLeft size={16} className="text-success" />}
    </span>
  );
}

export function Notices({ list, onClose }: { list: Notice[]; onClose: (id: number) => void }) {
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mb-4">
      {list.map(n => (
        <div key={n.id} className="fade-in">
          <InfoBar severity={n.severity} title={n.title} onClose={() => onClose(n.id)}>
            {n.text}
          </InfoBar>
        </div>
      ))}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="h-full min-h-[200px] w-full flex flex-col items-center justify-center gap-3 text-caption text-t2">
      <Spinner size={28} />
      {t('ui.common.loading')}
    </div>
  );
}

/** Full-page load failure with a Retry. */
export function ErrorState({ message, onRetry, loading }: { message: string; onRetry: () => void; loading?: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3 max-w-[560px]">
      <div className="w-full">
        <InfoBar severity="error" title={t('ui.boss.load_failed')}>
          {message}
        </InfoBar>
      </div>
      <Button icon={loading ? <Spinner size={14} /> : <RefreshCw size={16} />} onClick={onRetry} disabled={loading}>
        {t('ui.common.retry')}
      </Button>
    </div>
  );
}

/** Whole-dollar amount box with a "$" prefix; keeps only digits. */
export function MoneyInput({ value, onChange, invalid, ...rest }: { value: string; onChange: (digits: string) => void; invalid?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-body text-t2 pointer-events-none">$</span>
      <TextInput
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 10))}
        inputMode="numeric"
        autoComplete="off"
        className={cx('pl-6 tabular-nums', invalid && '!border-b-[var(--critical)]')}
        {...rest}
      />
    </div>
  );
}
