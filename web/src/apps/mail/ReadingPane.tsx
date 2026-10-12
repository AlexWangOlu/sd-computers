import { ArrowLeft, Flag, FlagOff, Forward, Mail, MailOpen, Reply, ReplyAll, Trash2, Undo2 } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Button, Empty, IconButton, InfoBar, Spinner } from '@/ui/controls';
import { Persona, ToolButton, ToolSeparator } from './parts';
import { binMessage, deleteForever, openMessage, restoreMessage, setRead, startCompose, toggleFlag, useMail } from './store';
import type { Message } from './types';
import { fmtFull } from './util';
import Attachments from './Attachments';

/** Right pane when not composing: the open message, or Outlook's "Select an item to read". */
export default function ReadingPane({ width, onBack }: { width: number; onBack?: () => void }) {
  const open = useMail(s => s.open);
  const status = useMail(s => s.openStatus);
  const error = useMail(s => s.openError);
  const selectedId = useMail(s => s.selectedId);

  if (!open) {
    if (status === 'loading') {
      return (
        <div className="h-full flex items-center justify-center">
          <Spinner size={24} />
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className="h-full flex flex-col">
          {onBack && <BackBar onBack={onBack} />}
          <div className="p-6 flex flex-col gap-3 items-start">
            <InfoBar severity="error">{error}</InfoBar>
            {selectedId != null && <Button onClick={() => void openMessage(selectedId)}>{t('ui.common.retry')}</Button>}
          </div>
        </div>
      );
    }
    return (
      <Empty icon={<MailOpen size={48} strokeWidth={1} />} title={t('ui.mail.select_title')}>
        {t('ui.mail.select_hint')}
      </Empty>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <Toolbar m={open} width={width} onBack={onBack} />
      <div tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto os-scroll outline-none">
        <MessageView key={open.id} m={open} loading={status === 'loading'} error={status === 'error' ? error : undefined} />
      </div>
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-12 shrink-0 flex items-center px-2 border-b border-stroke">
      <IconButton title={t('ui.mail.back')} onClick={onBack}>
        <ArrowLeft size={16} />
      </IconButton>
    </div>
  );
}

function Toolbar({ m, width, onBack }: { m: Message; width: number; onBack?: () => void }) {
  // Labels on the reply commands when there's room; everything labelled when there's lots.
  const primary = width >= 460;
  const all = width >= 760;
  const inBin = m.folder === 'bin';
  return (
    <div className="h-12 shrink-0 flex items-center gap-0.5 px-2 border-b border-stroke overflow-hidden">
      {onBack && (
        <>
          <IconButton title={t('ui.mail.back')} onClick={onBack} className="shrink-0">
            <ArrowLeft size={16} />
          </IconButton>
          <ToolSeparator />
        </>
      )}
      {inBin ? (
        <>
          <ToolButton icon={<Undo2 size={16} />} label={t('ui.mail.restore')} onClick={() => restoreMessage(m)} showLabel={width >= 360} />
          <ToolButton icon={<Trash2 size={16} />} label={t('ui.mail.delete_forever')} onClick={() => deleteForever(m)} showLabel={width >= 360} />
        </>
      ) : (
        <>
          <ToolButton icon={<Reply size={16} />} label={t('ui.mail.reply')} onClick={() => startCompose('reply', m)} showLabel={primary} />
          <ToolButton icon={<ReplyAll size={16} />} label={t('ui.mail.reply_all')} onClick={() => startCompose('replyAll', m)} showLabel={primary} />
          <ToolButton icon={<Forward size={16} />} label={t('ui.mail.forward')} onClick={() => startCompose('forward', m)} showLabel={primary} />
          <ToolSeparator />
          <ToolButton
            icon={m.flagged ? <FlagOff size={16} /> : <Flag size={16} />}
            label={m.flagged ? t('ui.mail.unflag') : t('ui.mail.flag')}
            onClick={() => toggleFlag(m)}
            showLabel={all}
          />
          <ToolButton
            icon={m.read ? <Mail size={16} /> : <MailOpen size={16} />}
            label={m.read ? t('ui.mail.mark_unread') : t('ui.mail.mark_read')}
            onClick={() => setRead(m, !m.read)}
            showLabel={all}
          />
          <ToolButton icon={<Trash2 size={16} />} label={t('ui.common.delete')} onClick={() => binMessage(m)} showLabel={all} />
        </>
      )}
    </div>
  );
}

function MessageView({ m, loading, error }: { m: Message; loading: boolean; error?: string }) {
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  return (
    <article className="px-5 pt-5 pb-8 max-w-[960px] page-in">
      <div className="flex items-start gap-3">
        <h1 className={`flex-1 min-w-0 text-subtitle font-semibold break-words select-text cursor-text ${m.subject ? 'text-t1' : 'text-t2 italic'}`}>
          {m.subject || t('ui.mail.no_subject')}
        </h1>
        {m.flagged && (
          <span className="mt-1 shrink-0 inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-stroke bg-card text-caption text-t1">
            <Flag size={12} className="text-critical fill-current" />
            {t('ui.mail.flagged_chip')}
          </span>
        )}
      </div>
      {m.folder === 'bin' && <div className="mt-1 text-caption text-t2">{t('ui.mail.in_bin_hint')}</div>}

      <div className="mt-4 rounded-win bg-card border border-stroke shadow-card">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 pt-4 pb-3">
          <Persona name={m.from.name} email={m.from.email} size={40} />
          <div className="flex-1 min-w-[160px]">
            <div className="flex flex-wrap items-baseline gap-x-2 select-text cursor-text">
              <span className="text-body font-semibold text-t1 break-all">{m.from.name}</span>
              {m.from.name !== m.from.email && <span className="text-caption text-t2 break-all">&lt;{m.from.email}&gt;</span>}
            </div>
            <div className="mt-0.5 text-caption text-t2 break-words select-text cursor-text">
              <span className="text-t3">{t('ui.mail.to_label')}</span> {m.to.length ? m.to.join('; ') : t('ui.mail.no_recipients')}
            </div>
          </div>
          <div className="text-caption text-t2 whitespace-nowrap pt-0.5">{fmtFull(m.ts, clock24)}</div>
        </div>
        <div className="mx-4 h-px bg-stroke" />
        <div className="px-4 pt-4 pb-6">
          {m.body !== undefined ? (
            <div className="text-body text-t1 whitespace-pre-wrap break-words select-text cursor-text">{m.body || <span className="text-t3 italic">{t('ui.mail.empty_body')}</span>}</div>
          ) : loading ? (
            <div className="py-6 flex justify-center">
              <Spinner size={20} />
            </div>
          ) : error ? (
            <InfoBar severity="error">{error}</InfoBar>
          ) : (
            <div className="text-body text-t2 whitespace-pre-wrap break-words select-text">{m.preview}</div>
          )}
        </div>
        {m.attachments && m.attachments.length > 0 && <Attachments list={m.attachments} />}
      </div>
    </article>
  );
}
