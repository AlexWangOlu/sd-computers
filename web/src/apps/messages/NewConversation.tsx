import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { t } from '@/i18n';
import { IconButton, InfoBar, TextInput } from '@/ui/controls';
import { Avatar } from './parts';
import { cancelNew, startConversation, useMessages } from './store';
import type { Contact } from './types';
import { cx, digitsOf, fmtPhone, looksLikeNumber } from './util';

/** Fewest digits worth offering as "Text <number>". */
const MIN_DIGITS = 3;

type Option = { kind: 'number'; digits: string } | { kind: 'contact'; contact: Contact };

const optionKey = (o: Option): string => (o.kind === 'number' ? `n:${o.digits}` : `c:${o.contact.id}:${o.contact.phone}`);

/**
 * "New message": a To field that suggests the phone's contacts by name or number. Picking one, or
 * typing a number, opens the existing 1:1 thread with it - or an empty draft the first send creates.
 */
export default function NewConversation({ onBack }: { onBack?: () => void }) {
  const contacts = useMessages(s => s.contacts);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(h);
  }, []);

  const query = q.trim();
  const numeric = looksLikeNumber(query);
  const qd = digitsOf(query);

  const options = useMemo<Option[]>(() => {
    const lower = query.toLowerCase();
    const textable = contacts.filter(c => !!c.phone);
    const found = query ? textable.filter(c => c.name.toLowerCase().includes(lower) || (numeric && !!c.phone && c.phone.includes(qd))) : textable;
    const out: Option[] = [];
    if (numeric && qd.length >= MIN_DIGITS && !found.some(c => c.phone === qd)) out.push({ kind: 'number', digits: qd });
    for (const c of found) out.push({ kind: 'contact', contact: c });
    return out;
  }, [contacts, query, numeric, qd]);

  useEffect(() => setHi(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  const pick = (o: Option) => {
    setError(o.kind === 'number' ? startConversation(o.digits) : startConversation(o.contact.phone ?? '', o.contact));
  };

  const submit = () => {
    const o = options[hi];
    if (o) pick(o);
    else if (numeric && qd) setError(startConversation(qd));
    else setError(t(query ? 'ui.messages.err_pick' : 'ui.messages.err_number'));
  };

  const listId = 'messages-new-suggestions';

  return (
    <div className="h-full flex flex-col min-h-0 page-in">
      <div className="h-14 shrink-0 flex items-center gap-3 pl-2 pr-2 border-b border-stroke">
        {onBack ? (
          <IconButton title={t('ui.messages.back')} onClick={onBack} className="shrink-0">
            <ArrowLeft size={16} />
          </IconButton>
        ) : (
          <span className="w-1 shrink-0" />
        )}
        <div className="flex-1 min-w-0 text-body font-semibold text-t1 truncate">{t('ui.messages.new_message')}</div>
        {!onBack && (
          <IconButton title={t('ui.common.cancel')} onClick={cancelNew} className="shrink-0">
            <X size={16} />
          </IconButton>
        )}
      </div>

      <div className="shrink-0 px-4 pt-4 pb-3 max-w-[560px] w-full">
        <label htmlFor="messages-new-to" className="block mb-1.5 text-caption text-t2">
          {t('ui.messages.to_label')}
        </label>
        <TextInput
          id="messages-new-to"
          ref={inputRef}
          value={q}
          autoComplete="off"
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={options[hi] ? `${listId}-${hi}` : undefined}
          placeholder={t('ui.messages.to_placeholder')}
          onChange={e => {
            setQ(e.target.value.slice(0, 48));
            setError(null);
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHi(i => Math.min(options.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHi(i => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              if (q) setQ('');
              else cancelNew();
            }
          }}
        />
        <div className="mt-1.5 text-caption text-t3">{t('ui.messages.to_hint')}</div>
        {error && (
          <div className="mt-3">
            <InfoBar severity="error">{error}</InfoBar>
          </div>
        )}
      </div>

      <div ref={listRef} id={listId} role="listbox" className="flex-1 min-h-0 overflow-y-auto os-scroll px-2 pb-3">
        {options.length === 0 ? (
          <div className="px-3 py-6 text-center text-caption text-t2">{query ? t('ui.messages.no_contact_match') : t('ui.messages.no_contacts')}</div>
        ) : (
          <>
            <div className="px-3 pt-1 pb-1 text-caption font-semibold text-t2">{query ? t('ui.messages.suggestions') : t('ui.messages.contacts')}</div>
            {options.map((o, i) => (
              <OptionRow key={optionKey(o)} id={`${listId}-${i}`} index={i} o={o} selected={i === hi} onPick={() => pick(o)} onHover={() => setHi(i)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function OptionRow({ id, index, o, selected, onPick, onHover }: { id: string; index: number; o: Option; selected: boolean; onPick: () => void; onHover: () => void }) {
  const person: Contact = o.kind === 'number' ? { id: o.digits, name: fmtPhone(o.digits), phone: o.digits } : o.contact;
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-index={index}
      // Keep focus in the To field so the arrows keep working.
      onMouseDown={e => e.preventDefault()}
      onClick={onPick}
      onMouseMove={() => {
        if (!selected) onHover();
      }}
      className={cx('flex items-center gap-3 px-3 py-2 rounded-ctl cursor-default transition-colors duration-150', selected && 'bg-subtle')}
    >
      <Avatar contact={person} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-body text-t1 truncate">{o.kind === 'number' ? t('ui.messages.text_number', fmtPhone(o.digits)) : o.contact.name}</div>
        <div className="text-caption text-t2 truncate">{o.kind === 'number' ? t('ui.messages.not_in_contacts') : fmtPhone(o.contact.phone)}</div>
      </div>
    </div>
  );
}
