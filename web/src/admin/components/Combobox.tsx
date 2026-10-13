import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useEscape } from './shared';
import { ScrollArea } from './ScrollArea';

export interface ComboOption {
  value: string; // what picking it writes into the field
  label: string;
  hint?: string;
}

interface Props {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

const MENU_MAX = 280;
const GAP = 6;

// (spaces never count: "law firm" finds "Law Firm" in a field that takes no spaces itself)
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

// Whether an option is one the typed text could still become: it is part of its label, or of its value.
export const matches = (o: ComboOption, text: string) => norm(o.label).includes(norm(text)) || norm(o.value).includes(norm(text));

// A text field that suggests: anything can be typed into it, and `options` are offered under it to pick from instead
// (picking one writes its value). The list is all of them when the field is opened, and narrows to what matches - by
// label or by value - once something is typed. It looks and behaves like the Select beside it, whose menu styles it uses.
export function Combobox({ value, options, onChange, placeholder, maxLength, disabled, ariaLabel }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // something was typed since it opened: the list narrows to it
  const [active, setActive] = useState(-1); // (nothing until an arrow key or the pointer says so: Enter keeps what was typed)

  const shown = typed && norm(value) ? options.filter(o => matches(o, value)) : options;

  const close = useCallback(() => {
    setOpen(false);
    setTyped(false);
    setActive(-1);
  }, []);

  const pick = (o: ComboOption) => {
    onChange(o.value);
    close();
  };

  return (
    <div ref={box} className="relative">
      <input
        ref={input}
        className="sc-input"
        style={{ paddingRight: 30 }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
          setTyped(true);
          setActive(-1);
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) setOpen(true);
            else if (shown.length) setActive(a => (e.key === 'ArrowDown' ? Math.min(shown.length - 1, a + 1) : Math.max(0, a - 1)));
          } else if (e.key === 'Enter' && open) {
            e.preventDefault();
            if (shown[active]) pick(shown[active]);
            else close();
          } else if (e.key === 'Tab') close();
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="absolute top-0 right-0 flex items-center justify-center h-full p-0 bg-transparent border-0"
        style={{ width: 30, color: 'var(--text-3)' }}
        disabled={disabled}
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          if (open) return close();
          input.current?.focus();
          setOpen(true);
        }}
      >
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.18s var(--ease)' }} />
      </button>
      {open && shown.length > 0 && box.current && <Suggestions anchor={box.current} options={shown} value={value} active={active} onActive={setActive} onPick={pick} onClose={close} />}
    </div>
  );
}

function Suggestions({
  anchor,
  options,
  value,
  active,
  onActive,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  options: ComboOption[];
  value: string;
  active: number;
  onActive: (index: number) => void;
  onPick: (option: ComboOption) => void;
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);

  useEscape(onClose);

  const place = useCallback(() => {
    const r = anchor.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < Math.min(MENU_MAX, (menu.current?.scrollHeight ?? MENU_MAX) + GAP * 2) && r.top > below;
    setPos({ left: r.left, top: up ? r.top - GAP : r.bottom + GAP, width: r.width, up });
  }, [anchor]);

  // (again whenever the list gets shorter or longer: one that opens upwards hangs from its bottom edge)
  useLayoutEffect(place, [place, options.length]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (menu.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      onClose();
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
        <div
          key={o.value}
          role="option"
          aria-selected={o.value === value}
          data-index={i}
          data-active={i === active}
          className="sc-menu__item"
          onMouseEnter={() => onActive(i)}
          onMouseDown={e => e.preventDefault()}
          onClick={() => onPick(o)}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">{o.label}</span>
            {o.hint && (
              <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                {o.hint}
              </span>
            )}
          </span>
          <Check size={13} className="shrink-0" style={{ opacity: o.value === value ? 1 : 0, color: 'var(--text-1)' }} />
        </div>
      ))}
    </ScrollArea>,
    document.body,
  );
}
