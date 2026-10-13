import { useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Heart, ImageOff, VideoOff, X } from 'lucide-react';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { Spinner } from '@/ui/controls';
import { cx, drawable, takenAt } from './model';
import type { Photo } from './types';

// The in-window viewer: one photo at a time on a dark scrim, stepped with the side buttons (the
// arrow keys and Escape are handled by index.tsx, which knows whether the window has the focus).
// Its few controls are light-on-dark in every theme and style, and deliberately not kit buttons:
// retro paints .ctl-iconbtn glyphs black, which would vanish on the scrim.

const navBtn =
  'w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:bg-white/25 disabled:opacity-0 disabled:pointer-events-none transition-colors duration-150';

export default function Viewer({
  photos,
  index,
  clock24,
  onStep,
  onClose,
}: {
  photos: Photo[];
  index: number;
  clock24: boolean;
  onStep: (by: number) => void;
  onClose: () => void;
}) {
  const exitRef = useExitFx('fade-out');
  const photo = photos[index];
  if (!photo) return null;
  const label = takenAt(photo, clock24) || t(photo.video ? 'ui.photos.video' : 'ui.photos.photo');
  // A press on the scrim itself, not on the picture or a button, closes.
  const onScrim = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div ref={exitRef} role="dialog" aria-label={label} className="absolute inset-0 z-40 flex flex-col bg-black/85 fade-in" onMouseDown={onScrim}>
      <div className="h-12 shrink-0 flex items-center gap-3 pl-4 pr-2 text-white">
        <span className="min-w-0 text-body font-semibold truncate">{label}</span>
        {photo.favorite && (
          <span title={t('ui.photos.favorite')} className="shrink-0 flex">
            <Heart size={14} fill="currentColor" />
          </span>
        )}
        {photos.length > 1 && <span className="shrink-0 text-caption opacity-70 tabular-nums">{t('ui.photos.viewer_of', index + 1, photos.length)}</span>}
        <span className="flex-1" />
        <button type="button" title={t('ui.common.close')} aria-label={t('ui.common.close')} onClick={onClose} className={cx(navBtn, 'w-9 h-9')}>
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center gap-3 px-3 pb-6" onMouseDown={onScrim}>
        <button type="button" title={t('ui.photos.previous')} aria-label={t('ui.photos.previous')} onClick={() => onStep(-1)} disabled={index === 0} className={navBtn}>
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0 h-full flex items-center justify-center" onMouseDown={onScrim}>
          <Picture key={photo.id} photo={photo} />
        </div>
        <button
          type="button"
          title={t('ui.photos.next')}
          aria-label={t('ui.photos.next')}
          onClick={() => onStep(1)}
          disabled={index === photos.length - 1}
          className={navBtn}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

/** The photo itself (a spinner until it has arrived), a player for a clip, or why there is neither. */
function Picture({ photo }: { photo: Photo }) {
  const [state, setState] = useState<'loading' | 'ready' | 'broken'>(() => (drawable(photo) ? 'loading' : 'broken'));
  if (state === 'broken') {
    return (
      <div className="flex flex-col items-center gap-2 text-white/70 text-body text-center">
        {photo.video ? <VideoOff size={40} strokeWidth={1.25} /> : <ImageOff size={40} strokeWidth={1.25} />}
        {t(photo.video ? 'ui.photos.video_missing' : 'ui.photos.image_missing')}
      </div>
    );
  }
  if (photo.video) {
    // Not autoplayed: it starts when the player presses play, like on the phone.
    return (
      <video
        src={photo.url}
        controls
        playsInline
        preload="metadata"
        onError={() => setState('broken')}
        className="max-w-full max-h-full rounded-ctl shadow-flyout bg-black outline-none pop-in"
      />
    );
  }
  return (
    <>
      {state === 'loading' && <Spinner size={28} />}
      <img
        src={photo.url}
        alt=""
        draggable={false}
        onLoad={() => setState('ready')}
        onError={() => setState('broken')}
        className={cx('max-w-full max-h-full object-contain rounded-ctl shadow-flyout select-none', state === 'ready' ? 'pop-in' : 'hidden')}
      />
    </>
  );
}
