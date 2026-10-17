import { useEffect, useRef, useState } from 'react';
import { setBoundsProvider, useOS } from '@/store/os';
import type { AppId } from '@/types';
import { Wallpaper } from '../../Wallpaper';
import { macAccentVars } from '../accent';
import { MacIcon } from '../MacIcon';
import Notifications from '../Notifications';
import { DOCK_RESERVE, MENU_H, TITLE_H } from '../layout';
import { useMacOS } from './compat';
import { useHarbor } from './prefs';
import { resolveWallpaper } from './wallpapers';
import HarborWindow from './HarborWindow';
import HarborDock from './HarborDock';
import HarborMenuBar from './HarborMenuBar';
import HarborSpotlight from './HarborSpotlight';
import HarborLaunchpad from './HarborLaunchpad';
import { LosSantosWeatherWidget } from './widgets/LosSantosWeatherWidget';
import { UtilityClockWidget } from './widgets/UtilityClockWidget';
import { CalendarWidget } from './widgets/CalendarWidget';

/**
 * SD OS Harbor (transplanted shell): the reference desktop's wallpaper, widgets, menu bar, dock,
 * Spotlight, Launchpad and window chrome - wrapped around sd-computers' own apps. Everything the
 * apps need (accent variables, the usable window area, desktop icons, toasts) stays wired to
 * sd's store, so features and behaviour do not change.
 */
export default function HarborDesktop() {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const { windows, settings: harbor } = useMacOS();
  const launchpadOpen = useHarbor(s => s.launchpadOpen);
  const setLaunchpad = useHarbor(s => s.setLaunchpad);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [selected, setSelected] = useState<AppId | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  // Windows live between the menu bar and the dock: the store needs that area for placement,
  // clamping and dragging (exactly what the previous Harbor desktop told it).
  useEffect(() => {
    setBoundsProvider(() => {
      const el = areaRef.current;
      const w = el ? el.clientWidth : window.innerWidth;
      const h = el ? el.clientHeight : window.innerHeight - MENU_H;
      return { w, h: Math.max(200, h - DOCK_RESERVE) };
    });
    return () => setBoundsProvider(null);
  }, []);

  // Keep every title bar reachable if the viewport shrinks (resolution change, windowed game).
  useEffect(() => {
    const clamp = () => {
      const el = areaRef.current;
      if (!el) return;
      const { windows: ws, resize } = useOS.getState();
      const bw = el.clientWidth;
      const bh = el.clientHeight - DOCK_RESERVE;
      for (const w of ws) {
        const nw = Math.min(w.w, bw - 16);
        const nh = Math.min(w.h, bh - 16);
        const nx = Math.max(8 - nw + 120, Math.min(w.x, bw - 120));
        const ny = Math.max(0, Math.min(w.y, bh - TITLE_H));
        if (nx !== w.x || ny !== w.y || nw !== w.w || nh !== w.h) resize(w.id, nx, ny, nw, nh);
      }
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  // Spotlight: Cmd/Ctrl+K (its reference shortcut) and Ctrl+Space (sd's search shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const ctrlSpace = e.ctrlKey && !e.altKey && e.code === 'Space';
      if (!cmdK && !ctrlSpace) return;
      e.preventDefault();
      setSpotlightOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const apps = payload.computer.apps;
  const icons = payload.computer.desktopIcons
    .map(id => apps.find(a => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const image = resolveWallpaper(harbor.wallpaper);
  const dim = 0.5 + (harbor.brightness / 100) * 0.6;

  const desktopMenu = [
    { label: '更换壁纸…', action: () => useOS.getState().openApp('settings', { page: 'personalization' }) },
    ...(apps.some(a => a.id === 'cmd') ? [{ label: '打开终端', action: () => useOS.getState().openApp('cmd') }] : []),
  ];

  return (
    <div
      className="harbor-root absolute inset-0 overflow-hidden"
      style={{
        ...macAccentVars(settings.accent, settings.theme),
        filter: harbor.brightness < 100 ? `brightness(${dim})` : undefined,
      }}
      onMouseDown={() => {
        setMenu(null);
        setSelected(null);
      }}
    >
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : (
        <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      )}

      <div
        ref={areaRef}
        className="absolute left-0 right-0 bottom-0"
        style={{ top: MENU_H }}
        onContextMenu={e => {
          e.preventDefault();
          setMenu({ x: Math.min(e.clientX, window.innerWidth - 240), y: Math.min(e.clientY, window.innerHeight - 120) });
        }}
      >
        {/* Desktop icons: a column down the right edge, wrapping leftwards. */}
        <div
          className="absolute inset-x-0 top-2 flex flex-col flex-wrap-reverse content-start items-center pr-2 pointer-events-none"
          style={{ bottom: DOCK_RESERVE + 4 }}
        >
          {icons.map(a => (
            <button
              key={a.id}
              type="button"
              className={`mac-desk-icon pointer-events-auto ${selected === a.id ? 'is-selected' : ''}`}
              onMouseDown={e => {
                e.stopPropagation();
                setMenu(null);
                setSelected(a.id);
              }}
              onDoubleClick={() => useOS.getState().openApp(a.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') useOS.getState().openApp(a.id);
              }}
            >
              <span className="mac-desk-tile">
                <MacIcon app={a.id} size={56} />
              </span>
              <span className="mac-desk-label">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Desktop widgets (reference shell): weather, clock, calendar. */}
        <div className="absolute top-3 left-6 flex flex-col gap-3 pointer-events-none">
          <div className="pointer-events-auto">
            <LosSantosWeatherWidget />
          </div>
          <div className="flex items-start gap-3 pointer-events-auto">
            <UtilityClockWidget size={172} />
            <CalendarWidget />
          </div>
        </div>

        {/* Windows get their own stacking context so their ever-growing z never climbs over the bars. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ isolation: 'isolate', zIndex: 1 }}
          onContextMenu={e => e.stopPropagation()}
        >
          {windows.map(w => (
            <HarborWindow key={w.id} window={w} />
          ))}
        </div>
      </div>

      <div className={`menubar-slide ${launchpadOpen ? 'menubar-slide-up' : ''}`}>
        <HarborMenuBar onSpotlightClick={() => setSpotlightOpen(true)} />
      </div>

      <HarborSpotlight isOpen={spotlightOpen} onClose={() => setSpotlightOpen(false)} />
      <HarborLaunchpad open={launchpadOpen} onClose={() => setLaunchpad(false)} />
      <HarborDock />
      <Notifications />

      {menu && (
        <div
          className="fixed rounded-xl py-2.5 px-3 z-[200] text-white"
          style={{
            left: menu.x,
            top: menu.y,
            minWidth: 200,
            background: 'rgba(28,28,32,0.85)',
            backdropFilter: 'blur(28px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            fontSize: 13,
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {desktopMenu.map(item => (
            <button
              key={item.label}
              onClick={() => {
                item.action();
                setMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 rounded-md hover:bg-black/40"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
