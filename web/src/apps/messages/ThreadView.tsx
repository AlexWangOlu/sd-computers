import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, Banknote, BellOff, CircleAlert, Image as ImageIcon, ImagePlay, LogOut, MapPin, MessageSquare, Mic, Paperclip, SquarePen, Trash2, type LucideIcon } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtTime, useNow } from '@/lib/format';
import { Button, Empty, IconButton, InfoBar, Spinner } from '@/ui/controls';
import { useExitFx } from '@/hooks/useExitFx';
import Composer from './Composer';
import { messagePreview } from './format';
import { Avatar } from './parts';
import { confirmDelete, discardFailed, openThread, retrySend, startNew, useMessages, type Bubble, type OpenThread } from './store';
import type { Contact } from './types';
import { cx, digitsOf, drawableUrl, fmtDay, fmtFull, fmtPhone, sameDay, senderOf } from './util';

/** Messages from one sender this close together form a run (one name, one time caption). */
const RUN_GAP = 5 * 60 * 1000;

/** Right pane when not starting a new conversation: the open thread, or "select a conversation". */
export default function ThreadView({ onBack }: { onBack?: () => void }) {
  const thread = useMessages(s => s.thread);
  const status = useMessages(s => s.threadStatus);
  const error = useMessages(s => s.threadError);

  if (!thread) {
    return (
      <Empty icon={<MessageSquare size={48} strokeWidth={1} />} title={t('ui.messages.select_title')}>
        {t('ui.messages.select_hint')}
        <div className="mt-4">
          <Button icon={<SquarePen size={16} />} onClick={startNew}>
            {t('ui.messages.new_message')}
          </Button>
        </div>
      </Empty>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <Header thread={thread} onBack={onBack} />
      {status === 'error' ? (
        <div className="flex-1 min-h-0 overflow-y-auto os-scroll p-6 flex flex-col items-start gap-3">
          <InfoBar severity="error" title={t('ui.messages.thread_failed')}>
            {error}
          </InfoBar>
          <Button onClick={() => void openThread(thread.id)}>{t('ui.common.retry')}</Button>
        </div>
      ) : status === 'loading' && thread.messages.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <Spinner size={24} />
        </div>
      ) : (
        <MessageScroller key={`scroll:${thread.id}`} thread={thread} />
      )}
      <Composer key={`compose:${thread.id}`} threadId={thread.id} ready={status === 'ready'} />
    </div>
  );
}

/** The thread's person (1:1), from its participants or, failing that, its id. */
const personOf = (th: OpenThread): Contact | undefined =>
  th.group ? undefined : th.participants[0] ?? { id: th.id, name: th.title, phone: digitsOf(th.id) || undefined };

function Header({ thread, onBack }: { thread: OpenThread; onBack?: () => void }) {
  const person = personOf(thread);
  let sub = '';
  if (thread.group) {
    if (thread.participants.length) sub = t('ui.messages.group_members', thread.participants.map(p => p.name).join(', '));
  } else {
    const number = fmtPhone(person?.phone || thread.id);
    // An unsaved number is its own title: don't print it twice.
    const titleIsNumber = !/\p{L}/u.test(thread.title) && digitsOf(thread.title) === digitsOf(number);
    if (thread.draft) sub = titleIsNumber ? t('ui.messages.new_conversation') : `${number} · ${t('ui.messages.new_conversation')}`;
    else if (!titleIsNumber) sub = number;
  }
  const deleteLabel = t(thread.group ? 'ui.messages.leave_group' : 'ui.messages.delete_conversation');

  return (
    <div className="h-14 shrink-0 flex items-center gap-3 pl-2 pr-2 border-b border-stroke">
      {onBack ? (
        <IconButton title={t('ui.messages.back')} onClick={onBack} className="shrink-0">
          <ArrowLeft size={16} />
        </IconButton>
      ) : (
        <span className="w-1 shrink-0" />
      )}
      <Avatar contact={person} group={thread.group} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-body font-semibold text-t1 truncate select-text cursor-text">{thread.title}</div>
        {sub && (
          <div className="text-caption text-t2 truncate select-text cursor-text" title={sub}>
            {sub}
          </div>
        )}
      </div>
      {thread.muted && (
        <span className="shrink-0 text-t3 px-1" title={t('ui.messages.muted')}>
          <BellOff size={14} />
        </span>
      )}
      {!thread.draft && (
        <IconButton title={deleteLabel} onClick={confirmDelete} className="shrink-0">
          {thread.group ? <LogOut size={16} /> : <Trash2 size={16} />}
        </IconButton>
      )}
    </div>
  );
}

type Pos = 'bottom' | 'near' | 'far';

/**
 * The bubbles. Follows the bottom on open and as messages arrive, unless the reader scrolled up -
 * then a "jump to latest" pill counts what came in below instead. Our own sends always follow.
 */
function MessageScroller({ thread }: { thread: OpenThread }) {
  const contacts = useMessages(s => s.contacts);
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const now = useNow(60000).getTime();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prev = useRef<{ key: string; len: number } | null>(null);
  const [pos, setPos] = useState<Pos>('bottom');
  const [fresh, setFresh] = useState(0);
  const jumpRef = useExitFx('fade-out');
  // Bubbles that mount after the thread has opened are the ones that animate in.
  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);

  const msgs = thread.messages;
  const lastKey = msgs.length ? String(msgs[msgs.length - 1].id) : '';

  const toBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = true;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  };

  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = { key: lastKey, len: msgs.length };
    if (!p) {
      toBottom();
      return;
    }
    if (p.key === lastKey) return;
    const last = msgs[msgs.length - 1];
    if (stick.current || (last && last.from === 'me')) {
      toBottom();
      setFresh(0);
    } else {
      setFresh(n => n + Math.max(1, msgs.length - p.len));
    }
  }, [lastKey, msgs.length]);

  // Pictures loading and the composer growing change the heights: stay pinned while following.
  // (The scroller has overflow-anchor:none - Chromium's scroll anchoring would otherwise move
  // scrollTop as a picture grows, and onScroll would read that as the user leaving the bottom.)
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = gap < 40;
    setPos(gap < 40 ? 'bottom' : gap > 240 ? 'far' : 'near');
    if (stick.current) setFresh(0);
  };

  const showJump = pos === 'far' || (pos === 'near' && fresh > 0);

  // "Seen" goes under my newest confirmed message (1:1 only - groups have no read receipts).
  let lastMine = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].from === 'me' && !msgs[i].local) {
      lastMine = i;
      break;
    }
  }

  const rows: ReactNode[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const p = i > 0 ? msgs[i - 1] : undefined;
    const n = i + 1 < msgs.length ? msgs[i + 1] : undefined;
    const newDay = !p || !sameDay(p.ts, m.ts);
    if (newDay) rows.push(<DaySeparator key={`day:${String(m.id)}`} label={fmtDay(m.ts, now)} />);
    const mine = m.from === 'me';
    const first = newDay || !p || p.from !== m.from || m.ts - p.ts > RUN_GAP;
    const last = !n || n.from !== m.from || !sameDay(m.ts, n.ts) || n.ts - m.ts > RUN_GAP;
    rows.push(
      <BubbleRow
        key={String(m.id)}
        m={m}
        mine={mine}
        first={first}
        last={last}
        group={thread.group}
        sender={thread.group && !mine ? senderOf(m.from, thread.participants, contacts) : undefined}
        seen={!thread.group && i === lastMine ? m.seenAt : undefined}
        clock24={clock24}
        fresh={settled.current}
      />,
    );
  }

  return (
    <div className="relative flex-1 min-h-0 fade-in">
      <div ref={scrollRef} onScroll={onScroll} className="absolute inset-0 overflow-y-auto os-scroll [overflow-anchor:none]" role="log" aria-live="polite">
        <div ref={contentRef} className="min-h-full flex flex-col justify-end pt-2 pb-3">
          {msgs.length === 0 ? <ThreadStart thread={thread} /> : rows}
        </div>
      </div>
      {showJump && (
        <div ref={jumpRef} className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none page-in">
          <Button
            icon={<ArrowDown size={14} />}
            onClick={() => {
              toBottom(true);
              setFresh(0);
            }}
            className="pointer-events-auto !rounded-full !shadow-flyout"
          >
            {fresh > 0 ? (fresh === 1 ? t('ui.messages.new_below_one') : t('ui.messages.new_below', fresh)) : t('ui.messages.jump_latest')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** An empty thread: who this is with, and that nothing's been said yet. */
function ThreadStart({ thread }: { thread: OpenThread }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 py-10 text-center">
      <Avatar contact={personOf(thread)} group={thread.group} size={64} />
      <div className="mt-2 text-body font-semibold text-t1">{thread.title}</div>
      <div className="text-caption text-t2 max-w-[320px]">
        {thread.group ? t('ui.messages.empty_group') : t('ui.messages.start_hint', thread.title)}
      </div>
    </div>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div role="separator" className="flex items-center gap-3 px-6 pt-4 pb-1 text-caption text-t2 select-none">
      <span className="flex-1 h-px bg-stroke" />
      <span className="font-semibold">{label}</span>
      <span className="flex-1 h-px bg-stroke" />
    </div>
  );
}

const KIND_ICON: Record<string, LucideIcon> = {
  image: ImageIcon,
  gif: ImagePlay,
  money: Banknote,
  location: MapPin,
  locrequest: MapPin,
  voice: Mic,
};

interface BubbleRowProps {
  m: Bubble;
  mine: boolean;
  /** First / last of a run from the same sender. */
  first: boolean;
  last: boolean;
  group: boolean;
  /** Group messages from others: who sent it. */
  sender?: Contact;
  /** ms, when this is my newest message and the other side saw it. */
  seen?: number;
  clock24: boolean;
  /** Mounted into an already open thread (it just arrived / was just sent). */
  fresh: boolean;
}

function BubbleRow({ m, mine, first, last, group, sender, seen, clock24, fresh }: BubbleRowProps) {
  // Incoming messages and my own just-sent ones rise in. A sent message is re-keyed when the
  // server confirms it (local id -> real id): that swap must not animate again.
  const [enter] = useState(fresh && (!mine || !!m.local));
  const failed = m.local?.state === 'failed';
  const sendingNow = m.local?.state === 'sending';
  const gutter = group && !mine;

  let caption: ReactNode = null;
  if (sendingNow) {
    caption = <span className="text-t3">{t('ui.messages.sending')}</span>;
  } else if (failed) {
    caption = (
      <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-critical">
        <span className="inline-flex items-center gap-1">
          <CircleAlert size={12} className="shrink-0" />
          {m.local?.error || t('ui.messages.failed')}
        </span>
        <button type="button" onClick={() => retrySend(m.id)} className="font-semibold text-accent-text hover:underline">
          {t('ui.common.retry')}
        </button>
        <button type="button" onClick={() => discardFailed(m.id)} className="text-t2 hover:text-t1 hover:underline">
          {t('ui.messages.remove')}
        </button>
      </span>
    );
  } else {
    const parts: string[] = [];
    if (last) parts.push(fmtTime(new Date(m.ts), clock24));
    if (seen) parts.push(t('ui.messages.seen_at', fmtTime(new Date(seen), clock24)));
    if (parts.length) caption = <span className="text-t3">{parts.join(' · ')}</span>;
  }

  return (
    <div className={cx('flex flex-col px-4', mine ? 'items-end' : 'items-start', first ? 'mt-2.5' : 'mt-0.5', enter && 'msg-in')}>
      {sender && first && <div className={cx('mb-0.5 max-w-[75%] truncate text-caption text-t2', gutter && 'ml-9')}>{sender.name}</div>}
      <div className={cx('w-full flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
        {gutter && <div className="w-7 shrink-0">{last && <Avatar contact={sender} size={28} />}</div>}
        <div className={cx('min-w-0 max-w-[75%] flex flex-col gap-0.5', mine ? 'items-end' : 'items-start', failed && 'opacity-70')} title={m.local ? undefined : fmtFull(m.ts, clock24)}>
          <Content m={m} mine={mine} first={first} last={last} />
        </div>
      </div>
      {caption && <div className={cx('mt-0.5 max-w-[85%] text-caption', mine ? 'text-right' : 'text-left', gutter && 'ml-9')}>{caption}</div>}
    </div>
  );
}

/** Corners: a run's bubbles hug each other on the sender's side. */
const shape = (mine: boolean, first: boolean, last: boolean): string =>
  cx('rounded-2xl', mine ? !first && 'rounded-tr-md' : !first && 'rounded-tl-md', mine ? !last && 'rounded-br-md' : !last && 'rounded-bl-md');

const tone = (mine: boolean): string => (mine ? 'bg-accent text-accent-on' : 'bg-card border border-stroke text-t1');

function TextBubble({ text, mine, first, last }: { text: string; mine: boolean; first: boolean; last: boolean }) {
  return <div className={cx('px-3 py-1.5 text-body whitespace-pre-wrap [overflow-wrap:anywhere] select-text cursor-text', shape(mine, first, last), tone(mine))}>{text}</div>;
}

/** A photo / GIF the phone sent, falling back to its label when it can't be drawn. */
function Picture({ m, mine, onFail }: { m: Bubble; mine: boolean; onFail: () => void }) {
  const url = drawableUrl(m.gifUrl);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={messagePreview(m)}
      draggable={false}
      onError={onFail}
      className={cx('block max-w-full w-auto h-auto max-h-[240px] min-w-[64px] min-h-[48px] object-contain rounded-2xl border border-stroke bg-card', mine ? 'ml-auto' : '')}
      style={{ maxWidth: 260 }}
    />
  );
}

function Content({ m, mine, first, last }: { m: Bubble; mine: boolean; first: boolean; last: boolean }) {
  const [broken, setBroken] = useState(false);
  if (m.kind === 'text') return <TextBubble text={m.body} mine={mine} first={first} last={last} />;

  const body = m.body.trim();
  const picture = (m.kind === 'image' || m.kind === 'gif') && !broken && drawableUrl(m.gifUrl);
  // Location labels already carry the place name (the body); other kinds may have a caption.
  const caption = body && m.kind !== 'location' && m.kind !== 'locrequest' ? body : '';
  const known = Object.prototype.hasOwnProperty.call(KIND_ICON, m.kind);

  // An unknown kind with text: just show the text.
  if (!known && body) return <TextBubble text={m.body} mine={mine} first={first} last={last} />;

  const Icon = known ? KIND_ICON[m.kind] : Paperclip;
  return (
    <>
      {picture ? (
        <Picture m={m} mine={mine} onFail={() => setBroken(true)} />
      ) : (
        <span className={cx('inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-full text-body select-text', tone(mine))}>
          <Icon size={16} className="shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{messagePreview(m)}</span>
        </span>
      )}
      {caption && <TextBubble text={caption} mine={mine} first={false} last={last} />}
    </>
  );
}
