import { FileText, Mic, StickyNote } from 'lucide-react';
import { t } from '@/i18n';
import type { Attachment } from './types';

/**
 * Attachments on a phone mail (sd-phone link): photos inline, notes as a quoted card, voice memos and
 * documents as chips pointing back to the phone (their content stays there).
 */
export default function Attachments({ list }: { list: Attachment[] }) {
  if (list.length === 0) return null;
  const photos = list.filter((a): a is Extract<Attachment, { kind: 'photo' }> => a.kind === 'photo');
  const notes = list.filter((a): a is Extract<Attachment, { kind: 'note' }> => a.kind === 'note');
  const files = list.filter(a => a.kind === 'audio' || a.kind === 'document');

  return (
    <div className="mx-4 mb-4 flex flex-col gap-3">
      <div className="text-caption font-semibold text-t2">{t('ui.mail.attachments', list.length)}</div>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block rounded-ctl overflow-hidden border border-stroke bg-layer" title={t('ui.mail.att_photo')}>
              <img src={p.url} alt={t('ui.mail.att_photo')} className="block h-40 max-w-[280px] object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {notes.map((n, i) => (
        <div key={i} className="ctl-card rounded-win border border-stroke bg-layer px-3 py-2.5">
          <div className="flex items-center gap-2 text-caption text-t2">
            <StickyNote size={14} />
            {t('ui.mail.att_note')}
          </div>
          {n.title && <div className="mt-1 text-body font-semibold text-t1 break-words">{n.title}</div>}
          <div className="mt-0.5 text-body text-t1 whitespace-pre-wrap break-words select-text cursor-text">{n.body}</div>
        </div>
      ))}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-2 h-8 px-3 rounded-ctl border border-stroke bg-card text-body text-t1" title={t('ui.mail.att_on_phone')}>
              {f.kind === 'audio' ? <Mic size={14} className="text-t2" /> : <FileText size={14} className="text-t2" />}
              <span className="truncate max-w-[220px]">{f.name || (f.kind === 'audio' ? t('ui.mail.att_audio') : t('ui.mail.att_document'))}</span>
              <span className="text-caption text-t3">{t('ui.mail.att_on_phone')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
