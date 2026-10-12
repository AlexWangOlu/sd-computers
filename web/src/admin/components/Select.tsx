import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useEscape } from './shared';
import { ScrollArea } from './ScrollArea';

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
  hint?: string;
  icon?: ReactNode;
  group?: string;
  disabled?: boolean;
}

interface Props<V extends string | number> {
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  leading?: ReactNode;
  placeholder?: string;
  width?: number | string;
  disabled?: boolean;
  ariaLabel?: string;
}

const MENU_MAX = 280;
const GAP = 6;

export function Select<V extends string | number>({ value, options, onChange, leading, placeholder, width, disabled, ariaLabel }: Props<V>) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="sc-select"
        data-open={open}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={{ width }}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {leading && <span className="sc-select__lead">{leading}</span>}
        {current?.icon && <span className="sc-select__icon">{current.icon}</span>}
        <span className="sc-select__value" data-placeholder={!current}>
          {current?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown size={14} className="sc-select__chevron" />
      </button>
      {open && trigger.current && <Menu anchor={trigger.current} options={options} value={value} onPick={v => { onChange(v); close(); }} onClose={close} />}
    </>
  );
}

function Menu<V extends string | number>({
  anchor,
  options,
  value,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  options: SelectOption<V>[];
  value: V;
  onPick: (value: V) => void;
  onClose: (refocus?: boolean) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex(o => o.value === value)));
  const typed = useRef({ text: '', at: 0 });

  useEscape(() => onClose());

  const place = useCallback(() => {
    const r = anchor.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < Math.min(MENU_MAX, (menu.current?.scrollHeight ?? MENU_MAX) + GAP * 2) && r.top > below;
    setPos({ left: r.left, top: up ? r.top - GAP : r.bottom + GAP, width: Math.max(r.width, 160), up });
  }, [anchor]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (menu.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      onClose(false);
    };
    const moved = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, onClose, place]);

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, pos]);

  useEffect(() => {
    const step = (from: number, dir: 1 | -1) => {
      for (let i = 1; i <= options.length; i++) {
        const next = (from + dir * i + options.length) % options.length;
        if (!options[next].disabled) return next;
      }
      return from;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') setActive(a => step(a, 1));
      else if (e.key === 'ArrowUp') setActive(a => step(a, -1));
      else if (e.key === 'Home') setActive(step(-1, 1));
      else if (e.key === 'End') setActive(step(options.length, -1));
      else if (e.key === 'Enter' || e.key === ' ') {
        const o = options[active];
        if (o && !o.disabled) onPick(o.value);
      } else if (e.key === 'Tab') {
        onClose(false);
        return;
      } else if (e.key.length === 1 && /\S/.test(e.key)) {
        const now = Date.now();
        typed.current.text = (now - typed.current.at > 700 ? '' : typed.current.text) + e.key.toLowerCase();
        typed.current.at = now;
        const hit = options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
        if (hit >= 0) setActive(hit);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [options, active, onPick, onClose]);

  return createPortal(
    <ScrollArea
      rootRef={menu}
      role="listbox"
      className="sc-menu"
      fade={false}
      rootAttrs={{ 'data-up': pos?.up }}
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        minWidth: pos?.width,
        maxWidth: Math.max(pos?.width ?? 0, 320),
        transform: pos?.up ? 'translateY(-100%)' : undefined,
        maxHeight: MENU_MAX,
      }}
    >
      {options.map((o, i) => (
        <div key={String(o.value)}>
          {o.group && o.group !== options[i - 1]?.group && <div className="sc-menu__group">{o.group}</div>}
          <div
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled}
            data-index={i}
            data-active={i === active}
            className="sc-menu__item"
            onMouseEnter={() => !o.disabled && setActive(i)}
            onMouseDown={e => e.preventDefault()}
            onClick={() => !o.disabled && onPick(o.value)}
          >
            {o.icon && <span className="sc-select__icon">{o.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.label}</span>
              {o.hint && <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>{o.hint}</span>}
            </span>
            <Check size={13} className="shrink-0" style={{ opacity: o.value === value ? 1 : 0, color: 'var(--text-1)' }} />
          </div>
        </div>
      ))}
    </ScrollArea>,
    document.body,
  );
}
