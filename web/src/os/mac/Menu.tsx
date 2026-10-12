import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Check } from 'lucide-react';
import { useExitFx } from '@/hooks/useExitFx';

export type MenuEntry =
  | { sep: true }
  | {
      sep?: false;
      label: ReactNode;
      onSelect?: () => void;
      disabled?: boolean;
      /** Right-aligned shortcut hint. */
      shortcut?: string;
      /** Leading mark: a tick (current) or a diamond (minimized window). */
      mark?: 'check' | 'diamond';
    };

/**
 * A Harbor drop-down / context menu panel. Items keep keyboard focus where it was (mousedown is
 * swallowed) so Edit > Copy etc. act on the app's text field; picking one closes the menu first,
 * then runs it.
 */
export function MenuPanel({ items, onClose, className, style, menuRef }: { items: MenuEntry[]; onClose: () => void; className?: string; style?: CSSProperties; menuRef?: RefObject<HTMLDivElement | null> }) {
  const marks = items.some(it => !it.sep && it.mark);
  const exitRef = useExitFx('pop-out');
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (menuRef) menuRef.current = el;
      exitRef(el);
    },
    [menuRef, exitRef],
  );
  return (
    <div ref={setRef} role="menu" className={`mac-menu mac-pop ${className ?? ''}`} style={style} onMouseDown={e => e.stopPropagation()}>
      {items.map((it, i) =>
        it.sep ? (
          <div key={i} className="mac-menu-sep" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            className="mac-menu-item"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              onClose();
              it.onSelect?.();
            }}
          >
            {marks && (
              <span className="mac-menu-mark">
                {it.mark === 'check' ? <Check size={12} strokeWidth={2.6} /> : it.mark === 'diamond' ? <span className="text-[8px] leading-none">{'◆'}</span> : null}
              </span>
            )}
            <span className="flex-1 min-w-0 truncate">{it.label}</span>
            {it.shortcut && <span className="mac-menu-shortcut">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

/**
 * While `open`: Escape closes (caught in the capture phase, so the OS-level Escape - which stands
 * the player up from an empty desktop - never sees it) and a mousedown outside `ref` closes.
 */
export function useDismiss(open: boolean, onClose: () => void, ref?: RefObject<HTMLElement | null>): void {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cb.current();
    };
    const down = (e: MouseEvent) => {
      if (ref?.current && ref.current.contains(e.target as Node)) return;
      cb.current();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('mousedown', down, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('mousedown', down, true);
    };
  }, [open, ref]);
}
