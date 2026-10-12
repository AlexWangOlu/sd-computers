import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { BellOff, MessagesSquare, RefreshCw, Search, SearchX, SquarePen, X } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { useNow } from '@/lib/format';
import { Badge, Button, Empty, IconButton, InfoBar, Spinner } from '@/ui/controls';
import { messagePreview } from './format';
import { Avatar } from './parts';
import { loadList, refreshAll, selectThread, setSearch, startNew, useMessages } from './store';
import type { Contact, ConversationRow } from './types';
import { countText, cx, digitsOf, firstName, fmtListTime, fmtPhone, looksLikeNumber, senderOf } from './util';

/** Left pane: title + my number, search, and one row per conversation (newest first). */
export default function ConversationList({ notice }: { notice?: ReactNode }) {
  const conversations = useMessages(s => s.conversations);
  const contacts = useMessages(s => s.contacts);
  const search = useMessages(s => s.search);
  const refreshing = useMessages(s => s.refreshing);
  const listError = useMessages(s => s.listError);
  const myNumber = useMessages(s => s.myNumber);
  const selectedId = useMessages(s => (s.composingNew ? null : s.thread?.id ?? null));
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const now = useNow(30000).getTime();
  const scrollRef = useRef<HTMLDivElement>(null);

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => (q ? conversations.filter(c => matches(c, q)) : conversations), [conversations, q]);

  // Keep the open conversation's row in view (opened from a toast, or after a re-sort).
  useEffect(() => {
    if (!selectedId) return;
    const el = scrollRef.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1 h-8 pl-1">
          <div className="flex-1 min-w-0 text-subtitle font-semibold text-t1 truncate">{t('ui.messages.title')}</div>
          {refreshing && <Spinner size={16} className="mr-1" />}
          <IconButton title={t('ui.common.refresh')} onClick={refreshAll} disabled={refreshing}>
            <RefreshCw size={16} />
          </IconButton>
          <IconButton title={t('ui.messages.new_message_hint')} onClick={startNew}>
            <SquarePen size={16} />
          </IconButton>
        </div>
        <div className="pl-1 -mt-0.5 mb-2 text-caption text-t2 truncate">{myNumber ? t('ui.messages.my_number', fmtPhone(myNumber)) : ' '}</div>
        <SearchBox />
      </div>

      {notice && <div className="px-3 pb-2 shrink-0">{notice}</div>}
      {listError && (
        <div className="px-3 pb-2 shrink-0 flex flex-col items-start gap-2">
          <InfoBar severity="warning" title={t('ui.messages.refresh_failed')}>
            {listError}
          </InfoBar>
          <Button compact onClick={() => void loadList('manual')} disabled={refreshing}>
            {t('ui.common.retry')}
          </Button>
        </div>
      )}

      <div ref={scrollRef} role="listbox" aria-label={t('ui.messages.title')} className="flex-1 min-h-0 overflow-y-auto os-scroll outline-none">
        {conversations.length === 0 ? (
          <Empty icon={<MessagesSquare size={40} strokeWidth={1.25} />} title={t('ui.messages.empty_title')}>
            {t('ui.messages.empty_hint')}
            <div className="mt-4">
              <Button variant="accent" icon={<SquarePen size={16} />} onClick={startNew}>
                {t('ui.messages.new_message')}
              </Button>
            </div>
          </Empty>
        ) : rows.length === 0 ? (
          <Empty icon={<SearchX size={40} strokeWidth={1.25} />} title={t('ui.messages.no_results')}>
            {t('ui.messages.no_results_hint', search.trim())}
          </Empty>
        ) : (
          <div className="pt-0.5 pb-2 flex flex-col gap-px">
            {rows.map(c => (
              <Row key={c.id} c={c} selected={c.id === selectedId} now={now} clock24={clock24} contacts={contacts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Title, people, numbers (typed any way) and the last message. */
function matches(c: ConversationRow, q: string): boolean {
  const hay = [c.title, ...c.participants.map(p => p.name), c.last ? messagePreview(c.last) : ''].join('\n').toLowerCase();
  if (hay.includes(q)) return true;
  if (!looksLikeNumber(q)) return false;
  const d = digitsOf(q);
  return c.participants.some(p => !!p.phone && p.phone.includes(d)) || (!c.group && c.id.includes(d));
}

function SearchBox() {
  const search = useMessages(s => s.search);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t2 pointer-events-none" />
      <input
        ref={ref}
        value={search}
        onChange={e => setSearch(e.target.value.slice(0, 64))}
        onKeyDown={e => {
          if (e.key === 'Escape' && search) {
            e.stopPropagation();
            setSearch('');
          }
        }}
        placeholder={t('ui.messages.search_placeholder')}
        aria-label={t('ui.common.search')}
        spellCheck={false}
        autoComplete="off"
        className="w-full h-8 pl-8 pr-8 rounded-ctl bg-[var(--input)] border border-stroke-strong border-b-[var(--text-3)] text-body text-t1 placeholder:text-t3 outline-none focus:bg-[var(--input-focus)] focus:border-b-2 focus:border-b-[var(--accent-fill)] transition-colors duration-150"
      />
      {search && (
        <button
          type="button"
          title={t('ui.messages.clear_search')}
          aria-label={t('ui.messages.clear_search')}
          onClick={() => {
            setSearch('');
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

function Row({ c, selected, now, clock24, contacts }: { c: ConversationRow; selected: boolean; now: number; clock24: boolean; contacts: Contact[] }) {
  const last = c.last;
  const unread = c.unread > 0;
  let preview = t('ui.messages.no_messages_yet');
  if (last) {
    const text = messagePreview(last);
    if (last.from === 'me') preview = t('ui.messages.you_prefix', text);
    else if (c.group) preview = t('ui.messages.sender_prefix', firstName(senderOf(last.from, c.participants, contacts).name), text);
    else preview = text;
  }
  const person: Contact | undefined = c.group ? undefined : c.participants[0] ?? { id: c.id, name: c.title, phone: digitsOf(c.id) || undefined };
  const open = () => selectThread(c.id);

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      data-id={c.id}
      onClick={open}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className={cx(
        'relative mx-1.5 flex items-center gap-3 px-2.5 py-2 rounded-ctl cursor-default outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-subtle',
      )}
    >
      <Avatar contact={person} group={c.group} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cx('flex-1 min-w-0 truncate text-body text-t1', unread && 'font-semibold')}>{c.title}</span>
          {c.muted && (
            <span className="shrink-0 text-t3" title={t('ui.messages.muted')}>
              <BellOff size={12} />
            </span>
          )}
          {last && (
            <span className={cx('shrink-0 text-caption tabular-nums', unread ? 'text-accent-text font-semibold' : 'text-t2')}>{fmtListTime(last.ts, now, clock24)}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 min-h-[18px]">
          <span className={cx('flex-1 min-w-0 truncate text-caption', unread ? 'text-t1' : 'text-t2', !last && 'italic')}>{preview}</span>
          {unread && <Badge>{countText(c.unread)}</Badge>}
        </div>
      </div>
    </div>
  );
}
