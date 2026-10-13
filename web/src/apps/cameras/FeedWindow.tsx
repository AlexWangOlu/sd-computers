import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { displayAspect } from '@/lib/gameView';
import { t } from '@/i18n';
import { Button, IconButton } from '@/ui/controls';
import GameView from './GameView';
import { Rec, Static, Tint, useStamp } from './Overlay';
import { useLook, ZOOM_STEP } from './useLook';
import type { Camera, Control, Stage, Watching } from './types';

// A camera's picture in the app's window: a bar - back to the list, whose picture it is, the
// camera before and after, zoom, expand - and under it the picture, as large as the window lets a
// picture of the display's shape be. The picture is dragged to look round and wheeled over to zoom.

export interface FeedProps {
  /** The camera asked for (its picture may still be on its way). */
  camera: Camera;
  stage: Stage;
  /** What the game is showing (null until it is showing a camera). */
  watching: Watching | null;
  cameras: Camera[];
  /** The picture is over the whole display for now (CameraView): the one in the window rests. */
  expanded: boolean;
  onSwitch: (id: string) => void;
  onControl: (c: Control) => Promise<number | null>;
  onExpand: () => void;
  onBack: () => void;
  /** The page was not given the game's picture: there is nothing to show in a window. */
  onUnavailable: () => void;
}

export default function FeedWindow({ camera, stage, watching, cameras, expanded, onSwitch, onControl, onExpand, onBack, onUnavailable }: FeedProps) {
  const scope = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [zoom, setZoom] = useState(watching?.zoom ?? 1);
  const stamp = useStamp();

  const index = cameras.findIndex(c => c.id === camera.id);
  const several = cameras.length > 1;
  // (the picture is the camera's own once the game says it is looking through that one)
  const live = stage === 'live' && drawn && watching?.id === camera.id;
  const filter = watching?.filter ?? 'cctv';
  const maxZoom = watching?.maxZoom ?? 3;

  useEffect(() => setZoom(watching?.zoom ?? 1), [watching?.id, watching?.zoom]);

  // The picture is the display's shape, whatever shape the window is: as large as fits.
  useLayoutEffect(() => {
    const el = room.current;
    if (!el) return;
    const fit = () => {
      const aspect = displayAspect();
      const w = Math.min(el.clientWidth, el.clientHeight * aspect);
      setSize({ w: Math.floor(w), h: Math.floor(w / aspect) });
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // The keys are the picture's as soon as it is up, without a click on it first.
  useEffect(() => scope.current?.focus({ preventScroll: true }), []);

  const step = (dir: number) => {
    if (!several || stage !== 'live') return;
    onSwitch(cameras[(Math.max(0, index) + dir + cameras.length) % cameras.length].id);
  };
  const control = (c: Control) => {
    if (!live) return;
    void onControl(c).then(z => {
      if (typeof z === 'number') setZoom(z);
    });
  };

  useLook(surface, scope, { live: live && !expanded, onControl, onZoom: setZoom, onStep: step, onToggle: () => live && onExpand(), onBack });

  return (
    <div ref={scope} tabIndex={-1} className="h-full w-full flex flex-col bg-layer outline-none">
      <div className="flex items-center gap-1 h-12 pl-2 pr-3 shrink-0 border-b border-stroke">
        <Button variant="subtle" icon={<ArrowLeft size={15} />} disabled={stage === 'leaving'} onClick={onBack}>
          {t('ui.cameras.all')}
        </Button>
        <div className="min-w-0 flex-1 px-2 leading-tight">
          <div className="text-body font-semibold text-t1 truncate">{camera.label}</div>
          <div className="text-caption text-t2 truncate">
            {[camera.area, several && index >= 0 ? t('ui.cameras.position', index + 1, cameras.length) : null].filter(Boolean).join('  ·  ') || ' '}
          </div>
        </div>
        {several && (
          <>
            <IconButton title={t('ui.cameras.previous')} disabled={stage !== 'live'} onClick={() => step(-1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton title={t('ui.cameras.next')} disabled={stage !== 'live'} onClick={() => step(1)}>
              <ChevronRight size={16} />
            </IconButton>
            <span className="w-px h-5 mx-1 bg-[var(--stroke)]" />
          </>
        )}
        <IconButton title={t('ui.cameras.zoom_out')} disabled={!live || zoom <= 1.001} onClick={() => control({ zoom: 1 / ZOOM_STEP })}>
          <ZoomOut size={16} />
        </IconButton>
        <span className="w-10 text-center text-caption text-t2 tabular-nums">{`${zoom.toFixed(1)}×`}</span>
        <IconButton title={t('ui.cameras.zoom_in')} disabled={!live || zoom >= maxZoom - 0.001} onClick={() => control({ zoom: ZOOM_STEP })}>
          <ZoomIn size={16} />
        </IconButton>
        <IconButton title={t('ui.cameras.key_reset')} disabled={!live} onClick={() => control({ reset: true })}>
          <RotateCcw size={15} />
        </IconButton>
        <span className="w-px h-5 mx-1 bg-[var(--stroke)]" />
        <Button icon={<Maximize2 size={14} />} disabled={!live} onClick={onExpand}>
          {t('ui.cameras.expand')}
        </Button>
      </div>

      <div ref={room} className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-black">
        <div ref={surface} className="cam-picture" style={size ? { width: size.w, height: size.h } : { width: '100%', height: '100%' }}>
          {/* (not before the game is looking through a camera: until then its picture is the room, and the page holding the OS's to take) */}
          <GameView paused={expanded || !watching} onLive={() => setDrawn(true)} onFail={onUnavailable} />
          <Tint filter={filter} />
          {filter !== 'none' && live && (
            <>
              <div className="cam-osd absolute top-3 left-4 flex items-center gap-3">
                <Rec />
                <span>{`${t('ui.cameras.cam', String(Math.max(0, index) + 1).padStart(2, '0'))}  ${camera.label.toUpperCase()}`}</span>
              </div>
              <div className="cam-osd absolute top-3 right-4">{stamp}</div>
              {camera.area && <div className="cam-osd absolute bottom-3 left-4">{camera.area.toUpperCase()}</div>}
              <div className="cam-osd absolute bottom-3 right-4">{`${zoom.toFixed(1)}×`}</div>
            </>
          )}
          <Static on={!live}>{stage === 'leaving' ? t('ui.cameras.disconnecting') : t('ui.cameras.connecting', camera.label)}</Static>
        </div>
      </div>
    </div>
  );
}
