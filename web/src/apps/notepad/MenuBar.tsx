import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useExitFx } from '@/hooks/useExitFx';

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

export type MenuEntry =
  | { kind: 'item'; label: string; accel?: string; onClick: () => void; disabled?: boolean; checked?: boolean }
  | { kind: 'sep' }
  | { kind: 'sub'; label: string; items: MenuEntry[] };

export interface MenuDef {
  id: string;
  label: string;
  items: MenuEntry[];
}

/**
 * Notepad's File / Edit / View row with Fluent flyout menus. Like Windows: click opens, hovering
 * another title while one is open switches to it, Escape / click-away closes. Nothing here takes
 * focus (mousedown is swallowed), so the editor keeps its caret and selection for Cut/Copy/Paste.
 */
export default function MenuBar({ menus, children }: { menus: MenuDef[]; children?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(null);
      }
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="shrink-0 h-10 flex items-center gap-0.5 px-1.5 bg-layer border-b border-stroke" onMouseDown={e => e.preventDefault()}>
      {menus.map(m => (
        <div key={m.id} className="relative">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen(o => (o === m.id ? null : m.id))}
            onMouseEnter={() => open && open !== m.id && setOpen(m.id)}
            className={cx('h-8 px-2.5 rounded-ctl text-body text-t1 transition-colors duration-150 hover:bg-subtle', open === m.id && 'bg-subtle')}
          >
            {m.label}
          </button>
          {open === m.id && <Flyout items={m.items} onDone={() => setOpen(null)} className="left-0 top-full mt-1" />}
        </div>
      ))}
      <span className="flex-1" />
      {children}
    </div>
  );
}

function Flyout({ items, onDone, className }: { items: MenuEntry[]; onDone: () => void; className: string }) {
  const [sub, setSub] = useState<number | null>(null);
  const hasChecks = items.some(i => i.kind === 'item' && i.checked !== undefined);
  const exitRef = useExitFx('pop-out');
  return (
    <div ref={exitRef} className={cx('absolute z-30 min-w-[248px] py-1 acrylic rounded-win shadow-flyout pop-in origin-top-left', className)} role="menu">
      {items.map((it, i) => {
        if (it.kind === 'sep') return <div key={i} className="h-px bg-stroke my-1 mx-1" />;
        if (it.kind === 'sub') {
          return (
            <div key={i} className="relative" onMouseEnter={() => setSub(i)}>
              <div className={cx('mx-1 h-8 px-3 flex items-center gap-3 rounded-ctl text-body text-t1 cursor-default', sub === i && 'bg-subtle')}>
                {hasChecks && <span className="w-4" />}
                <span className="flex-1">{it.label}</span>
                <ChevronRight size={14} className="text-t2" />
              </div>
              {sub === i && <Flyout items={it.items} onDone={onDone} className="left-full -top-1 -ml-1" />}
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={it.disabled}
            onMouseEnter={() => setSub(null)}
            onClick={() => {
              onDone();
              it.onClick();
            }}
            className="w-[calc(100%-8px)] mx-1 h-8 px-3 flex items-center gap-3 rounded-ctl text-body text-t1 text-left hover:bg-subtle active:bg-control-press disabled:text-tdis disabled:pointer-events-none"
          >
            {hasChecks && <span className="w-4 flex items-center justify-center">{it.checked && <Check size={14} />}</span>}
            <span className="flex-1 whitespace-nowrap">{it.label}</span>
            {it.accel && <span className="ml-8 text-caption text-t3 whitespace-nowrap">{it.accel}</span>}
          </button>
        );
      })}
    </div>
  );
}
