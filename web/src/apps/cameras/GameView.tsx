import { useEffect, useRef } from 'react';
import { isEnvBrowser } from '@/nui/bridge';
import { gameView } from '@/lib/gameView';
import { t } from '@/i18n';

// A camera's picture, in the window: the game's own view (src/lib/gameView.ts), which while a
// camera is watched is that camera's (client/computers/cameras.lua), drawn again every frame.
//
// The game hands its picture to one canvas at a time, and the page holding the OS wants it first,
// for its still of the room (src/host): so this one keeps its hands off (`paused`) until the game
// says it is looking through a camera, by when the still has been taken and let go of.
//
// It is the watching player's game that draws it, so it is theirs alone: the recording of this page
// that other players see on the prop (src/mirror) leaves this canvas out (data-mirror-skip) - they
// get the window, the camera's name and an empty picture.

/** Frames drawn without the game's picture before the page is taken not to be given one at all. */
const GIVE_UP = 150;
/** The most pixels across the picture is drawn at: it is a security monitor, not a cinema. */
const MAX_W = 1600;

export default function GameView({ paused, onLive, onFail }: { paused: boolean; onLive: () => void; onFail: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ paused, onLive, onFail });
  latest.current = { paused, onLive, onFail };

  useEffect(() => {
    if (isEnvBrowser()) {
      latest.current.onLive();
      return;
    }
    const canvas = ref.current;
    if (!canvas) return;
    const view = gameView(canvas);
    if (!view) {
      latest.current.onFail();
      return;
    }
    let frame = 0;
    let waited = 0;
    let live = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (latest.current.paused) return;
      // (drawn at the size it is shown at: the box changes with the window)
      const scale = Math.min(window.devicePixelRatio || 1, MAX_W / Math.max(1, canvas.clientWidth));
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (view.draw()) {
        waited = 0;
        if (!live) {
          live = true;
          latest.current.onLive();
        }
      } else if (!live && ++waited >= GIVE_UP) {
        cancelAnimationFrame(frame);
        view.release();
        latest.current.onFail();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      view.dispose();
    };
  }, []);

  // In a browser there is no game to draw: something for everything round the picture to sit on.
  if (isEnvBrowser()) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(120% 90% at 50% 40%, #3a4250 0%, #171b22 70%, #0c0e12 100%)', color: 'rgba(242, 244, 247, 0.45)', fontSize: 13 }}>
        {t('ui.cameras.no_picture')}
      </div>
    );
  }
  return <canvas ref={ref} data-mirror-skip className="absolute inset-0 w-full h-full block" />;
}
