// A modal bevelled message box (About, Run, the Log On dialog, errors), centred in whatever
// positioned container it is rendered in. Snaps open through the same chunky zoom steps as windows.
// Escape = onClose, Enter = the default button. Keys handled here never reach the OS-level
// handler (whose Escape would otherwise stand the player up).
import type { KeyboardEvent, ReactNode } from 'react';
import { GlyphSys } from './glyphs';

export interface MsgButton {
  label: string;
  onClick: () => void;
  /** The default button: bold black frame, focused on open, pressed by Enter. */
  primary?: boolean;
  disabled?: boolean;
}

interface Props {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  buttons?: MsgButton[];
  onClose?: () => void;
  width?: number;
  /** Extra class on the window (e.g. 'is-busy'). */
  className?: string;
  /** Don't dim/catch clicks behind it (a dialog that IS the screen, like Log On). */
  bare?: boolean;
}

export default function MessageBox({ title, icon, children, buttons, onClose, width = 380, className, bare }: Props) {
  const primary = buttons?.find(b => b.primary && !b.disabled);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onClose?.();
      return;
    }
    if (e.key === 'Enter') {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'BUTTON' || tag === 'TEXTAREA') return;
      e.stopPropagation();
      e.preventDefault();
      primary?.onClick();
    }
  };

  return (
    <div
      className={`rt-dlg-shade${bare ? ' is-bare' : ''}`}
      onPointerDown={e => e.stopPropagation()}
      // A click on the shade must not pull focus out of the box (Escape would then reach the OS).
      onMouseDown={e => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div className={`rt-win is-active rt-dlg${className ? ` ${className}` : ''}`} style={{ width }} role="dialog" aria-label={title} onKeyDown={onKeyDown}>
        <div className="rt-win-inner">
          <div className="rt-title">
            <button
              type="button"
              tabIndex={-1}
              className="rt-sysbtn rt-ctlbox"
              aria-label={title}
              onDoubleClick={() => onClose?.()}
            >
              <GlyphSys />
            </button>
            <span className="rt-title-text">{title}</span>
          </div>
          <div className="rt-dlg-body">
            {icon && <div className="rt-dlg-icon">{icon}</div>}
            <div className="rt-dlg-text">{children}</div>
          </div>
          {buttons && buttons.length > 0 && (
            <div className="rt-dlg-btns">
              {buttons.map(b => (
                <button
                  key={b.label}
                  type="button"
                  className={`rt-btn${b.primary ? ' is-default' : ''}`}
                  autoFocus={b.primary}
                  disabled={b.disabled}
                  onClick={b.onClick}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A strip of loading blocks (splash, welcome, shutdown). */
export function LoadBlocks({ count, filled, className }: { count: number; filled: number; className?: string }) {
  return (
    <div className={`rt-blocks${className ? ` ${className}` : ''}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i < filled ? 'is-on' : ''} />
      ))}
    </div>
  );
}
