import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Flag, FlagOff, Mail, MailOpen, Paperclip, RefreshCw, Search, SearchX, Trash2, Undo2, X } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtMailDate } from '@/lib/format';
import { Button, Empty, IconButton, InfoBar, Spinner } from '@/ui/controls';
import { Persona } from './parts';
import { FOLDER_ICON, folderLabel } from './Sidebar';
import { binMessage, deleteForever, emptyBin, loadList, openMessage, restoreMessage, setRead, setSearch, toggleFlag, useMail } from './store';
import type { Message } from './types';
import { cx, dateGroup, isOutgoing, oneLine, type DateGroup } from './util';

/** Middle pane: folder title, search, and the message rows grouped by day. */
export default function MessageList({ notice }: { notice?: ReactNode }) {
  const folder = useMail(s => s.folder);
  const active = useMail(s => s.active);
  const search = useMail(s => s.search);
  const messages = useMail(s => s.messages);
  const status = useMail(s => s.listStatus);
  const error = useMail(s => s.listError);
  const selectedId = useMail(s => s.selectedId);
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the selected row visible (arrow keys, opening from a toast).
  useEffect(() => {
    if (selectedId == null) return;
    scrollRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [folder, active]);

  let lastGroup: DateGroup | null = null;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-1 h-8 pl-1">
          <div className="flex-1 min-w-0 text-subtitle font-semibold text-t1 truncate">{folderLabel(folder)}</div>
          {status === 'loading' && messages.length > 0 && <Spinner size={16} className="mr-1" />}
          {folder === 'bin' && messages.length > 0 && (
            <IconButton title={t('ui.mail.empty_bin_action')} onClick={emptyBin}>
              <Trash2 size={16} />
            </IconButton>
          )}
          <IconButton title={t('ui.common.refresh')} onClick={() => void loadList({ keep: true })}>
            <RefreshCw size={16} />
          </IconButton>
        </div>
        <div className="pl-1 -mt-0.5 mb-2 text-caption text-t2 truncate">{active}</div>
        <SearchBox key={`${active}:${folder}`} />
      </div>
      {notice && <div className="px-3 pb-2">{notice}</div>}

      <div ref={scrollRef} data-mail-list tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto os-scroll outline-none">
        {status === 'loading' && messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Spinner size={24} />
          </div>
        ) : status === 'error' ? (
          <div className="p-3 flex flex-col gap-3">
            <InfoBar severity="error">{error}</InfoBar>
            <div>
              <Button onClick={() => void loadList()}>{t('ui.common.retry')}</Button>
            </div>
          </div>
        ) : messages.length === 0 && status === 'ready' ? (
          search ? (
            <Empty icon={<SearchX size={40} strokeWidth={1.25} />} title={t('ui.mail.no_results')}>
              {t('ui.mail.no_results_hint', folderLabel(folder), search)}
            </Empty>
          ) : (
            <EmptyFolder folder={folder} />
          )
        ) : (
          <div className="pb-2 page-in">
            {messages.map(m => {
              const g = dateGroup(m.ts);
              const header = g !== lastGroup;
              lastGroup = g;
              return (
                <Fragment key={m.id}>
                  {header && <div className="sticky top-0 z-10 bg-win px-4 pt-3 pb-1 text-caption font-semibold text-t2">{t(`ui.mail.group_${g}`)}</div>}
                  <Row m={m} selected={m.id === selectedId} clock24={clock24} />
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchBox() {
  const applied = useMail(s => s.search);
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  // The store cleared the search (e.g. opened from a new-mail toast): clear the box too.
  useEffect(() => {
    if (applied === '') setText('');
  }, [applied]);
  useEffect(() => {
    const h = window.setTimeout(() => setSearch(text.trim()), 350);
    return () => window.clearTimeout(h);
  }, [text]);
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t2 pointer-events-none" />
      <input
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value.slice(0, 64))}
        onKeyDown={e => {
          if (e.key === 'Escape' && text) {
            e.stopPropagation();
            setText('');
          }
          if (e.key === 'Enter') setSearch(text.trim());
        }}
        placeholder={t('ui.mail.search_placeholder')}
        spellCheck={false}
        className="w-full h-8 pl-8 pr-8 rounded-ctl bg-[var(--input)] border border-stroke-strong border-b-[var(--text-3)] text-body text-t1 placeholder:text-t3 outline-none focus:bg-[var(--input-focus)] focus:border-b-2 focus:border-b-[var(--accent-fill)] transition-colors duration-150"
      />
      {text && (
        <button
          type="button"
          title={t('ui.mail.clear_search')}
          onClick={() => {
            setText('');
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

function EmptyFolder({ folder }: { folder: Message['folder'] }) {
  const f = (['inbox', 'flagged', 'drafts', 'sent', 'spam', 'bin'] as const).find(x => x === folder) ?? 'inbox';
  const Icon = FOLDER_ICON[f];
  return (
    <Empty icon={<Icon size={40} strokeWidth={1.25} />} title={t(`ui.mail.empty_${f}`)}>
      {t(`ui.mail.empty_${f}_hint`)}
    </Empty>
  );
}

function QuickAction({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      className="w-7 h-7 flex items-center justify-center rounded-ctl text-t1 hover:bg-subtle active:bg-control-press"
    >
      {children}
    </button>
  );
}

function Row({ m, selected, clock24 }: { m: Message; selected: boolean; clock24: boolean }) {
  const outgoing = isOutgoing(m);
  const draft = m.folder === 'drafts';
  const unread = !m.read && !outgoing;
  const who = outgoing ? (m.to.length ? t('ui.mail.to_list', m.to.join(', ')) : t('ui.mail.no_recipients')) : m.from.name || m.from.email;
  const avatar = outgoing ? { name: m.to[0] ?? m.from.name, email: m.to[0] ?? m.from.email } : m.from;
  const preview = oneLine(m.preview);
  const inBin = m.folder === 'bin';

  return (
    <div
      data-id={m.id}
      aria-selected={selected}
      onClick={() => void openMessage(m.id)}
      className={cx(
        'group relative flex gap-3 pl-4 pr-3 py-2.5 cursor-default border-b border-stroke transition-colors duration-150',
        selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-subtle',
      )}
    >
      {unread && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
      <Persona name={avatar.name} email={avatar.email} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 group-hover:pr-[84px]">
          <span className={cx('flex-1 min-w-0 truncate text-body text-t1', unread && 'font-semibold')}>{who}</span>
          <span className="shrink-0 text-caption text-t2 tabular-nums group-hover:hidden">{fmtMailDate(m.ts, clock24)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {draft && <span className="shrink-0 text-body text-critical">{t('ui.mail.draft_tag')}</span>}
          <span className={cx('flex-1 min-w-0 truncate text-body', unread ? 'font-semibold text-accent-text' : 'text-t1', !m.subject && 'italic text-t2')}>
            {m.subject || t('ui.mail.no_subject')}
          </span>
          {m.hasAttachments && <Paperclip size={14} className="shrink-0 text-t2" />}
          {m.flagged && <Flag size={14} className="shrink-0 text-critical fill-current" />}
        </div>
        <div className="text-caption text-t2 truncate">{preview || t('ui.mail.no_preview')}</div>
      </div>

      <div className="absolute right-2 top-1.5 hidden group-hover:flex items-center gap-0.5">
        {inBin ? (
          <>
            <QuickAction title={t('ui.mail.restore')} onClick={() => restoreMessage(m)}>
              <Undo2 size={15} />
            </QuickAction>
            <QuickAction title={t('ui.mail.delete_forever')} onClick={() => deleteForever(m)}>
              <Trash2 size={15} />
            </QuickAction>
          </>
        ) : (
          <>
            {!outgoing && (
              <QuickAction title={m.read ? t('ui.mail.mark_unread') : t('ui.mail.mark_read')} onClick={() => setRead(m, !m.read)}>
                {m.read ? <Mail size={15} /> : <MailOpen size={15} />}
              </QuickAction>
            )}
            <QuickAction title={m.flagged ? t('ui.mail.unflag') : t('ui.mail.flag')} onClick={() => toggleFlag(m)}>
              {m.flagged ? <FlagOff size={15} /> : <Flag size={15} />}
            </QuickAction>
            <QuickAction title={t('ui.common.delete')} onClick={() => binMessage(m)}>
              <Trash2 size={15} />
            </QuickAction>
          </>
        )}
      </div>
    </div>
  );
}
