import { useCallback, useEffect, useState } from 'react';
import { ImageOff, Link2, Plus } from 'lucide-react';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { Button, InfoBar, Spinner, TextInput } from '@/ui/controls';
import { cx, drawable, normList, normPhoto } from './model';
import type { ListData, Photo } from './types';

// Choosing a picture out of the gallery, for another app (Files puts one into a document). It is
// the Photos app's own list - the character's pictures, and the phone's while that is linked - with
// the same way in for a new one: its link. Drawn inside the window of the app that asked, like a
// <Dialog>: that app's root is `relative`.

/** Add a picture by its link: the server says whether that host is one pictures may come from. */
export async function addPhoto(url: string): Promise<{ photo?: Photo; error?: string }> {
  const r = await rpc<unknown>('photos:add', { url: url.trim() });
  const photo = r.ok ? normPhoto(r.data) : null;
  return photo ? { photo } : { error: r.error ?? t('ui.common.error') };
}

export function PhotoPicker({ onPick, onClose }: { onPick: (photo: Photo) => void; onClose: () => void }) {
  const exitRef = useExitFx('fade-out');
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void rpc<ListData>('photos:list').then(r => {
      if (!alive) return;
      if (!r.ok) setError(r.error ?? t('ui.common.error'));
      setPhotos(r.ok ? normList(r.data?.photos).filter(p => !p.video && drawable(p)) : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Escape puts the picker away and goes no further (not to the app under it, nor to the machine).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (!busy) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [busy, onClose]);

  const add = useCallback(async () => {
    if (!link.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r = await addPhoto(link);
    setBusy(false);
    if (r.photo) onPick(r.photo);
    else setError(r.error ?? t('ui.common.error'));
  }, [link, busy, onPick]);

  return (
    <div ref={exitRef} className="ctl-dialog-shade absolute inset-0 z-40 flex items-center justify-center bg-black/40 fade-in" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
      <div className="ctl-dialog w-[min(620px,94%)] max-h-[88%] flex flex-col rounded-win bg-layer shadow-flyout overflow-hidden">
        <div className="shrink-0 px-6 pt-5 pb-3">
          <div className="ctl-dialog-title text-subtitle font-semibold text-t1">{t('ui.photos.pick_title')}</div>
          <div className="mt-1 text-caption text-t2">{t('ui.photos.pick_hint')}</div>
        </div>

        {error && (
          <div className="shrink-0 px-6 pb-3">
            <InfoBar severity="error" onClose={() => setError(null)}>
              {error}
            </InfoBar>
          </div>
        )}

        <div className="flex-1 min-h-[140px] overflow-y-auto os-scroll px-6">
          {photos === null ? (
            <div className="h-36 flex items-center justify-center">
              <Spinner size={24} />
            </div>
          ) : photos.length === 0 ? (
            <div className="h-36 flex flex-col items-center justify-center gap-2 text-t3 text-caption text-center">
              <ImageOff size={28} strokeWidth={1.25} />
              {t('ui.photos.pick_empty')}
            </div>
          ) : (
            <div className="grid gap-1.5 pb-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
              {photos.map(p => (
                <button
                  key={p.id}
                  type="button"
                  title={t(p.place === 'phone' ? 'ui.photos.place_phone' : 'ui.photos.place_computer')}
                  disabled={busy}
                  onClick={() => onPick(p)}
                  className={cx('group relative block w-full aspect-square overflow-hidden rounded-ctl bg-card outline-none')}
                >
                  <img src={p.url} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-ctl ring-inset ring-accent group-hover:ring-2 group-focus-visible:ring-2" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 pt-3 pb-1 flex items-center gap-2">
          <Link2 size={16} className="shrink-0 text-t3" />
          <TextInput
            value={link}
            onChange={e => setLink(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void add();
            }}
            placeholder={t('ui.photos.link_placeholder')}
            aria-label={t('ui.photos.link_label')}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            className="flex-1 min-w-0"
          />
          <Button icon={busy ? <Spinner size={14} /> : <Plus size={15} />} disabled={busy || !link.trim()} onClick={() => void add()} className="shrink-0">
            {t('ui.photos.add_use')}
          </Button>
        </div>

        <div className="ctl-dialog-actions shrink-0 flex justify-end gap-2 px-6 py-4 mt-3 bg-win border-t border-stroke">
          <Button disabled={busy} onClick={onClose}>
            {t('ui.common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
