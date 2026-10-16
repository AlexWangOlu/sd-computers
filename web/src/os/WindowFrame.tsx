// Window chrome: 32px title bar (icon + title + caption buttons), 8px rounded corners,
// live drag + 8-way edge resize, double-click / drag-to-top-edge maximize. Drag/resize mechanics
// are ported from frp_mdt's WindowFrame: pointermoves write straight to the DOM node (no React
// state per move, so heavy app content never re-renders mid-gesture) and the final rect commits to
// the store once, on release.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useOS, desktopBounds, type Win } from '@/store/os';
import { useExitFx } from '@/hooks/useExitFx';
import { useI18n } from '@/i18n';
import { AppIcon, GlyphClose, GlyphMax, GlyphMin, GlyphRestore } from './icons';

const MIN_W = 320;
const MIN_H = 200;
const DRAG_DEADZONE = 3;

type GripDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const GRIPS: { dir: GripDir; style: CSSProperties }[] = [
  { dir: 'n', style: { top: -4, left: 10, right: 10, height: 8, cursor: 'ns-resize' } },
  { dir: 's', style: { bottom: -4, left: 10, right: 10, height: 8, cursor: 'ns-resize' } },
  { dir: 'w', style: { left: -4, top: 10, bottom: 10, width: 8, cursor: 'ew-resize' } },
  { dir: 'e', style: { right: -4, top: 10, bottom: 10, width: 8, cursor: 'ew-resize' } },
  { dir: 'nw', style: { top: -4, left: -4, width: 14, height: 14, cursor: 'nwse-resize' } },
  { dir: 'se', style: { bottom: -4, right: -4, width: 14, height: 14, cursor: 'nwse-resize' } },
  { dir: 'ne', style: { top: -4, right: -4, width: 14, height: 14, cursor: 'nesw-resize' } },
  { dir: 'sw', style: { bottom: -4, left: -4, width: 14, height: 14, cursor: 'nesw-resize' } },
];

interface Props {
  win: Win;
  active: boolean;
  children: ReactNode;
}

export default function WindowFrame({ win, active, children }: Props) {
  const { focus, close, minimize, finalize, toggleMax, move, resize } = useOS.getState();
  const t = useI18n();
  const [gesture, setGesture] = useState(false);
  const [snapHint, setSnapHint] = useState(false);
  const [morphing, setMorphing] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const snapRef = useExitFx('fade-out');
  const dragRef = useRef<{ px: number; py: number; dx: number; dy: number; live: boolean; snap: boolean } | null>(null);
  const resizeRef = useRef<{ dir: GripDir; px: number; py: number } | null>(null);
  const liveRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const morphTimer = useRef(0);
  // Once it has been to the taskbar, a window comes back up from there rather than popping open.
  const wasMin = useRef(false);
  if (win.min) wasMin.current = true;
  useEffect(() => {
    liveRect.current = null;
  }, [win.x, win.y, win.w, win.h]);

  useEffect(() => () => window.clearTimeout(morphTimer.current), []);

  // Maximize / restore with the frame morphing between the two rects (.win-morph, styles.css).
  const zoom = () => {
    if (!win.resizable) return;
    window.clearTimeout(morphTimer.current);
    setMorphing(true);
    toggleMax(win.id);
    morphTimer.current = window.setTimeout(() => setMorphing(false), 260);
  };

  // Safety net: finalize the exit even if animationend is ever missed (finalize is idempotent).
  useEffect(() => {
    if (!win.exit) return;
    const t = window.setTimeout(() => finalize(win.id), 320);
    return () => window.clearTimeout(t);
  }, [win.exit, win.id, finalize]);

  const startDrag = (e: RPointerEvent) => {
    if (win.max || e.button !== 0) return;
    dragRef.current = { px: e.clientX, py: e.clientY, dx: 0, dy: 0, live: false, snap: false };
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
    const y = Math.round(Math.max(0, Math.min(rawY, b.h - 32)));
    d.dx = x - win.x;
    d.dy = y - win.y;
    if (!d.live) {
      if (Math.abs(d.dx) < DRAG_DEADZONE && Math.abs(d.dy) < DRAG_DEADZONE) return;
      d.live = true;
      setGesture(true);
    }
    const snap = e.clientY <= 2 && win.resizable;
    if (snap !== d.snap) {
      d.snap = snap;
      setSnapHint(snap);
    }
    node.style.transform = `translate3d(${d.dx}px, ${d.dy}px, 0)`;
  };

  const endDrag = () => {
    const d = dragRef.current;
    const node = frameRef.current;
    dragRef.current = null;
    if (!d || !d.live) return;
    setGesture(false);
    setSnapHint(false);
    if (node) {
      node.style.left = `${win.x + d.dx}px`;
      node.style.top = `${win.y + d.dy}px`;
      node.style.transform = '';
    }
    move(win.id, win.x + d.dx, win.y + d.dy);
    if (d.snap) zoom();
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
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - 48px)`, zIndex: win.z, borderRadius: 0 }
    : rect
      ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: win.z }
      : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };
  if (win.min) frameStyle.display = 'none';

  const exitClass = win.exit === 'close' ? 'win-exit-close' : win.exit === 'min' ? 'win-exit-min' : wasMin.current ? 'win-restore' : 'win-enter';

  return (
    <>
      {snapHint && (
        <div
          ref={snapRef}
          className="absolute rounded-win border border-[var(--stroke-strong)] fade-in pointer-events-none"
          style={{ left: 8, top: 8, right: 8, bottom: 56, zIndex: win.z - 1, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}
        />
      )}
      <div
        ref={frameRef}
        className={`absolute flex flex-col overflow-hidden bg-win transition-shadow duration-150 ${win.max ? '' : 'rounded-win'} ${active ? 'shadow-win' : 'shadow-win-inactive'} ${exitClass} ${morphing && !gesture ? 'win-morph' : ''}`}
        style={frameStyle}
        onPointerDownCapture={() => focus(win.id)}
        onAnimationEnd={e => {
          if (e.target === e.currentTarget && win.exit && (e.animationName === 'winClose' || e.animationName === 'winMin')) finalize(win.id);
        }}
      >
        <div
          className="flex items-center h-8 shrink-0 select-none"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onDoubleClick={zoom}
        >
          <span className="pl-3 pr-2 flex items-center"><AppIcon app={win.app} size={16} /></span>
          <span className={`flex-1 truncate text-caption transition-colors duration-150 ${active ? 'text-t1' : 'text-t3'}`}>{win.title}</span>
          <CaptionButton label={t('ui.common.minimize')} onClick={() => minimize(win.id)} active={active}><GlyphMin /></CaptionButton>
          {win.resizable && (
            <CaptionButton label={win.max ? t('ui.common.restore') : t('ui.common.maximize')} onClick={zoom} active={active}>
              {win.max ? <GlyphRestore /> : <GlyphMax />}
            </CaptionButton>
          )}
          <CaptionButton label={t('ui.common.close')} onClick={() => close(win.id)} active={active} danger><GlyphClose /></CaptionButton>
        </div>
        <div className={`relative flex-1 min-h-0 ${gesture ? 'pointer-events-none' : ''}`}>{children}</div>
        {!win.max && win.resizable && GRIPS.map(g => (
          <div
            key={g.dir}
            style={{ position: 'absolute', zIndex: 5, ...g.style }}
            onPointerDown={startResize(g.dir)}
            onPointerMove={moveResize}
            onPointerUp={endResize}
          />
        ))}
      </div>
    </>
  );
}

function CaptionButton({ children, label, onClick, active, danger }: { children: ReactNode; label: string; onClick: () => void; active: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onClick={onClick}
      className={`w-[46px] h-8 flex items-center justify-center transition-colors duration-150 ${active ? 'text-t1' : 'text-t3'} ${
        danger ? 'hover:bg-[#c42b1c] hover:text-white active:bg-[#c84031]' : 'hover:bg-subtle active:bg-control-press'
      }`}
    >
      {children}
    </button>
  );
}
