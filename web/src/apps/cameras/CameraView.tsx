import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { isEnvBrowser } from '@/nui/bridge';
import { useOS } from '@/store/os';
import { fmtShortDate, fmtTime, useNow } from '@/lib/format';
import { t } from '@/i18n';
import type { Camera, Control, Watching } from './types';

// The frame over a camera's picture. The picture itself is the game: this draws nothing over the
// middle of it - a name plate, the time, a line of keys - and turns what the mouse and the keys do
// into turns of the camera. It is put on the page beside the desktop, not in the window: while it
// is up the desktop is hidden altogether, and the page holding the OS gives it the whole display
// (src/host/Host.tsx). Its colours are its own - white on the picture, like any camera's overlay -
// since it sits outside the desktop the theme belongs to.

/** Display widths a second an arrow key turns the camera. */
const KEY_SPEED = 0.3;
/** Zoom per notch of the wheel, and per press of + / -. */
const ZOOM_STEP = 1.15;

const plate: CSSProperties = { background: 'rgba(8, 10, 14, 0.62)', border: '1px solid rgba(255, 255, 255, 0.14)', color: '#f2f4f7' };
const key: CSSProperties = { border: '1px solid rgba(255, 255, 255, 0.28)', background: 'rgba(255, 255, 255, 0.08)' };

const Key = ({ children }: { children: string }) => (
  <span className="inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium" style={key}>
    {children}
  </span>
);

const Hint = ({ keys, label }: { keys: string[]; label: string }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    {keys.map(k => (
      <Key key={k}>{k}</Key>
    ))}
    <span style={{ color: 'rgba(242, 244, 247, 0.8)' }}>{label}</span>
  </span>
);

export default function CameraView({
  watching,
  cameras,
  onSwitch,
  onControl,
  onBack,
}: {
  watching: Watching;
  cameras: Camera[];
  onSwitch: (id: string) => void;
  onControl: (c: Control) => Promise<number | null>;
  onBack: () => void;
}) {
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const now = useNow();
  const [zoom, setZoom] = useState(watching.zoom ?? 1);
  const surface = useRef<HTMLDivElement>(null);

  // Latest of everything the listeners below use, so they are bound once.
  const live = useRef({ watching, cameras, onSwitch, onControl, onBack });
  live.current = { watching, cameras, onSwitch, onControl, onBack };

  useEffect(() => setZoom(watching.zoom ?? 1), [watching.id, watching.zoom]);

  // The desktop is not part of this picture: hidden for as long as the frame is up.
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const was = root.style.visibility;
    root.style.visibility = 'hidden';
    return () => {
      root.style.visibility = was;
    };
  }, []);

  // Turning the camera. What the pointer drags and what the arrow keys ask for are gathered and
  // sent once a frame - one message, however many mouse moves went into it.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const held = new Set<string>();
    let dx = 0;
    let dy = 0;
    let factor = 1;
    let dragging = false;
    let last = performance.now();
    let frame = 0;

    const send = (c: Control) => {
      void live.current.onControl(c).then(z => {
        if (typeof z === 'number') setZoom(z);
      });
    };

    const tick = (at: number) => {
      const dt = Math.min(0.1, (at - last) / 1000);
      last = at;
      // (an arrow turns the camera that way: the picture slides the other)
      if (held.has('ArrowLeft')) dx += KEY_SPEED * dt;
      if (held.has('ArrowRight')) dx -= KEY_SPEED * dt;
      if (held.has('ArrowUp')) dy += KEY_SPEED * dt;
      if (held.has('ArrowDown')) dy -= KEY_SPEED * dt;
      if (dx !== 0 || dy !== 0 || factor !== 1) {
        send({ dx, dy, zoom: factor === 1 ? undefined : factor });
        dx = 0;
        dy = 0;
        factor = 1;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const step = (dir: number) => {
      const { cameras: list, watching: w, onSwitch: go } = live.current;
      if (list.length < 2) return;
      const i = list.findIndex(c => c.id === w.id);
      go(list[(Math.max(0, i) + dir + list.length) % list.length].id);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // (every key is ours while the frame is up: the desktop under it must not hear Escape)
      e.stopPropagation();
      e.preventDefault();
      if (e.key.startsWith('Arrow')) held.add(e.key);
      else if (e.repeat) return;
      else if (e.key === 'Escape' || e.key === 'Backspace') live.current.onBack();
      else if (e.key === '+' || e.key === '=') factor *= ZOOM_STEP;
      else if (e.key === '-' || e.key === '_') factor /= ZOOM_STEP;
      else if (e.key === 'r' || e.key === 'R') send({ reset: true });
      else if (e.key === 'a' || e.key === 'A' || e.key === 'PageUp') step(-1);
      else if (e.key === 'd' || e.key === 'D' || e.key === 'PageDown') step(1);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      e.stopPropagation();
      held.delete(e.key);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dx += e.movementX / window.innerWidth;
      dy += e.movementY / window.innerHeight;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      factor *= e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    };
    const onBlur = () => held.clear();

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const several = cameras.length > 1;
  const index = cameras.findIndex(c => c.id === watching.id);

  return createPortal(
    <div
      ref={surface}
      className="fixed inset-0 select-none"
      style={{
        zIndex: 2147483000,
        cursor: 'grab',
        fontFamily: "'Inter Variable', system-ui, sans-serif",
        fontSize: 13,
        // (in a browser there is no game behind the page: something for the frame to sit on)
        background: isEnvBrowser() ? 'radial-gradient(120% 90% at 50% 40%, #3a4250 0%, #171b22 70%, #0c0e12 100%)' : 'transparent',
      }}
    >
      {isEnvBrowser() && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ color: 'rgba(242, 244, 247, 0.45)' }}>
          {t('ui.cameras.no_picture')}
        </div>
      )}

      {/* The four corners of a viewfinder: where the edge of the picture is. */}
      {(['top-6 left-6 border-t-2 border-l-2', 'top-6 right-6 border-t-2 border-r-2', 'bottom-6 left-6 border-b-2 border-l-2', 'bottom-6 right-6 border-b-2 border-r-2'] as const).map(c => (
        <span key={c} className={`absolute w-7 h-7 pointer-events-none ${c}`} style={{ borderColor: 'rgba(255, 255, 255, 0.5)' }} />
      ))}

      <div className="absolute top-10 left-10 flex items-center gap-3 h-10 pl-3 pr-4 rounded-[10px] pointer-events-none" style={plate}>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide" style={{ color: '#ff6b6b' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#ff4d4d', animation: 'sdCamRec 1.2s steps(2, start) infinite' }} />
          {t('ui.cameras.rec')}
        </span>
        <span className="min-w-0">
          <span className="font-semibold">{watching.label ?? watching.id}</span>
          {watching.area && <span style={{ color: 'rgba(242, 244, 247, 0.65)' }}>{`  ·  ${watching.area}`}</span>}
        </span>
        {several && index >= 0 && <span style={{ color: 'rgba(242, 244, 247, 0.55)' }}>{t('ui.cameras.position', index + 1, cameras.length)}</span>}
      </div>

      <div className="absolute top-10 right-10 flex items-center gap-3">
        <div className="flex items-center gap-3 h-10 px-4 rounded-[10px] pointer-events-none" style={{ ...plate, fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace", fontSize: 12.5 }}>
          <span>{fmtShortDate(now)}</span>
          <span>{fmtTime(now, clock24)}</span>
          <span style={{ color: 'rgba(242, 244, 247, 0.65)' }}>{`${zoom.toFixed(1)}×`}</span>
        </div>
        <button type="button" className="flex items-center gap-2 h-10 px-4 rounded-[10px] font-medium" style={{ ...plate, cursor: 'pointer' }} onClick={() => onBack()}>
          <ArrowLeft size={15} />
          {t('ui.cameras.back')}
        </button>
      </div>

      <div className="absolute bottom-10 inset-x-0 flex justify-center pointer-events-none">
        <div className="flex items-center gap-5 h-10 px-5 rounded-[10px]" style={plate}>
          <Hint keys={['←', '↑', '↓', '→']} label={t('ui.cameras.key_look')} />
          <Hint keys={[t('ui.cameras.key_wheel')]} label={t('ui.cameras.key_zoom')} />
          {several && <Hint keys={['A', 'D']} label={t('ui.cameras.key_switch')} />}
          <Hint keys={['R']} label={t('ui.cameras.key_reset')} />
          <Hint keys={['Esc']} label={t('ui.cameras.back')} />
        </div>
      </div>

      <style>{'@keyframes sdCamRec { 0% { opacity: 1 } 100% { opacity: 0.15 } }'}</style>
    </div>,
    document.body,
  );
}
