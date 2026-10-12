import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { closeViewer, stepViewer, useNotes } from './store';
import { cx } from './model';

// The in-window photo/sketch viewer. It sits on a dark scrim like a photo viewer, so its few
// controls are light-on-dark in every theme and style. They are deliberately not kit buttons:
// retro paints .ctl-iconbtn glyphs black, which would vanish on the scrim.

const navBtn =
  'w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:bg-white/25 disabled:opacity-0 disabled:pointer-events-none transition-colors duration-150';

export default function MediaViewer() {
  const open = useNotes(s => s.open);
  const index = useNotes(s => s.viewer);
  const exitRef = useExitFx('fade-out');
  if (!open || index === null) return null;
  const items = [...open.images.map(src => ({ src, sketch: false })), ...open.sketches.map(src => ({ src, sketch: true }))];
  if (items.length === 0) return null;
  const i = Math.min(items.length - 1, Math.max(0, index));
  const item = items[i];
  const n = item.sketch ? i - open.images.length + 1 : i + 1;
  const label = t(item.sketch ? 'ui.notes.sketch_n' : 'ui.notes.photo_n', n);

  return (
    <div
      ref={exitRef}
      role="dialog"
      aria-label={label}
      className="absolute inset-0 z-40 flex flex-col bg-black/85 fade-in"
      onMouseDown={e => {
        if (e.target === e.currentTarget) closeViewer();
      }}
    >
      <div className="h-12 shrink-0 flex items-center gap-3 pl-4 pr-2 text-white">
        <span className="text-body font-semibold truncate">{label}</span>
        {items.length > 1 && <span className="text-caption opacity-70 tabular-nums">{t('ui.notes.viewer_of', i + 1, items.length)}</span>}
        <span className="flex-1" />
        <button type="button" title={t('ui.common.close')} aria-label={t('ui.common.close')} onClick={closeViewer} className={cx(navBtn, 'w-9 h-9')}>
          <X size={18} />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 flex items-center gap-3 px-3 pb-6"
        onMouseDown={e => {
          if (e.target === e.currentTarget) closeViewer();
        }}
      >
        <button type="button" title={t('ui.notes.previous')} aria-label={t('ui.notes.previous')} onClick={() => stepViewer(-1)} disabled={i === 0} className={navBtn}>
          <ChevronLeft size={20} />
        </button>
        <div
          className="flex-1 min-w-0 h-full flex items-center justify-center"
          onMouseDown={e => {
            if (e.target === e.currentTarget) closeViewer();
          }}
        >
          <Picture key={`${i}:${item.src.length}`} src={item.src} sketch={item.sketch} />
        </div>
        <button type="button" title={t('ui.notes.next')} aria-label={t('ui.notes.next')} onClick={() => stepViewer(1)} disabled={i === items.length - 1} className={navBtn}>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

function Picture({ src, sketch }: { src: string; sketch: boolean }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="flex flex-col items-center gap-2 text-white/70 text-body">
        <ImageOff size={40} strokeWidth={1.25} />
        {t('ui.notes.image_missing')}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
      // The phone composites sketches over white; photos are shown as they are.
      className={cx('max-w-full max-h-full object-contain rounded-ctl shadow-flyout select-none pop-in', sketch && 'bg-white')}
    />
  );
}
