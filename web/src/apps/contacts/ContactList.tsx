import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { BookUser, RefreshCw, Search, SearchX, Star, UserPlus, X } from 'lucide-react';
import { t } from '@/i18n';
import { Button, Empty, IconButton, Spinner, TextInput } from '@/ui/controls';
import { Avatar } from './parts';
import { cx, fmtPhone, groupByLetter, matches } from './model';
import type { Contact } from './types';

/** Left pane: title, refresh, Add contact, search, and the address book under its letters. */
export default function ContactList({
  contacts,
  search,
  selected,
  single,
  refreshing,
  notice,
  onSearch,
  onSelect,
  onRefresh,
  onAdd,
}: {
  contacts: Contact[];
  search: string;
  /** id of the card open on the right */
  selected: string | null;
  /** list and card take turns: a row is opened, not just pointed at */
  single: boolean;
  refreshing: boolean;
  /** a refresh that failed, shown above the list */
  notice?: ReactNode;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupByLetter(contacts.filter(c => matches(c, search))), [contacts, search]);

  // Keep the open card's row in view (a contact just added, or one found by search).
  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector(`[data-row="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  /** Put the focus on a row; side by side, the card follows it. */
  const goTo = (row: HTMLElement | undefined | null) => {
    if (!row) return;
    row.focus();
    if (!single && row.dataset.row) onSelect(row.dataset.row);
  };

  // Up / Down / Home / End walk the rows.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []);
    if (rows.length === 0) return;
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : e.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at - 1);
    e.preventDefault();
    goTo(rows[to]);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1 h-8 pl-1">
          <div className="flex-1 min-w-0 text-subtitle font-semibold text-t1 truncate">{t('ui.contacts.title')}</div>
          <IconButton title={t('ui.common.refresh')} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Spinner size={16} /> : <RefreshCw size={16} />}
          </IconButton>
          {/* (the short word: beside the pane's own title there is no room for "Add contact") */}
          <Button variant="accent" compact icon={<UserPlus size={15} />} onClick={onAdd} title={t('ui.contacts.add_hint')} className="shrink-0">
            {t('ui.contacts.add_short')}
          </Button>
        </div>
        <div className="pl-1 -mt-0.5 mb-2 text-caption text-t2 truncate">{contacts.length === 1 ? t('ui.contacts.count_one') : t('ui.contacts.count_many', contacts.length)}</div>
        <SearchBox value={search} onChange={onSearch} onDown={() => goTo(listRef.current?.querySelector<HTMLElement>('[data-row]'))} />
      </div>

      {notice && <div className="px-3 pb-2 shrink-0">{notice}</div>}

      <div ref={listRef} role="listbox" aria-label={t('ui.contacts.title')} onKeyDown={onKeyDown} className="flex-1 min-h-0 overflow-y-auto os-scroll">
        {contacts.length === 0 ? (
          <Empty icon={<BookUser size={40} strokeWidth={1.25} />} title={t('ui.contacts.empty_title')}>
            {t('ui.contacts.empty_hint')}
            <div className="mt-4">
              <Button variant="accent" icon={<UserPlus size={16} />} onClick={onAdd}>
                {t('ui.contacts.add')}
              </Button>
            </div>
          </Empty>
        ) : groups.length === 0 ? (
          <Empty icon={<SearchX size={40} strokeWidth={1.25} />} title={t('ui.contacts.no_results')}>
            {t('ui.contacts.no_results_hint', search.trim())}
          </Empty>
        ) : (
          <div className="pb-2">
            {groups.map(g => (
              <div key={g.letter} role="group" aria-label={g.letter}>
                <div className="sticky top-0 z-10 bg-win px-4 pt-3 pb-1 text-caption font-semibold text-t2">{g.letter}</div>
                <div className="flex flex-col gap-px">
                  {g.contacts.map(c => (
                    <Row key={c.id} c={c} selected={!single && c.id === selected} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The search field. Escape clears it, Down steps into the results. */
function SearchBox({ value, onChange, onDown }: { value: string; onChange: (q: string) => void; onDown: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t2 pointer-events-none z-[1]" />
      <TextInput
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value.slice(0, 64))}
        onKeyDown={e => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            onChange('');
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onDown();
          }
        }}
        placeholder={t('ui.contacts.search_placeholder')}
        aria-label={t('ui.contacts.search_placeholder')}
        autoComplete="off"
        className="pl-8 pr-8"
      />
      {value && (
        <button
          type="button"
          title={t('ui.contacts.clear_search')}
          aria-label={t('ui.contacts.clear_search')}
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-ctl text-t2 hover:bg-subtle hover:text-t1"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Row({ c, selected, onSelect }: { c: Contact; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-row={c.id}
      onClick={() => onSelect(c.id)}
      className={cx(
        'mx-1.5 flex items-center gap-3 px-2.5 py-1.5 rounded-ctl text-left cursor-default outline-none',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-subtle',
      )}
    >
      <Avatar contact={c} size={32} />
      <span className="flex-1 min-w-0">
        <span className="block text-body text-t1 truncate">{c.name}</span>
        {/* A card saved without a name already shows its number as the name. */}
        {c.number && fmtPhone(c.number) !== c.name && <span className="block text-caption text-t2 truncate tabular-nums">{fmtPhone(c.number)}</span>}
      </span>
      {c.favorite && (
        <span title={t('ui.contacts.favorite')} className="shrink-0 text-t3">
          <Star size={12} fill="currentColor" />
        </span>
      )}
    </button>
  );
}
