import { useRef, useState, type ReactNode } from 'react';
import { Save, Send } from 'lucide-react';
import { Button, InfoBar, Spinner, TextArea, TextInput, Toggle } from '@/ui/controls';
import { t } from '@/i18n';
import { PageHeader, cx } from './parts';
import type { Draft, Limits } from './types';

interface Props {
  jobLabel: string;
  limits: Limits;
  /** Rewording an announcement that is already up: no pin switch, that has its own button. */
  editing: boolean;
  /** The board is full: posting pushes the oldest unpinned announcement off. */
  atCap: boolean;
  value: Draft;
  onChange: (d: Draft) => void;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  /** The page's InfoBar stack: a refused post is explained in it, with the draft still in the form. */
  notices: ReactNode;
}

/**
 * The form a boss writes an announcement in. It takes the page over rather than opening as a
 * dialog, so it scrolls and stays usable in the smallest window. The draft lives with the caller:
 * Cancel puts it away, it is not thrown out.
 */
export default function Composer({ jobLabel, limits, editing, atCap, value, onChange, saving, onSubmit, onCancel, notices }: Props) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [arriving, setArriving] = useState(true); // (the entrance plays once, not again each time the page is switched back to)
  const hasBody = limits.maxBody > 0;
  const used = value.body.length;
  const ready = value.title.trim() !== '' && !saving;

  return (
    <div className="h-full overflow-y-auto os-scroll">
      <div className={cx('px-6 pt-5 pb-8 max-w-[760px]', arriving && 'page-in')} onAnimationEnd={e => e.target === e.currentTarget && setArriving(false)}>
        <PageHeader title={t(editing ? 'ui.board.edit_post' : 'ui.board.new_post')} subtitle={jobLabel} />
        {atCap && !editing && (
          <div className="mb-4">
            <InfoBar severity="warning">{t('ui.board.full_note', limits.maxPosts)}</InfoBar>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-caption text-t2">{t('ui.board.field_title')}</span>
            <TextInput
              autoFocus
              value={value.title}
              maxLength={limits.maxTitle}
              placeholder={t('ui.board.field_title_hint')}
              disabled={saving}
              onChange={e => onChange({ ...value, title: e.target.value })}
              // (Enter carries on into the text; it never posts a half-written announcement)
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                bodyRef.current?.focus();
              }}
            />
          </label>

          {hasBody && (
            <label className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3 text-caption text-t2">
                <span>{t('ui.board.field_body')}</span>
                <span className={cx('tabular-nums', used >= limits.maxBody ? 'text-critical' : used >= limits.maxBody * 0.9 && 'text-caution')}>
                  {t('ui.board.chars', used, limits.maxBody)}
                </span>
              </span>
              <TextArea
                ref={bodyRef}
                rows={8}
                value={value.body}
                maxLength={limits.maxBody}
                placeholder={t('ui.board.field_body_hint')}
                disabled={saving}
                onChange={e => onChange({ ...value, body: e.target.value })}
              />
            </label>
          )}

          {!editing && (
            <div className="flex flex-col gap-1">
              <Toggle checked={value.pinned} onChange={pinned => onChange({ ...value, pinned })} label={t('ui.board.pin_toggle')} disabled={saving} />
              <div className="text-caption text-t3">{t('ui.board.pin_toggle_hint')}</div>
            </div>
          )}

          {/* (beside the buttons: in a small window the top of the form has scrolled away by now) */}
          {notices}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button onClick={onCancel} disabled={saving}>
              {t('ui.common.cancel')}
            </Button>
            <Button
              variant="accent"
              icon={saving ? <Spinner size={14} className="!text-accent-on" /> : editing ? <Save size={14} /> : <Send size={14} />}
              disabled={!ready}
              onClick={onSubmit}
            >
              {t(editing ? 'ui.common.save' : 'ui.board.post')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
