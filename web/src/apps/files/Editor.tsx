import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, Check, Download, FileText, Image as ImageIcon, ImageOff, Lock, Paperclip, PenLine, Save, Smartphone, Trash2 } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Button, Empty, IconButton, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { askDelete, copyFromPhone, copyToPhone, dismissSaveError, editBody, editName, isDirty, retryOpen, save, setFocus, useFiles, type OpenFile, type OpenPhone } from './store';
import { cx, fmtCount, fmtSize, fmtWhen } from './model';
import type { PhoneFull, PhoneKind } from './types';
import { useWidth } from './hooks';

/** The page a document is read and written on: the shell's own type, at a size made for reading. */
const PAGE: CSSProperties = { fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' };
const PAGE_CLASS = 'flex-1 min-h-[96px] w-full resize-none border-0 outline-none bg-layer text-t1 placeholder:text-t3 px-6 py-4 os-scroll';

/** Right pane: the open document - a Documents file to edit, or a phone document to look at. */
export default function Editor({ onBack }: { onBack?: () => void }) {
  const open = useFiles(s => s.open);
  const place = useFiles(s => s.place);

  if (!open) {
    return (
      <Empty icon={<FileText size={48} strokeWidth={1} />} title={t('ui.files.none_title')}>
        {t(place === 'phone' ? 'ui.files.phone_none_hint' : 'ui.files.none_hint')}
      </Empty>
    );
  }
  // Keyed by the opening, not by the document's id: a new document keeps its editor (caret, undo)
  // through the save that gives it one.
  return open.kind === 'file' ? <FileEditor key={open.seq} open={open} onBack={onBack} /> : <PhoneViewer key={open.seq} open={open} onBack={onBack} />;
}

function Back({ onBack }: { onBack?: () => void }) {
  if (!onBack) return null;
  return (
    <IconButton title={t('ui.files.back')} onClick={onBack} className="shrink-0">
      <ArrowLeft size={16} />
    </IconButton>
  );
}

/** A document that is still loading, or didn't. */
function Pending({ status, error }: { status: 'loading' | 'error'; error?: string }) {
  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }
  return (
    <div className="flex-1 p-6 flex flex-col gap-3 items-start">
      <InfoBar severity="error" title={t('ui.files.open_failed')}>
        {error}
      </InfoBar>
      <Button onClick={retryOpen}>{t('ui.common.retry')}</Button>
    </div>
  );
}

// ── A Documents file ───────────────────────────────────────────────────────────────────────

function FileEditor({ open, onBack }: { open: OpenFile; onBack?: () => void }) {
  const limits = useFiles(s => s.limits);
  const busy = useFiles(s => s.busy);
  const phone = useFiles(s => s.phone);
  const focus = useFiles(s => s.focus);
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const [ref, width] = useWidth<HTMLDivElement>();
  const nameRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const ready = open.status === 'ready';
  const draft = open.id === null;
  const dirty = isDirty(open);

  // A new document's name takes the caret, selected, ready to be typed over.
  useEffect(() => {
    if (!focus || !ready) return;
    const el = focus === 'name' ? nameRef.current : bodyRef.current;
    if (!el) return;
    el.focus();
    if (focus === 'name') nameRef.current?.select();
    setFocus(null);
  }, [focus, ready]);

  const used = open.body.length;
  const full = used >= limits.maxBody;
  const nearlyFull = !full && used >= limits.maxBody * 0.95;

  return (
    <div ref={ref} className="h-full flex flex-col min-h-0 page-in">
      <div className="h-12 shrink-0 flex items-center gap-1.5 px-2 border-b border-stroke">
        <Back onBack={onBack} />
        <TextInput
          ref={nameRef}
          value={open.name}
          onChange={e => editName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              bodyRef.current?.focus();
            }
          }}
          maxLength={limits.maxName}
          disabled={!ready}
          autoComplete="off"
          placeholder={t('ui.files.name_placeholder')}
          aria-label={t('ui.files.name_label')}
          className="flex-1 min-w-0 font-semibold"
        />
        {/* The label goes before the name field runs short of room. */}
        {phone && !draft && <ToPhone dirty={dirty} disabled={!ready || dirty || busy !== null} copying={busy === 'copy'} label={width >= 600} />}
        {onBack && (
          <IconButton title={t('ui.files.delete_hint')} onClick={askDelete} disabled={!ready || busy !== null} className="shrink-0">
            <Trash2 size={16} />
          </IconButton>
        )}
        <Button variant="accent" icon={<Save size={15} />} onClick={() => void save()} disabled={!ready || busy !== null || (!dirty && !draft)} title={t('ui.files.save_hint')} className="shrink-0">
          {t('ui.common.save')}
        </Button>
      </div>

      {open.saveError && (
        <div className="shrink-0 px-3 pt-3">
          <InfoBar severity="error" title={t('ui.files.save_failed')} onClose={dismissSaveError}>
            {open.saveError}
          </InfoBar>
        </div>
      )}

      {open.status !== 'ready' ? (
        <Pending status={open.status} error={open.error} />
      ) : (
        <>
          <textarea
            ref={bodyRef}
            value={open.body}
            onChange={e => editBody(e.target.value)}
            maxLength={limits.maxBody}
            spellCheck={false}
            autoComplete="off"
            placeholder={t('ui.files.body_placeholder')}
            aria-label={t('ui.files.body_label')}
            className={PAGE_CLASS}
            style={PAGE}
          />
          <div className="h-7 shrink-0 flex items-center gap-3 px-3 border-t border-stroke text-caption text-t2">
            <SaveMark saving={busy === 'save'} dirty={dirty} draft={draft} />
            <span className="flex-1 min-w-0 truncate text-t3">{!draft && !dirty && open.updatedAt ? t('ui.files.modified', fmtWhen(open.updatedAt, clock24)) : ''}</span>
            <span title={t('ui.files.count_hint')} className={cx('shrink-0 tabular-nums', full ? 'text-critical' : nearlyFull && 'text-caution')}>
              {t('ui.files.count', fmtCount(used), fmtCount(limits.maxBody))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The dirty marker, at the foot of the page so the name field keeps the header: a dot while there
 * are unsaved changes, a tick once the server has them.
 */
function SaveMark({ saving, dirty, draft }: { saving: boolean; dirty: boolean; draft: boolean }) {
  let icon: ReactNode = null;
  let text: string;
  let tone = 'text-t2';
  if (saving) {
    icon = <Spinner size={12} />;
    text = t('ui.files.saving');
  } else if (dirty) {
    icon = <span className="w-2 h-2 rounded-full bg-accent" />;
    text = t('ui.files.unsaved');
    tone = 'text-t1';
  } else if (draft) {
    text = t('ui.files.draft');
  } else {
    icon = <Check size={14} />;
    text = t('ui.files.saved');
  }
  return (
    <span className={cx('shrink-0 flex items-center gap-1.5 whitespace-nowrap', tone)}>
      {icon}
      {text}
    </span>
  );
}

/** Copy the stored document onto the phone. It copies what is saved, so unsaved changes come first. */
function ToPhone({ dirty, disabled, copying, label }: { dirty: boolean; disabled: boolean; copying: boolean; label: boolean }) {
  const title = t(dirty ? 'ui.files.to_phone_dirty' : 'ui.files.to_phone');
  const icon = copying ? <Spinner size={16} /> : <Smartphone size={16} />;
  if (label) {
    return (
      <Button variant="subtle" icon={icon} onClick={() => void copyToPhone()} disabled={disabled} title={title} className="shrink-0">
        {t('ui.files.to_phone')}
      </Button>
    );
  }
  return (
    <IconButton title={title} onClick={() => void copyToPhone()} disabled={disabled} className="shrink-0">
      {icon}
    </IconButton>
  );
}

// ── A phone document ───────────────────────────────────────────────────────────────────────

const KIND_ICON: Record<PhoneKind, typeof FileText> = { text: FileText, image: ImageIcon, file: Paperclip };

function PhoneViewer({ open, onBack }: { open: OpenPhone; onBack?: () => void }) {
  const busy = useFiles(s => s.busy);
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const [ref, width] = useWidth<HTMLDivElement>();
  const doc = open.status === 'ready' ? open.doc : null;
  const KindIcon = KIND_ICON[doc?.kind ?? 'text'];
  const roomy = width === 0 || width >= 430;

  return (
    <div ref={ref} className="h-full flex flex-col min-h-0 page-in">
      <div className="h-12 shrink-0 flex items-center gap-1.5 px-2 border-b border-stroke">
        <Back onBack={onBack} />
        <KindIcon size={16} className="shrink-0 ml-2 text-t2" />
        <div className="flex-1 min-w-0 px-1 text-body font-semibold text-t1 truncate" title={open.name || undefined}>
          {open.name || t('ui.files.untitled')}
        </div>
        {/* Only what has text can become a document here. */}
        {doc && doc.body !== '' &&
          (roomy ? (
            <Button icon={busy === 'copy' ? <Spinner size={15} /> : <Download size={15} />} onClick={() => void copyFromPhone()} disabled={busy !== null} title={t('ui.files.to_documents_hint')} className="shrink-0">
              {t('ui.files.to_documents')}
            </Button>
          ) : (
            <IconButton title={t('ui.files.to_documents_hint')} onClick={() => void copyFromPhone()} disabled={busy !== null} className="shrink-0">
              {busy === 'copy' ? <Spinner size={16} /> : <Download size={16} />}
            </IconButton>
          ))}
      </div>

      {!doc ? (
        <Pending status={open.status === 'error' ? 'error' : 'loading'} error={open.error} />
      ) : (
        <>
          <div className="shrink-0 flex items-center flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-b border-stroke text-caption text-t2">
            <Tag icon={<Smartphone size={14} />}>{t('ui.files.phone_caption')}</Tag>
            <Tag icon={<KindIcon size={14} />}>{t(`ui.files.kind_${doc.kind}`)}</Tag>
            {doc.locked && <Tag icon={<Lock size={14} />}>{t('ui.files.locked')}</Tag>}
            {doc.signatures.length > 0 && <Tag icon={<PenLine size={14} />}>{t('ui.files.signed')}</Tag>}
          </div>
          <PhoneBody doc={doc} />
          {doc.signatures.length > 0 && (
            <div className="shrink-0 max-h-[96px] overflow-y-auto os-scroll px-4 py-2 border-t border-stroke flex flex-col gap-1 text-caption text-t2">
              {doc.signatures.map((s, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <PenLine size={14} className="shrink-0 text-accent-text" />
                  <span className="truncate">{s.signedAt ? t('ui.files.signed_by_on', s.signer, fmtWhen(s.signedAt, clock24)) : t('ui.files.signed_by', s.signer)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="h-7 shrink-0 flex items-center gap-3 px-3 border-t border-stroke text-caption text-t2">
            <span className="flex-1 min-w-0 truncate">{doc.updatedAt ? t('ui.files.modified', fmtWhen(doc.updatedAt, clock24)) : ''}</span>
            {doc.size > 0 && <span className="shrink-0 tabular-nums">{fmtSize(doc.size)}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function Tag({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

/** What can be shown of a phone document: its text, a picture, or a line saying where to open it. */
function PhoneBody({ doc }: { doc: PhoneFull }) {
  const [broken, setBroken] = useState(false);

  if (doc.kind === 'image') {
    if (!doc.url || broken) {
      return (
        <Empty icon={<ImageOff size={40} strokeWidth={1.25} />} title={t('ui.files.image_missing')}>
          {t('ui.files.on_phone_hint')}
        </Empty>
      );
    }
    return (
      <div className="flex-1 min-h-0 p-4 flex items-center justify-center overflow-hidden">
        <img src={doc.url} alt={doc.name} draggable={false} onError={() => setBroken(true)} className="max-w-full max-h-full object-contain rounded-ctl border border-stroke" />
      </div>
    );
  }
  if (doc.body === '') {
    return doc.kind === 'file' ? (
      <Empty icon={<Paperclip size={40} strokeWidth={1.25} />} title={t('ui.files.file_title')}>
        {t('ui.files.on_phone_hint')}
      </Empty>
    ) : (
      <Empty icon={<FileText size={40} strokeWidth={1.25} />} title={t('ui.files.phone_text_empty')} />
    );
  }
  return (
    <>
      {doc.kind === 'file' && (
        <div className="shrink-0 px-3 pt-3">
          <InfoBar>{t('ui.files.file_note')}</InfoBar>
        </div>
      )}
      <textarea readOnly value={doc.body} spellCheck={false} aria-label={t('ui.files.body_label')} className={PAGE_CLASS} style={PAGE} />
    </>
  );
}
