import type { RefObject } from 'react';
import { X } from 'lucide-react';
import { t } from '@/i18n';
import { Persona } from './parts';
import { cx, isValidAddress, normalizeAddress, splitAddresses, uniq } from './util';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  /** Text typed but not yet turned into a chip (the composer folds it in on send). */
  pending: string;
  onPending: (s: string) => void;
  max: number;
  domain: string;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Called when an add would go past `max`. */
  onLimit: () => void;
  disabled?: boolean;
}

/**
 * Outlook-style recipient well: type an address and press Enter, comma, semicolon or Tab to turn it
 * into a chip; Backspace on an empty box removes the last chip; double-click a chip to edit it.
 * Bare usernames get @domain, exactly as the server would.
 */
export default function RecipientField({ value, onChange, pending, onPending, max, domain, inputRef, onLimit, disabled }: Props) {
  const commit = (text: string) => {
    const parts = splitAddresses(text).map(a => normalizeAddress(a, domain)).filter(Boolean);
    onPending('');
    if (parts.length === 0) return;
    const next = uniq([...value, ...parts]);
    if (next.length > max) onLimit();
    onChange(next.slice(0, max));
  };

  const remove = (addr: string) => onChange(value.filter(a => a !== addr));

  const full = value.length >= max;

  return (
    <div
      onMouseDown={e => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }}
      className={cx(
        'flex flex-wrap items-center gap-1 min-h-8 px-1 py-[3px] rounded-ctl bg-[var(--input)] border border-stroke-strong border-b-[var(--text-3)] cursor-text transition-colors duration-150',
        'focus-within:bg-[var(--input-focus)] focus-within:border-b-2 focus-within:border-b-[var(--accent-fill)]',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      {value.map(a => {
        const ok = isValidAddress(a);
        return (
          <span
            key={a}
            title={ok ? a : t('ui.mail.invalid_address', a)}
            onDoubleClick={() => {
              remove(a);
              onPending(a);
              inputRef.current?.focus();
            }}
            className={cx(
              'inline-flex items-center gap-1.5 h-6 max-w-full pl-0.5 pr-0.5 rounded-full border text-body select-none',
              ok ? 'bg-card border-stroke-strong text-t1' : 'bg-transparent border-[var(--critical)] text-critical',
            )}
          >
            <Persona name={a} email={a} size={20} />
            <span className="truncate max-w-[220px]">{a}</span>
            <button
              type="button"
              tabIndex={-1}
              title={t('ui.mail.remove_recipient', a)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => remove(a)}
              className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-t2 hover:bg-subtle hover:text-t1"
            >
              <X size={12} />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        value={pending}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        placeholder={value.length === 0 ? t('ui.mail.to_placeholder', domain) : full ? t('ui.mail.recipients_full') : ''}
        onChange={e => {
          const v = e.target.value;
          if (/[,;]/.test(v)) commit(v);
          else onPending(v);
        }}
        onPaste={e => {
          const text = e.clipboardData.getData('text');
          if (/[,;\s]/.test(text.trim())) {
            e.preventDefault();
            commit(pending + text);
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (e.ctrlKey || e.metaKey) return; // Ctrl+Enter sends (the composer folds `pending` in)
            e.preventDefault();
            if (pending.trim()) commit(pending);
          } else if (e.key === 'Tab') {
            if (pending.trim()) commit(pending);
          } else if (e.key === 'Backspace' && pending === '' && value.length > 0) {
            e.preventDefault();
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (pending.trim()) commit(pending);
        }}
        className="flex-1 min-w-[120px] h-6 px-1.5 bg-transparent outline-none border-0 text-body text-t1 placeholder:text-t3"
      />
    </div>
  );
}
