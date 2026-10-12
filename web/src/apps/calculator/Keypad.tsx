import { Delete } from 'lucide-react';
import { t } from '@/i18n';
import { KEYPAD, UNLOCKED, type KeyDef } from './keys';

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/**
 * The 4 x 6 Standard keypad. Number keys sit on a brighter fill than operator keys (the extra
 * `bg-card` layer brightens in dark mode and whitens in light), "=" is the accent button. Keys
 * never take focus, so Enter can't double-fire a clicked key; `flash` lights the key a keyboard
 * press hit.
 */
export default function Keypad({ onKey, locked, flash, compact }: { onKey: (k: KeyDef) => void; locked: boolean; flash: string | null; compact: boolean }) {
  return (
    <div className="grid grid-cols-4 grid-rows-6 gap-[2px] flex-1 min-h-0 px-[3px] pb-[3px]">
      {KEYPAD.map(k => (
        <Key key={k.id} def={k} disabled={locked && !UNLOCKED.has(k.id)} pressed={flash === k.id} compact={compact} onPress={() => onKey(k)} />
      ))}
    </div>
  );
}

function Key({ def, disabled, pressed, compact, onPress }: { def: KeyDef; disabled: boolean; pressed: boolean; compact: boolean; onPress: () => void }) {
  const isEq = def.kind === 'eq';
  const isDigit = /^[0-9]$/.test(def.id);
  return (
    <button
      type="button"
      title={def.title ? t(`ui.calculator.key_${def.title}`) : undefined}
      aria-label={def.title ? t(`ui.calculator.key_${def.title}`) : def.label}
      disabled={disabled}
      tabIndex={-1}
      onMouseDown={e => e.preventDefault()}
      onClick={onPress}
      className={cx(
        'group relative overflow-hidden rounded-ctl flex items-center justify-center select-none transition-colors duration-150 min-h-0',
        'disabled:opacity-40 disabled:pointer-events-none',
        isEq
          ? cx('bg-accent hover:bg-accent-hover text-accent-on border border-transparent active:opacity-80', pressed && 'opacity-80')
          : cx('border border-stroke shadow-card text-t1 active:text-t2', def.kind === 'num' ? 'bg-control' : 'bg-control-hover', pressed && 'text-t2'),
      )}
    >
      {def.kind === 'num' && <span className="absolute inset-0 bg-card pointer-events-none" />}
      {!isEq && (
        <span className={cx('absolute inset-0 pointer-events-none group-hover:bg-subtle group-active:bg-transparent', pressed && 'bg-control-press')} />
      )}
      <span
        className={cx(
          'relative leading-none',
          isDigit ? cx('font-display font-semibold', compact ? 'text-[15px]' : 'text-[18px]') : compact ? 'text-[14px]' : 'text-[16px]',
          isEq && 'text-[20px]',
        )}
      >
        {def.id === 'back' ? <Delete size={compact ? 15 : 17} strokeWidth={1.5} /> : def.label}
      </span>
    </button>
  );
}
