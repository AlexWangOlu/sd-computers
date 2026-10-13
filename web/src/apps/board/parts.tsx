import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, InfoBar, Spinner } from '@/ui/controls';
import { t } from '@/i18n';
import type { Notice } from './hooks';
import { initials } from './util';

// Small building blocks shared by the Company Board pages. Colours come only from theme tokens.

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Page title row: title + optional subtitle, actions on the right (they wrap under it when narrow). */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-x-4 gap-y-2 flex-wrap mb-5">
      <div className="min-w-0">
        <h1 className="font-display text-title font-semibold text-t1 truncate">{title}</h1>
        {subtitle && <div className="text-body text-t2 mt-0.5 truncate">{subtitle}</div>}
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
      {t('ui.board.you')}
    </span>
  );
}

/** Green dot = on duty, grey dot = online, hollow ring = offline. */
export function StatusDot({ status }: { status: 'duty' | 'online' | 'offline' }) {
  const look = status === 'duty' ? 'bg-success' : status === 'online' ? 'bg-t3' : 'border-[1.5px] border-[var(--text-3)]';
  return <span className={cx('w-2 h-2 rounded-full shrink-0', look)} />;
}

/** The page's InfoBar stack. `className` is the room it leaves around itself (nothing while empty). */
export function Notices({ list, onClose, className = 'mb-4' }: { list: Notice[]; onClose: (id: number) => void; className?: string }) {
  if (list.length === 0) return null;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
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
        <InfoBar severity="error" title={t('ui.board.load_failed')}>
          {message}
        </InfoBar>
      </div>
      <Button icon={loading ? <Spinner size={14} /> : <RefreshCw size={16} />} onClick={onRetry} disabled={loading}>
        {t('ui.common.retry')}
      </Button>
    </div>
  );
}
