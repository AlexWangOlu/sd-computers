import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { t } from '@/i18n';
import { Button, Spinner, TextArea } from '@/ui/controls';
import { getTyped, sendText, setTyped, useMessages } from './store';
import { cx, MAX_TEXT } from './util';

/** Show the character counter from here on. */
const COUNTER_AT = MAX_TEXT - 100;
/** The box grows with its text up to this height, then scrolls. */
const MAX_HEIGHT = 140;

/**
 * Text box + send button under a thread. Enter sends, Shift+Enter breaks the line. The box is
 * locked (read-only, so it keeps focus) while this thread's send is in flight; what's typed but
 * unsent survives switching threads.
 */
export default function Composer({ threadId, ready }: { threadId: string; ready: boolean }) {
  const sending = useMessages(s => s.sending.includes(threadId));
  const [text, setText] = useState(() => getTyped(threadId));
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setTyped(threadId, text), [threadId, text]);

  // Grow with the text (rows=1 at rest).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + borders, MAX_HEIGHT)}px`;
    // No scrollbar until it really is full (a one-line box would otherwise show its arrows).
    el.style.overflowY = el.scrollHeight + borders > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [text]);

  // Opening a thread puts the caret here.
  useEffect(() => {
    const h = window.setTimeout(() => ref.current?.focus(), 40);
    return () => window.clearTimeout(h);
  }, []);

  const canSend = ready && !sending && text.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    if (sendText(text)) setText('');
  };

  const len = text.length;

  return (
    <div className="shrink-0 border-t border-stroke px-3 pt-2.5 pb-3">
      <div className="flex items-end gap-2">
        <TextArea
          ref={ref}
          rows={1}
          value={text}
          maxLength={MAX_TEXT}
          readOnly={sending}
          aria-busy={sending}
          placeholder={t('ui.messages.composer_placeholder')}
          aria-label={t('ui.messages.composer_placeholder')}
          onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          className="flex-1 min-h-8 leading-5"
          style={{ maxHeight: MAX_HEIGHT }}
        />
        <Button
          variant="accent"
          onClick={send}
          disabled={!canSend}
          title={t('ui.messages.send_hint')}
          aria-label={t('ui.messages.send')}
          className="shrink-0 w-10 !px-0"
        >
          {sending ? <Spinner size={14} className="!text-accent-on" /> : <Send size={16} />}
        </Button>
      </div>
      {len >= COUNTER_AT && (
        <div className={cx('mt-1 pr-12 text-right text-caption tabular-nums', len >= MAX_TEXT ? 'text-critical' : 'text-t2')}>
          {t('ui.messages.counter', len, MAX_TEXT)}
        </div>
      )}
    </div>
  );
}
