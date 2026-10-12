// Harbor window frame: 10px corners, a unified translucent title bar with the three coloured
// buttons on the LEFT and the title centred, live drag + 8-way resize (ported from the shared
// WindowFrame: pointermoves write straight to the DOM node, the final rect commits once on release),
// zoom between menu bar and dock, and the open / close / "genie" minimize animations.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useOS, desktopBounds, type Win } from '@/store/os';
import { t } from '@/i18n';
import { DOCK_RESERVE, TITLE_H, dockTarget } from './layout';

const MIN_W = 320;
const MIN_H = 200;
const DRAG_DEADZONE = 3;

type GripDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const GRIPS: { dir: GripDir; style: CSSProperties }[] = [
  { dir: 'n', style: { top: -4, left: 12, right: 12, height: 8, cursor: 'ns-resize' } },
  { dir: 's', style: { bottom: -4, left: 12, right: 12, height: 8, cursor: 'ns-resize' } },
  { dir: 'w', style: { left: -4, top: 12, bottom: 12, width: 8, cursor: 'ew-resize' } },
  { dir: 'e', style: { right: -4, top: 12, bottom: 12, width: 8, cursor: 'ew-resize' } },
  { dir: 'nw', style: { top: -4, left: -4, width: 16, height: 16, cursor: 'nwse-resize' } },
  { dir: 'se', style: { bottom: -4, right: -4, width: 16, height: 16, cursor: 'nwse-resize' } },
  { dir: 'ne', style: { top: -4, right: -4, width: 16, height: 16, cursor: 'nesw-resize' } },
  { dir: 'sw', style: { bottom: -4, left: -4, width: 16, height: 16, cursor: 'nesw-resize' } },
];

/** Exit animation lengths (mac.css) + the safety-net delay that finalizes even if animationend is missed. */
const SAFETY_MS = { close: 260, min: 440 } as const;

export default function MacWindow({ win, active, children }: { win: Win; active: boolean; children: ReactNode }) {
  const { focus, close, minimize, finalize, toggleMax, move, resize } = useOS.getState();
  const [gesture, setGesture] = useState(false);
  const [zooming, setZooming] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ px: number; py: number; dx: number; dy: number; live: boolean } | null>(null);
  const resizeRef = useRef<{ dir: GripDir; px: number; py: number } | null>(null);
  const liveRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const zoomTimer = useRef(0);

  useEffect(() => {
    liveRect.current = null;
  }, [win.x, win.y, win.w, win.h]);

  useEffect(() => () => window.clearTimeout(zoomTimer.current), []);

  // Safety net: finalize the exit even if animationend never arrives (finalize is idempotent).
  useEffect(() => {
    if (!win.exit) return;
    const h = window.setTimeout(() => finalize(win.id), SAFETY_MS[win.exit]);
    return () => window.clearTimeout(h);
  }, [win.exit, win.id, finalize]);

  // Minimize: aim the genie at the dock before the animation's first frame paints.
  useLayoutEffect(() => {
    const node = frameRef.current;
    if (win.exit !== 'min' || !node) return;
    const r = node.getBoundingClientRect();
    const target = dockTarget();
    node.style.setProperty('--mac-gx', `${Math.round(target.x - (r.left + r.width / 2))}px`);
    node.style.setProperty('--mac-gy', `${Math.round(target.y - (r.top + r.height / 2))}px`);
  }, [win.exit]);

  const zoom = () => {
    if (!win.resizable) return;
    window.clearTimeout(zoomTimer.current);
    setZooming(true);
    toggleMax(win.id);
    zoomTimer.current = window.setTimeout(() => setZooming(false), 300);
  };

  const startDrag = (e: RPointerEvent) => {
    if (win.max || e.button !== 0) return;
    dragRef.current = { px: e.clientX, py: e.clientY, dx: 0, dy: 0, live: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: RPointerEvent) => {
    const d = dragRef.current;
    const node = frameRef.current;
    if (!d || !node) return;
    const b = desktopBounds();
    const rawX = win.x + (e.clientX - d.px);
    const rawY = win.y + (e.clientY - d.py);
    const x = Math.round(Math.max(-win.w + 80, Math.min(rawX, b.w - 80)));
    const y = Math.round(Math.max(0, Math.min(rawY, b.h - TITLE_H)));
    d.dx = x - win.x;
    d.dy = y - win.y;
    if (!d.live) {
      if (Math.abs(d.dx) < DRAG_DEADZONE && Math.abs(d.dy) < DRAG_DEADZONE) return;
      d.live = true;
      setGesture(true);
    }
    node.style.transform = `translate3d(${d.dx}px, ${d.dy}px, 0)`;
  };

  const endDrag = () => {
    const d = dragRef.current;
    const node = frameRef.current;
    dragRef.current = null;
    if (!d || !d.live) return;
    setGesture(false);
    if (node) {
      node.style.left = `${win.x + d.dx}px`;
      node.style.top = `${win.y + d.dy}px`;
      node.style.transform = '';
    }
    move(win.id, win.x + d.dx, win.y + d.dy);
  };

  const startResize = (dir: GripDir) => (e: RPointerEvent) => {
    if (win.max || e.button !== 0) return;
    resizeRef.current = { dir, px: e.clientX, py: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setGesture(true);
  };

  const moveResize = (e: RPointerEvent) => {
    const r = resizeRef.current;
    const node = frameRef.current;
    if (!r || !node) return;
    const dx = e.clientX - r.px;
    const dy = e.clientY - r.py;
    let x = win.x, y = win.y, w = win.w, h = win.h;
    if (r.dir.includes('e')) w = win.w + dx;
    if (r.dir.includes('s')) h = win.h + dy;
    if (r.dir.includes('w')) { w = win.w - dx; x = win.x + dx; }
    if (r.dir.includes('n')) { h = win.h - dy; y = win.y + dy; }
    if (w < MIN_W) { if (r.dir.includes('w')) x = win.x + win.w - MIN_W; w = MIN_W; }
    if (h < MIN_H) { if (r.dir.includes('n')) y = win.y + win.h - MIN_H; h = MIN_H; }
    if (y < 0) { h += y; y = 0; }
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    liveRect.current = { x, y, w, h };
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
  };

  const endResize = () => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    setGesture(false);
    const rect = liveRect.current;
    if (rect) resize(win.id, rect.x, rect.y, rect.w, rect.h);
  };

  const rect = liveRect.current;
  const frameStyle: CSSProperties = win.max
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - ${DOCK_RESERVE}px)`, zIndex: win.z }
    : rect
      ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: win.z }
      : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };
  if (win.min) frameStyle.display = 'none';

  const motion = win.exit === 'close' ? 'is-closing' : win.exit === 'min' ? 'is-minimizing' : 'is-opening';

  return (
    <div
      ref={frameRef}
      className={`mac-window ${motion} ${active ? 'is-active' : ''} ${zooming && !gesture ? 'is-zooming' : ''}`}
      style={frameStyle}
      onPointerDownCapture={() => focus(win.id)}
      onAnimationEnd={e => {
        if (e.target === e.currentTarget && win.exit && (e.animationName === 'mac-win-close' || e.animationName === 'mac-genie')) finalize(win.id);
      }}
    >
      <div
        className="mac-titlebar"
        style={{ height: TITLE_H }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={zoom}
      >
        <div className="mac-lights" onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
          <TrafficLight kind="close" label={t('ui.mac.btn_close')} onClick={() => close(win.id)} />
          <TrafficLight kind="min" label={t('ui.mac.btn_minimize')} onClick={() => minimize(win.id)} />
          <TrafficLight kind="zoom" label={t('ui.mac.btn_zoom')} onClick={zoom} disabled={!win.resizable} />
        </div>
        <div className="mac-title">{win.title}</div>
      </div>
      <div className={`mac-body ${gesture ? 'pointer-events-none' : ''}`} data-app={win.app}>
        {children}
      </div>
      {!win.max && win.resizable && GRIPS.map(g => (
        <div
          key={g.dir}
          style={{ position: 'absolute', zIndex: 5, ...g.style }}
          onPointerDown={startResize(g.dir)}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
        />
      ))}
    </div>
  );
}

const GLYPH: Record<'close' | 'min' | 'zoom', ReactNode> = {
  close: <path d="M2.2 2.2l3.6 3.6M5.8 2.2L2.2 5.8" />,
  min: <path d="M1.6 4h4.8" />,
  zoom: <path d="M4 1.5v5M1.5 4h5" />,
};

function TrafficLight({ kind, label, onClick, disabled }: { kind: 'close' | 'min' | 'zoom'; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} className={`mac-light mac-light-${kind}`} onClick={onClick}>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        {GLYPH[kind]}
      </svg>
    </button>
  );
}
