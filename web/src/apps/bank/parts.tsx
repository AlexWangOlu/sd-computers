import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

// Small building blocks of the Bank page. Colours come only from theme tokens, and the card
// surface carries the kit's `ctl-card` marker so the retro and mac styles re-skin it like a Card.

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** A card surface with an optional header row (title + caption, actions on the right). */
export function Panel({ title, caption, actions, children, className, bodyClass }: { title?: ReactNode; caption?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('ctl-card rounded-win bg-card border border-stroke shadow-card min-w-0', className)}>
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

/** A labelled figure in the summary card (cash, money in, money out). */
export function Figure({ label, value, tone = 'text-t1' }: { label: ReactNode; value: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-caption text-t2 whitespace-nowrap">{label}</div>
      <div className={cx('text-subtitle font-semibold tabular-nums whitespace-nowrap', tone)}>{value}</div>
    </div>
  );
}

/** Filter chip (a pill toggle) with the number of lines it would show. */
export function Chip({ selected, onClick, children, count }: { selected: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'h-7 px-3 rounded-full text-caption border inline-flex items-center gap-1.5 whitespace-nowrap',
        selected ? 'bg-accent text-accent-on border-transparent font-semibold' : 'bg-control border-stroke-strong text-t1 hover:bg-control-hover',
      )}
    >
      {children}
      {count !== undefined && <span className="opacity-70 tabular-nums">{count}</span>}
    </button>
  );
}

/** Money in (arrow down-left, success) / out (arrow up-right, critical). */
export function TxIcon({ delta, size = 24 }: { delta: number; size?: number }) {
  return (
    <span className="shrink-0 rounded-full bg-subtle border border-stroke flex items-center justify-center" style={{ width: size, height: size }}>
      {delta < 0 ? <ArrowUpRight size={16} className="text-critical" /> : <ArrowDownLeft size={16} className="text-success" />}
    </span>
  );
}
