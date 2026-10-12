// Drop-down menus: the shell's top menu bar and the windows' control menu share one dropdown.
// Click opens; while a bar menu is open, hovering a sibling switches to it (real menu bars do
// that). Click-away and Escape close. Ported from frp_mdt's MenuBar.
import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { retroSfx } from './sounds';

export type MenuEntry = { label: ReactNode; accel?: string; disabled?: boolean; checked?: boolean; action: () => void } | 'sep';

export interface MenuDef {
  key: string;
  /** What the bar shows (text, or the system menu's mark). */
  title: ReactNode;
  label: string;
  entries: MenuEntry[];
}

/** Close on a press outside `ref` (capture phase, before anything else reacts) or on Escape. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, active: boolean, onClose: () => void): void {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cb.current();
      }
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [active, ref]);
}

/** The dropdown list itself (positioned by the caller). */
export function MenuDrop({ entries, onDone, className, style }: { entries: MenuEntry[]; onDone: () => void; className?: string; style?: React.CSSProperties }) {
  const hasChecks = entries.some(e => e !== 'sep' && e.checked !== undefined);
  return (
    <div className={`rt-menu${className ? ` ${className}` : ''}`} style={style} role="menu" onPointerDown={e => e.stopPropagation()}>
      {entries.map((e, i) =>
        e === 'sep' ? (
          <hr key={i} />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className="rt-mi"
            disabled={e.disabled}
            onClick={() => {
              retroSfx.click();
              onDone();
              e.action();
            }}
          >
            {hasChecks && <span className="rt-mi-check">{e.checked ? '✓' : ''}</span>}
            <span className="rt-mi-label">{e.label}</span>
            {e.accel && <span className="rt-mi-accel">{e.accel}</span>}
          </button>
        ),
      )}
    </div>
  );
}

/** The shell's menu bar. `open` is controlled (index of the open menu, or null). */
export function MenuBar({ menus, open, setOpen, trailing }: { menus: MenuDef[]; open: number | null; setOpen: (i: number | null) => void; trailing?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open !== null, () => setOpen(null));
  return (
    <div ref={ref} className="rt-menubar" role="menubar">
      {menus.map((m, i) => (
        <Fragment key={m.key}>
          <div className="rt-menubar-slot">
            <button
              type="button"
              aria-label={m.label}
              title={m.label}
              className={`rt-menubar-item${open === i ? ' is-open' : ''}${m.key === 'system' ? ' is-system' : ''}`}
              onClick={() => {
                retroSfx.click();
                setOpen(open === i ? null : i);
              }}
              onMouseEnter={() => {
                if (open !== null && open !== i) setOpen(i);
              }}
            >
              {m.title}
            </button>
            {open === i && <MenuDrop entries={m.entries} onDone={() => setOpen(null)} className="rt-menu-drop" />}
          </div>
        </Fragment>
      ))}
      {trailing && <div className="rt-menubar-trailing">{trailing}</div>}
    </div>
  );
}
