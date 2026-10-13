// Early-90s window chrome: 1px black frame + 2px bevel, accent title bar when active (white when
// not - the period tell), control-menu box on the left (click = Restore/Minimize/Maximize/Close menu,
// double-click = close; there is no close button), triangle minimize/maximize boxes on the right.
// Frames snap open through chunky zoom steps and collapse the same way on close/minimize.
//
// Drag + 8-way resize are ported from src/os/WindowFrame.tsx (itself from frp_mdt): pointermoves
// write straight to the DOM node and the final rect commits to the store once, on release, while
// the window's contents sleep (pointer-events: none).
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useOS, desktopBounds, type Win } from '@/store/os';
import { t } from '@/i18n';
import { GlyphMax, GlyphMin, GlyphRestore, GlyphSys } from './glyphs';
import { MenuDrop, useDismiss, type MenuEntry } from './Menu';
import { retroSfx } from './sounds';

const MIN_W = 280;
const MIN_H = 180;
const DRAG_DEADZONE = 3;

type GripDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const GRIPS: { dir: GripDir; style: CSSProperties }[] = [
  { dir: 'n', style: { top: -3, left: 12, right: 12, height: 6, cursor: 'ns-resize' } },
  { dir: 's', style: { bottom: -3, left: 12, right: 12, height: 6, cursor: 'ns-resize' } },
  { dir: 'w', style: { left: -3, top: 12, bottom: 12, width: 6, cursor: 'ew-resize' } },
  { dir: 'e', style: { right: -3, top: 12, bottom: 12, width: 6, cursor: 'ew-resize' } },
  { dir: 'nw', style: { top: -3, left: -3, width: 14, height: 14, cursor: 'nwse-resize' } },
  { dir: 'se', style: { bottom: -3, right: -3, width: 14, height: 14, cursor: 'nwse-resize' } },
  { dir: 'ne', style: { top: -3, right: -3, width: 14, height: 14, cursor: 'nesw-resize' } },
  { dir: 'sw', style: { bottom: -3, left: -3, width: 14, height: 14, cursor: 'nesw-resize' } },
];

/** Apps that keep their own look inside the frame (the black console, the minigame canvases, the three games). */
const UNSKINNED = new Set(['cmd', 'hack', 'mines', 'solitaire', 'snake']);

export default function RetroWindow({ win, active, children }: { win: Win; active: boolean; children: ReactNode }) {
  const { focus, close, minimize, finalize, toggleMax, move, resize } = useOS.getState();
  const [gesture, setGesture] = useState(false);
  const [menu, setMenu] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ px: number; py: number; dx: number; dy: number; live: boolean } | null>(null);
  const resizeRef = useRef<{ dir: GripDir; px: number; py: number } | null>(null);
  const liveRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    liveRect.current = null;
  }, [win.x, win.y, win.w, win.h]);

  useDismiss(ctlRef, menu, () => setMenu(false));

  // Exit: the sound, then the stepped collapse; finalize on animationend AND from this safety net.
  useEffect(() => {
    if (!win.exit) return;
    if (win.exit === 'close') retroSfx.close();
    else retroSfx.minimize();
    setMenu(false);
    const tm = window.setTimeout(() => finalize(win.id), 350);
    return () => window.clearTimeout(tm);
  }, [win.exit, win.id, finalize]);

  const doMax = () => {
    if (!win.resizable) return;
    retroSfx.maximize();
    toggleMax(win.id);
  };

  // ── Drag ──
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
    // 60px of title bar always stays reachable.
    const x = Math.round(Math.max(-win.w + 60, Math.min(rawX, b.w - 60)));
    const y = Math.round(Math.max(0, Math.min(rawY, b.h - 22)));
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
      // Pin the final spot before React repaints from state, so clearing the transform can't flash.
      node.style.left = `${win.x + d.dx}px`;
      node.style.top = `${win.y + d.dy}px`;
      node.style.transform = '';
    }
    move(win.id, win.x + d.dx, win.y + d.dy);
  };

  // ── Resize ──
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
    let x = win.x;
    let y = win.y;
    let w = win.w;
    let h = win.h;
    if (r.dir.includes('e')) w = win.w + dx;
    if (r.dir.includes('s')) h = win.h + dy;
    if (r.dir.includes('w')) {
      w = win.w - dx;
      x = win.x + dx;
    }
    if (r.dir.includes('n')) {
      h = win.h - dy;
      y = win.y + dy;
    }
    if (w < MIN_W) {
      if (r.dir.includes('w')) x = win.x + win.w - MIN_W;
      w = MIN_W;
    }
    if (h < MIN_H) {
      if (r.dir.includes('n')) y = win.y + win.h - MIN_H;
      h = MIN_H;
    }
    if (y < 0) {
      h += y;
      y = 0;
    }
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
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
  const style: CSSProperties = win.max
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: win.z }
    : rect
      ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: win.z }
      : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };
  if (win.min) style.display = 'none';

  const entries: MenuEntry[] = [
    { label: t('ui.retro.wm_restore'), disabled: !win.max, action: doMax },
    { label: t('ui.retro.wm_minimize'), action: () => minimize(win.id) },
    { label: t('ui.retro.wm_maximize'), disabled: win.max || !win.resizable, action: doMax },
    'sep',
    { label: t('ui.retro.wm_close'), accel: 'Alt+F4', action: () => close(win.id) },
  ];

  const exitClass = win.exit === 'close' ? ' rt-exit-close' : win.exit === 'min' ? ' rt-exit-min' : '';

  return (
    <div
      ref={frameRef}
      className={`rt-win${active ? ' is-active' : ''}${win.max ? ' is-max' : ''}${gesture ? ' is-gesture' : ''}${exitClass}`}
      style={style}
      onPointerDownCapture={() => focus(win.id)}
      onAnimationEnd={e => {
        if (e.target === e.currentTarget && win.exit && e.animationName.startsWith('retroWinExit')) finalize(win.id);
      }}
    >
      <div className="rt-win-inner">
        <div className="rt-title" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onDoubleClick={doMax}>
          <div ref={ctlRef} className="rt-ctl-wrap">
            <button
              type="button"
              tabIndex={-1}
              className={`rt-sysbtn rt-ctlbox${menu ? ' is-open' : ''}`}
              aria-label={t('ui.retro.wm_control')}
              title={t('ui.retro.wm_control')}
              onPointerDown={e => e.stopPropagation()}
              onClick={() => {
                retroSfx.click();
                setMenu(m => !m);
              }}
              onDoubleClick={e => {
                e.stopPropagation();
                setMenu(false);
                close(win.id);
              }}
            >
              <GlyphSys />
            </button>
            {menu && <MenuDrop entries={entries} onDone={() => setMenu(false)} className="rt-ctl-menu" />}
          </div>
          <span className="rt-title-text">{win.title}</span>
          <button
            type="button"
            tabIndex={-1}
            className="rt-sysbtn"
            aria-label={t('ui.retro.wm_minimize')}
            title={t('ui.retro.wm_minimize')}
            onPointerDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            onClick={() => minimize(win.id)}
          >
            <GlyphMin />
          </button>
          {win.resizable && (
            <button
              type="button"
              tabIndex={-1}
              className="rt-sysbtn"
              aria-label={win.max ? t('ui.retro.wm_restore') : t('ui.retro.wm_maximize')}
              title={win.max ? t('ui.retro.wm_restore') : t('ui.retro.wm_maximize')}
              onPointerDown={e => e.stopPropagation()}
              onDoubleClick={e => e.stopPropagation()}
              onClick={doMax}
            >
              {win.max ? <GlyphRestore /> : <GlyphMax />}
            </button>
          )}
        </div>
        <div className={`rt-client${UNSKINNED.has(win.app) ? '' : ' rt-skin'}`} data-app={win.app}>
          {children}
        </div>
      </div>
      {!win.max &&
        win.resizable &&
        GRIPS.map(g => (
          <div key={g.dir} className="rt-grip" style={g.style} onPointerDown={startResize(g.dir)} onPointerMove={moveResize} onPointerUp={endResize} />
        ))}
    </div>
  );
}
