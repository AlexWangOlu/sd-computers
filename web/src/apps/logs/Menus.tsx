import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Check } from 'lucide-react';
import { useExitFx } from '@/hooks/useExitFx';
import type { MenuItem } from './types';
import { cx } from './model';

/** A dropdown/context menu card. Picking an item closes it first, then runs the item. */
export function MenuList({ items, onClose, style, className }: { items: MenuItem[]; onClose: () => void; style?: CSSProperties; className?: string }) {
  const exitRef = useExitFx('pop-out');
  return (
    <div
      ref={exitRef}
      className={cx('absolute z-50 min-w-[210px] py-1 rounded-[6px] acrylic shadow-flyout text-[12px] pop-in origin-top', className)}
      style={style}
      onMouseDown={e => e.stopPropagation()}
      role="menu"
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="my-1 mx-2 h-px bg-stroke-strong" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick?.();
            }}
            className="w-full h-[26px] flex items-center gap-1.5 pl-1.5 pr-5 rounded-[4px] text-left text-t1 hover:bg-subtle disabled:text-tdis disabled:hover:bg-transparent"
          >
            <span className="w-4 flex justify-center shrink-0">{it.checked && <Check size={12} />}</span>
            <span className="truncate">{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

/** Closes `onClose` on any mousedown outside `ref` while `open`. */
export function useOutside(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open, ref]);
}

/** MMC's classic menu bar: click to open, hover to switch while one is open. */
export function MenuBar({ menus }: { menus: { key: string; label: string; items: MenuItem[] }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open !== null, () => setOpen(null));

  return (
    <div ref={ref} className="relative h-[24px] shrink-0 flex items-center px-1 bg-win text-[12px]">
      {menus.map(m => (
        <div key={m.key} className="relative">
          <button
            type="button"
            onClick={() => setOpen(o => (o === m.key ? null : m.key))}
            onMouseEnter={() => open && open !== m.key && setOpen(m.key)}
            className={cx('h-[22px] px-2 rounded-[3px] text-t1', open === m.key ? 'bg-control-press' : 'hover:bg-subtle')}
          >
            {m.label}
          </button>
          {open === m.key && <MenuList items={m.items} onClose={() => setOpen(null)} style={{ left: 0, top: 23 }} />}
        </div>
      ))}
    </div>
  );
}
