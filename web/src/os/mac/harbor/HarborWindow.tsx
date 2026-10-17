import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { APPS } from '@/apps/registry';
import type { Win, WinApp } from '@/store/os';
import { useMacOS } from './compat';
import type { HarborWindow } from './types';

/** Renders sd's own app for this window (the apps take their window as a prop). */
function AppContent({ appId, win }: { appId: WinApp; win: Win }) {
  const Comp = APPS[appId];
  return Comp ? <Comp win={win} /> : null;
}

interface Props {
  window: HarborWindow;
}

// The reference shell's window chrome: traffic lights on the left, a glass body, GPU-composited
// drag and eight-way resize. The app inside is sd-computers' own (see AppContent), so every
// feature - mail, banking, hacks, printing - behaves exactly as before.
export default function HarborWindow({ window }: Props) {
  const {
    closeWindow,
    finalizeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    focusedWindowId,
    settings,
    apps,
  } = useMacOS();

  const app = apps.find(a => a.id === window.appId);
  const exiting = window.raw.exit;
  const isFocused = focusedWindowId === window.id;
  const title = window.raw.title;
  const resizable = window.raw.resizable;

  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const dragStateRef = useRef<{ pointerX: number; pointerY: number; windowX: number; windowY: number } | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  const windowStateRef = useRef(window);
  windowStateRef.current = window;
  const appRef = useRef(app);
  appRef.current = app;

  const liveStyleRef = useRef<{ transform?: string; width?: number; height?: number } | null>(null);
  const pendingDragRef = useRef<{ x: number; y: number } | null>(null);
  const pendingResizeRef = useRef<{ width: number; height: number; x: number; y: number } | null>(null);

  // Gestures suspend the window's backdrop blur: re-filtering a layered window every frame is the
  // single most expensive part of dragging it.
  const beginGesture = () => {
    const node = windowRef.current;
    if (node) node.style.backdropFilter = 'none';
  };

  const endGesture = () => {
    liveStyleRef.current = null;
    const node = windowRef.current;
    if (node) node.style.backdropFilter = '';
  };

  useLayoutEffect(() => {
    if ((!isDragging && !isResizing) || !liveStyleRef.current) return;
    const node = windowRef.current;
    if (!node) return;
    const live = liveStyleRef.current;
    if (live.transform !== undefined) node.style.transform = live.transform;
    if (live.width !== undefined) node.style.width = `${live.width}px`;
    if (live.height !== undefined) node.style.height = `${live.height}px`;
  });

  const applyLiveStyle = (next: { transform?: string; width?: number; height?: number }) => {
    liveStyleRef.current = { ...liveStyleRef.current, ...next };
    const node = windowRef.current;
    if (!node) return;
    if (next.transform !== undefined) node.style.transform = next.transform;
    if (next.width !== undefined) node.style.width = `${next.width}px`;
    if (next.height !== undefined) node.style.height = `${next.height}px`;
  };

  const applyDragDelta = (deltaX: number, deltaY: number) => {
    const dragStart = dragStateRef.current;
    const currentWindow = windowStateRef.current;
    if (!dragStart || !currentWindow) return;
    const usableWidth = globalThis.window.innerWidth;
    const newX = Math.max(0, Math.min(usableWidth - currentWindow.size.width, dragStart.windowX + deltaX));
    const newY = Math.max(28, Math.min(globalThis.window.innerHeight - currentWindow.size.height - 2, dragStart.windowY + deltaY));
    pendingDragRef.current = { x: newX, y: newY };
    applyLiveStyle({ transform: `translate3d(${newX}px, ${newY}px, 0)` });
  };

  const commitGesture = () => {
    const drag = pendingDragRef.current;
    const resize = pendingResizeRef.current;
    pendingDragRef.current = null;
    pendingResizeRef.current = null;
    dragStateRef.current = null;
    if (drag) updateWindowPosition(window.id, drag);
    if (resize) {
      updateWindowSize(window.id, { width: resize.width, height: resize.height });
      updateWindowPosition(window.id, { x: resize.x, y: resize.y });
    }
    endGesture();
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentWindow = windowStateRef.current;
      const currentApp = appRef.current;
      if (!currentWindow || !currentApp) return;

      if (isDragging) {
        const dragStart = dragStateRef.current;
        if (!dragStart) return;
        applyDragDelta(e.clientX - dragStart.pointerX, e.clientY - dragStart.pointerY);
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const minW = currentApp.minSize?.width ?? 360;
        const minH = currentApp.minSize?.height ?? 240;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;

        if (resizeDirection.includes('e')) {
          newWidth = Math.max(minW, resizeStart.width + deltaX);
          newWidth = Math.min(newWidth, globalThis.window.innerWidth - resizeStart.posX);
        }
        if (resizeDirection.includes('w')) {
          newWidth = Math.max(minW, resizeStart.width - deltaX);
          if (newWidth > minW) newX = Math.max(0, resizeStart.posX + deltaX);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(minH, resizeStart.height + deltaY);
          newHeight = Math.min(newHeight, globalThis.window.innerHeight - resizeStart.posY);
        }
        if (resizeDirection.includes('n')) {
          newHeight = Math.max(minH, resizeStart.height - deltaY);
          if (newHeight > minH) newY = Math.max(28, resizeStart.posY + deltaY);
        }

        pendingResizeRef.current = { width: newWidth, height: newHeight, x: newX, y: newY };
        applyLiveStyle({ width: newWidth, height: newHeight, transform: `translate3d(${newX}px, ${newY}px, 0)` });
      }
    };

    const handleMouseUp = () => commitGesture();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeStart, resizeDirection]);

  // Safety net: restore global gesture state if the window unmounts mid-drag.
  useEffect(() => {
    if (!isDragging && !isResizing) return;
    return () => {
      endGesture();
    };
  }, [isDragging, isResizing]);

  // sd hands a closing/minimising window to its shell: the frame plays the exit and calls
  // finalize(), which removes it (close) or marks it minimised (min). The ported chrome has no
  // collapse animation to fly into the dock, so it fades and finalises.
  useEffect(() => {
    if (!exiting) return;
    const h = globalThis.setTimeout(() => finalizeWindow(window.id), 190);
    return () => globalThis.clearTimeout(h);
  }, [exiting, window.id, finalizeWindow]);

  if (!app) return null;
  if (window.isMinimized) return null;

  const beginDrag = (clientX: number, clientY: number) => {
    if (window.isMaximized) return;
    dragStateRef.current = {
      pointerX: clientX,
      pointerY: clientY,
      windowX: window.position.x,
      windowY: window.position.y,
    };
    beginGesture();
    setIsDragging(true);
  };

  const startDrag = (e: React.MouseEvent) => {
    beginDrag(e.clientX, e.clientY);
  };

  const beginResize = (e: React.MouseEvent, dir: string) => {
    e.stopPropagation();
    beginGesture();
    setIsResizing(true);
    setResizeDirection(dir);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: window.size.width,
      height: window.size.height,
      posX: window.position.x,
      posY: window.position.y,
    });
  };

  const TrafficLights = (
    <div className="flex gap-2" onMouseDown={e => e.stopPropagation()}>
      <button
        onClick={e => {
          e.stopPropagation();
          closeWindow(window.id);
        }}
        className={`w-3 h-3 rounded-full flex items-center justify-center group ${settings.reducedMotion ? '' : 'transition-all hover:scale-110'}`}
        style={{ background: isFocused ? '#FF5F57' : '#555' }}
        aria-label="Close"
      >
        {isFocused && (
          <X
            className={`w-2 h-2 text-[#9f0000] opacity-0 group-hover:opacity-100 ${settings.reducedMotion ? '' : 'transition-opacity'}`}
            strokeWidth={2.5}
          />
        )}
      </button>
      <button
        onClick={e => {
          e.stopPropagation();
          if (window.isMaximized) maximizeWindow(window.id);
          else minimizeWindow(window.id);
        }}
        className={`w-3 h-3 rounded-full flex items-center justify-center group ${settings.reducedMotion ? '' : 'transition-all hover:scale-110'}`}
        style={{ background: isFocused ? '#FFBD2E' : '#555' }}
        aria-label="Minimize"
      >
        {isFocused && (
          <Minus
            className={`w-2 h-2 text-[#995700] opacity-0 group-hover:opacity-100 ${settings.reducedMotion ? '' : 'transition-opacity'}`}
            strokeWidth={2.5}
          />
        )}
      </button>
      {!resizable ? (
        <div className="w-3 h-3 rounded-full" style={{ background: '#464B4E' }} aria-label="Zoom unavailable" />
      ) : (
        <button
          onClick={e => {
            e.stopPropagation();
            maximizeWindow(window.id);
          }}
          className={`w-3 h-3 rounded-full flex items-center justify-center group ${settings.reducedMotion ? '' : 'transition-all hover:scale-110'}`}
          style={{ background: isFocused ? '#28C840' : '#555' }}
          aria-label="Zoom"
        >
          {isFocused && (
            <Square
              className={`w-2 h-2 text-[#006400] opacity-0 group-hover:opacity-100 ${settings.reducedMotion ? '' : 'transition-opacity'}`}
              strokeWidth={2.5}
            />
          )}
        </button>
      )}
    </div>
  );

  return (
    <div
      ref={windowRef}
      className={`harbor-window absolute pointer-events-auto rounded-2xl overflow-hidden backdrop-blur-macos-heavy ${exiting ? 'harbor-window-exit' : ''}`}
      style={{
        left: 0,
        top: window.isMaximized ? 28 : 0,
        right: window.isMaximized ? 0 : undefined,
        bottom: window.isMaximized ? 86 : undefined,
        width: window.isMaximized ? undefined : window.size.width,
        height: window.isMaximized ? undefined : window.size.height,
        transform: window.isMaximized ? undefined : `translate3d(${window.position.x}px, ${window.position.y}px, 0)`,
        willChange: 'transform',
        zIndex: window.zIndex,
        border: '1px solid hsl(var(--macos-glass-border))',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 1px rgba(255, 255, 255, 0.15) inset',
      }}
      onMouseDown={e => {
        focusWindow(window.id);
        if (window.isMaximized) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        if (e.clientY - rect.top > 30) return;
        if (e.clientX - rect.left < 80) return;
        const target = e.target as HTMLElement;
        if (target.closest('button,a,input,select,textarea,label,[role="button"],[role="link"],[role="tab"],[contenteditable="true"]')) return;
        beginDrag(e.clientX, e.clientY);
      }}
    >
      <div className={`w-full h-full ${settings.reducedMotion ? '' : 'animate-fade-in'}`}>
        <div
          className="flex items-center justify-between px-4 h-10 cursor-move select-none backdrop-blur-md"
          style={{ background: 'hsl(var(--macos-window-bg))', borderBottom: '1px solid hsl(var(--macos-glass-border))' }}
          onMouseDown={startDrag}
        >
          {TrafficLights}
          <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium harbor-window-title">{title}</div>
        </div>

        <div className="harbor-window-body h-[calc(100%-2.5rem)] overflow-auto backdrop-blur-sm" style={{ background: 'hsl(var(--macos-window-bg))' }}>
          <AppContent appId={window.appId} win={window.raw} />
        </div>
      </div>

      {!window.isMaximized && resizable && (
        <>
          <div className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize" onMouseDown={e => beginResize(e, 'n')} />
          <div className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize" onMouseDown={e => beginResize(e, 's')} />
          <div className="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize" onMouseDown={e => beginResize(e, 'w')} />
          <div className="absolute top-0 bottom-0 right-0 w-1 cursor-ew-resize" onMouseDown={e => beginResize(e, 'e')} />
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize" onMouseDown={e => beginResize(e, 'nw')} />
          <div className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize" onMouseDown={e => beginResize(e, 'ne')} />
          <div className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize" onMouseDown={e => beginResize(e, 'sw')} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize" onMouseDown={e => beginResize(e, 'se')} />
        </>
      )}
    </div>
  );
}
