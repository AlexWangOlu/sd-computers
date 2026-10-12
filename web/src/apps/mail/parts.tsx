import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Button, IconButton } from '@/ui/controls';
import { useExitFx } from '@/hooks/useExitFx';
import { cx, initials, personaColor } from './util';

/** Round initials avatar in the person's Fluent persona colour. */
export function Persona({ name, email, size = 32 }: { name: string; email: string; size?: number }) {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center rounded-full shrink-0 font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), background: personaColor(email || name), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}
    >
      {initials(name, email)}
    </div>
  );
}

/**
 * A Fluent menu flyout positioned by the caller (className). Closes on outside press or Escape;
 * presses on `anchor` are ignored so its own toggle keeps working.
 */
export function Flyout({ onClose, anchor, className, children }: { onClose: () => void; anchor?: RefObject<HTMLElement | null>; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const exitRef = useExitFx('pop-out');
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      exitRef(el);
    },
    [exitRef],
  );
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const down = (e: MouseEvent) => {
      const n = e.target as Node;
      if (ref.current?.contains(n) || anchor?.current?.contains(n)) return;
      close.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('mousedown', down, true);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down, true);
      window.removeEventListener('keydown', key);
    };
  }, [anchor]);
  return (
    <div ref={setRef} className={cx('absolute z-30 acrylic rounded-win shadow-flyout py-1 pop-in origin-top', className)} onClick={e => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function MenuRow({ icon, label, onClick, trailing, disabled }: { icon?: ReactNode; label: ReactNode; onClick: () => void; trailing?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-[calc(100%-8px)] mx-1 flex items-center gap-3 min-h-9 px-3 py-1.5 rounded-ctl text-body text-t1 text-left hover:bg-subtle disabled:opacity-40 disabled:pointer-events-none"
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0">{label}</span>
      {trailing}
    </button>
  );
}

export const MenuSeparator = () => <div className="h-px bg-stroke my-1 mx-2" />;

/** Toolbar command: icon + label when there's room, icon-only (with tooltip) when there isn't. */
export function ToolButton({ icon, label, onClick, showLabel, disabled }: { icon: ReactNode; label: string; onClick: () => void; showLabel: boolean; disabled?: boolean }) {
  if (!showLabel) {
    return (
      <IconButton title={label} onClick={onClick} disabled={disabled} className="shrink-0">
        {icon}
      </IconButton>
    );
  }
  return (
    <Button variant="subtle" icon={icon} onClick={onClick} disabled={disabled} title={label} className="shrink-0 px-2.5">
      {label}
    </Button>
  );
}

export const ToolSeparator = () => <div className="w-px h-5 bg-stroke mx-1 shrink-0" />;

/** Fluent SelectorBar / pivot: text tabs with an accent pill under the selected one. */
export function Pivot<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div role="tablist" className="flex items-center gap-1">
      {items.map(it => {
        const sel = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => onChange(it.key)}
            className={cx('relative h-9 px-3 rounded-ctl text-body transition-colors duration-150 hover:bg-subtle', sel ? 'text-t1 font-semibold' : 'text-t2')}
          >
            {it.label}
            <span className={cx('absolute left-1/2 -translate-x-1/2 bottom-0.5 h-[3px] rounded-full bg-accent transition-all duration-150', sel ? 'w-4 opacity-100' : 'w-0 opacity-0')} />
          </button>
        );
      })}
    </div>
  );
}
