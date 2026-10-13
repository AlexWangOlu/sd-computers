import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Image as ImageIcon, ImageOff, Images, Play, RefreshCw } from 'lucide-react';
import type { AppProps } from '../registry';
import { selectActiveId, useOS } from '@/store/os';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { Button, Empty, InfoBar, Spinner } from '@/ui/controls';
import Viewer from './Viewer';
import { countLabel, cx, dayHeading, drawable, groupByDay, normList, takenAt, type DayGroup } from './model';
import type { ListData, Photo } from './types';

// Photos - the character's PHONE gallery over the optional sd-phone link (photos:list), to look
// at: nothing here takes, imports or deletes a photo. index.tsx is the whole window (loading, the
// grid by day, shortcuts); the viewer is next to it and the data helpers are in model.ts.

/** The first load fills the window, a manual one spins the Refresh button, a silent one shows nothing. */
type LoadMode = 'initial' | 'manual' | 'silent';

/** Tiles grow with the window: about four across at the smallest size, never wider than 190px. */
const GRID = 'repeat(auto-fill, minmax(clamp(112px, 15%, 190px), 1fr))';

export default function Photos({ win }: AppProps) {
  const isActive = useOS(s => selectActiveId(s) === win.id);
  const clock24 = useOS(s => !!s.payload?.desktop.clock24);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [capped, setCapped] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Why the last manual refresh failed (the grid stays as it was). */
  const [notice, setNotice] = useState<string | null>(null);
  /** The id of the photo open in the viewer. */
  const [viewing, setViewing] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async (mode: LoadMode) => {
    const mine = ++seq.current;
    if (mode === 'initial') setStatus('loading');
    if (mode === 'manual') {
      setRefreshing(true);
      setNotice(null);
    }
    const r = await rpc<ListData>('photos:list');
    // Closed meanwhile, or a newer load is on its way: that one decides what is shown.
    if (!mounted.current || mine !== seq.current) return;
    setRefreshing(false);
    if (!r.ok) {
      const why = r.error || t('ui.common.error');
      if (mode === 'initial') {
        setError(why);
        setStatus('error');
      } else if (mode === 'manual') {
        setNotice(why);
      }
      return;
    }
    setPhotos(normList(r.data?.photos));
    setCapped(r.data?.capped === true);
    setNotice(null);
    setStatus('ready');
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load('initial');
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Nothing is pushed when the phone takes a photo: look again whenever the window comes back to the front.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current && status === 'ready') void load('silent');
    wasActive.current = isActive;
  }, [isActive, status, load]);

  const index = viewing === null ? -1 : photos.findIndex(p => p.id === viewing);

  // The open photo was deleted on the phone: a refresh took it out from under the viewer.
  useEffect(() => {
    if (viewing !== null && index < 0) setViewing(null);
  }, [viewing, index]);

  const open = useCallback((id: string) => setViewing(id), []);

  const step = useCallback(
    (by: number) => {
      const next = photos[index + by];
      if (index >= 0 && next) setViewing(next.id);
    },
    [photos, index],
  );

  /** Close the viewer and leave the grid on the photo that was showing, with the focus on it. */
  const close = useCallback(() => {
    const id = viewing;
    setViewing(null);
    if (id === null) return;
    window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-photo="${CSS.escape(id)}"]`)?.focus());
  }, [viewing]);

  // The viewer's keys, while this is the focused window: Escape closes, the arrows step.
  useEffect(() => {
    if (!isActive || index < 0) return;
    const onKey = (e: KeyboardEvent) => {
      const os = useOS.getState();
      if (os.start || os.flyout) return;
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // A clip that has the focus seeks with the arrows.
        if (e.target instanceof HTMLVideoElement) return;
        step(e.key === 'ArrowLeft' ? -1 : 1);
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, index, step, close]);

  const groups = useMemo(() => groupByDay(photos), [photos]);

  let content;
  if (status === 'loading') {
    content = (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-t2">
        <Spinner size={28} />
        <span className="text-caption">{t('ui.common.loading')}</span>
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-[min(420px,100%)] flex flex-col gap-3">
          <InfoBar severity="error" title={t('ui.photos.load_failed')}>
            {error}
          </InfoBar>
          <div>
            <Button onClick={() => void load('initial')}>{t('ui.common.retry')}</Button>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="h-full flex flex-col min-h-0">
        {notice && (
          <div className="shrink-0 px-5 pt-3 flex flex-col items-start gap-2">
            <div className="w-full">
              <InfoBar severity="warning" title={t('ui.photos.refresh_failed')} onClose={() => setNotice(null)}>
                {notice}
              </InfoBar>
            </div>
            <Button compact onClick={() => void load('manual')} disabled={refreshing}>
              {t('ui.common.retry')}
            </Button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto os-scroll">
          {photos.length === 0 ? (
            <Empty icon={<Images size={40} strokeWidth={1.25} />} title={t('ui.photos.empty_title')}>
              {t('ui.photos.empty_hint')}
            </Empty>
          ) : (
            <div className="pb-5 page-in">
              {groups.map(g => (
                <Day key={g.key} group={g} clock24={clock24} onOpen={open} />
              ))}
              {capped && <div className="px-5 pt-5 text-caption text-t3 text-center">{t('ui.photos.capped', photos.length)}</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative h-full w-full flex flex-col bg-win text-t1 overflow-hidden">
      <div className="shrink-0 h-14 flex items-center gap-3 pl-5 pr-3">
        <div className="flex-1 min-w-0 flex items-baseline gap-3">
          <span className="shrink-0 text-subtitle font-semibold text-t1">{t('ui.photos.title')}</span>
          {status === 'ready' && photos.length > 0 && <span className="min-w-0 text-caption text-t2 truncate">{countLabel(photos)}</span>}
        </div>
        <Button
          compact
          icon={refreshing ? <Spinner size={14} /> : <RefreshCw size={14} />}
          onClick={() => void load('manual')}
          disabled={status !== 'ready' || refreshing}
          className="shrink-0"
        >
          {t('ui.common.refresh')}
        </Button>
      </div>
      <div className="flex-1 min-h-0 bg-layer border-t border-stroke">{content}</div>
      {index >= 0 && <Viewer photos={photos} index={index} clock24={clock24} onStep={step} onClose={close} />}
    </div>
  );
}

/** One day: its heading (which stays at the top while its photos scroll under it) and its tiles. */
function Day({ group, clock24, onOpen }: { group: DayGroup; clock24: boolean; onOpen: (id: string) => void }) {
  const head = dayHeading(group);
  return (
    <section>
      <h3 className="sticky top-0 z-10 flex items-baseline gap-2 bg-layer px-5 pt-4 pb-2">
        <span className="shrink-0 text-body font-semibold text-t1">{head.title}</span>
        {head.sub && <span className="min-w-0 truncate text-caption text-t2">{head.sub}</span>}
        <span className="flex-1" />
        <span className="shrink-0 text-caption text-t3 tabular-nums">{group.photos.length}</span>
      </h3>
      <div className="grid gap-1.5 px-5" style={{ gridTemplateColumns: GRID }}>
        {group.photos.map(p => (
          <Tile key={p.id} photo={p} label={tileLabel(p, clock24)} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

/** What a tile says on hover and to a screen reader: "Photo - Monday, October 5 at 6:05 PM". */
function tileLabel(p: Photo, clock24: boolean): string {
  const kind = t(p.video ? 'ui.photos.video' : 'ui.photos.photo');
  const when = takenAt(p, clock24);
  return when ? t('ui.photos.kind_when', kind, when) : kind;
}

/**
 * One square of the grid. The picture is only asked for as it scrolls into view, fades in over a
 * neutral placeholder, and leaves a "no picture" glyph when it won't load. A clip has no still to
 * show, so it is a placeholder with a play glyph.
 */
const Tile = memo(function Tile({ photo, label, onOpen }: { photo: Photo; label: string; onOpen: (id: string) => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'broken'>(() => (drawable(photo) ? 'loading' : 'broken'));
  return (
    <button
      type="button"
      data-photo={photo.id}
      title={label}
      aria-label={label}
      onClick={() => onOpen(photo.id)}
      className="group relative block w-full aspect-square overflow-hidden rounded-ctl bg-card outline-none"
    >
      <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-t3">
        {photo.video ? (
          <>
            <Play size={22} strokeWidth={1.5} />
            <span className="text-caption">{t('ui.photos.video')}</span>
          </>
        ) : state === 'broken' ? (
          <ImageOff size={22} strokeWidth={1.5} />
        ) : (
          <ImageIcon size={22} strokeWidth={1.5} />
        )}
      </span>
      {!photo.video && state !== 'broken' && (
        <img
          src={photo.url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setState('ready')}
          onError={() => setState('broken')}
          className={cx('absolute inset-0 w-full h-full object-cover transition-opacity duration-300', state === 'ready' ? 'opacity-100' : 'opacity-0')}
        />
      )}
      {photo.favorite && (
        // On a dark dot of its own: the photo under it can be any colour.
        <span title={t('ui.photos.favorite')} className="absolute left-1.5 bottom-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-white">
          <Heart size={11} fill="currentColor" />
        </span>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-ctl ring-inset ring-accent group-hover:ring-2 group-focus-visible:ring-2" />
    </button>
  );
});
