import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, BatteryCharging, Zap, Check } from 'lucide-react';
import { IoIosWifi } from 'react-icons/io';
import { IoBluetooth } from 'react-icons/io5';
import { FaApple } from 'react-icons/fa';
import { useMacOS } from './compat';
import { playSystemSound, playToggleSound } from './sounds';
import controlCenterIcon from './assets/icons/control-centre.svg';
import { ShortcutsModal } from './HarborShortcuts';
import { HelpModal } from './HarborHelp';
import { ControlCenter } from './HarborControlCenter';
import { NotificationCenter } from './HarborNotifications';
import { formatSystemDate, translateAppName } from './i18n';
import type { MenuItem } from './types';
import { lockSession } from '../../session';
import { useOS } from '@/store/os';

interface MenuBarProps { onSpotlightClick?: () => void; }
interface MenuGroup { label: string; items: MenuItem[]; }

// Battery glyph — body now 22px wide (was 26 → 15% smaller, rounded)
const IOSBattery = ({ level, charging, lowPower }: { level: number | null; charging: boolean; lowPower?: boolean }) => {
  const pct = Math.max(0, Math.min(100, level ?? 100));
  const fillColor = lowPower
    ? '#FFD60A'
    : charging
      ? '#32C04E'
      : pct <= 20
        ? '#FE0E09'
        : '#ffffff';
  return (
    <div className="flex items-center gap-1">
      <div className="relative" style={{ width: 22, height: 13 }}>
        <div className="absolute inset-0 rounded-[4px] border border-white/70 box-border px-[1.15px] py-[1.4px]">
          <div className="h-full rounded-[1.75px]" style={{ width: `${pct}%`, background: fillColor }} />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ right: -2.5, width: 1.5, height: 5, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }}
        />
        {charging && (
          <Zap
            fill="white"
            stroke="white"
            strokeWidth={1.8}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3"
          />
        )}
      </div>
    </div>
  );
};

type FrostedPanelProps = {
  children: React.ReactNode;
  width?: number;
  className?: string;
  align?: 'left' | 'right';
  offset?: number;
};

const FrostedPanel: React.FC<FrostedPanelProps> = ({
  children,
  width = 280,
  className = '',
  align = 'left',
  offset = 8,
}) => (
  <div
    className={`fixed top-8 mt-1 rounded-xl py-2.5 px-3 z-[200] text-white ${className}`}
    style={{
      width: `min(${width}px, calc(100vw - 16px))`,
      ...(align === 'right' ? { right: offset } : { left: offset }),
      background: 'rgba(28,28,32,0.85)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      fontSize: '13px',
    }}
    onClick={(e) => e.stopPropagation()}
  >
    {children}
  </div>
);

export const MenuBar = ({ onSpotlightClick }: MenuBarProps) => {
  const [time, setTime] = useState(new Date());
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [appleOpen, setAppleOpen] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [batteryOpen, setBatteryOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [btOpen, setBtOpen] = useState(false);
  const [volOpen, setVolOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const { focusedWindowId, apps, windows, minimizeWindow, minimizeAllWindows, openApp, closeWindow, focusWindow, settings, updateSettings, language, t } = useMacOS();
  const menuBarRef = useRef<HTMLDivElement>(null);
  const previousCharging = useRef<boolean | null>(null);
  const lowBatteryPlayed = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    type BatteryManager = EventTarget & { level: number; charging: boolean };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) return;
    let battery: BatteryManager | undefined;
    const update = () => {
      if (!battery) return;
      const nextLevel = Math.round(battery.level * 100);
      const nextCharging = !!battery.charging;
      setBatteryLevel(nextLevel);
      setBatteryCharging(nextCharging);

      if (previousCharging.current !== null && previousCharging.current !== nextCharging) {
        playSystemSound(nextCharging ? 'powerPlug' : 'powerUnplug');
      }
      previousCharging.current = nextCharging;

      if (nextLevel <= 20 && !nextCharging && !lowBatteryPlayed.current) {
        lowBatteryPlayed.current = true;
        playSystemSound('batteryLow');
      } else if (nextLevel > 20 || nextCharging) {
        lowBatteryPlayed.current = false;
      }
    };
    nav.getBattery().then((b) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
    });
    return () => {
      if (battery) {
        battery.removeEventListener?.('levelchange', update);
        battery.removeEventListener?.('chargingchange', update);
      }
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const focusedWindow = windows.find(w => w.id === focusedWindowId && !w.isMinimized);
  const focusedApp = focusedWindow ? apps.find(a => a.id === focusedWindow.appId) : null;
  const appName = focusedApp ? translateAppName(focusedApp.id, language, focusedApp.name) : translateAppName('finder', language, 'Finder');

  // sd has phases, not sleep/restart screens: sleeping and restarting both end at the lock screen
  // (restart also closes every window), which is the closest honest mapping.
  const triggerLoader = (label: string) => {
    setAppleOpen(false);
    setActiveMenu(null);
    const os = useOS.getState();
    if (label === 'Restart') {
      os.closeAll();
      lockSession();
      os.setPhase('lock');
      return;
    }
    if (label === 'Sleep' || label === 'Lock Screen') {
      lockSession();
      os.setPhase('lock');
    }
  };

  const appleMenu: MenuItem[] = [
    { label: t.menu.aboutMac, action: () => { openApp('settings'); setAppleOpen(false); } },
    { separator: true },
    { label: t.menu.settings, action: () => { openApp('settings'); setAppleOpen(false); } },
    { separator: true },
    { label: t.menu.forceQuitAll, shortcut: '⌥⌘⎋', action: () => { windows.forEach(w => closeWindow(w.id)); setAppleOpen(false); } },
    { separator: true },
    { label: t.menu.sleep, action: () => triggerLoader('Sleep') },
    { label: t.menu.restart, action: () => triggerLoader('Restart') },
    { separator: true },
    { label: t.menu.lockScreen, shortcut: '⌃⌘Q', action: () => triggerLoader('Lock Screen') },
  ];

  const focusActive = focusedWindow;

  const menus: MenuGroup[] = useMemo(() => {
    const defaultFile: MenuItem[] = [
      { label: t.menu.newLaunchpad, shortcut: '⌘N', action: () => openApp('launchpad') },
      { separator: true },
      { label: t.menu.closeWindow, shortcut: '⌘W', action: () => focusActive && closeWindow(focusActive.id) },
      { label: t.menu.minimize, shortcut: '⌘M', action: () => focusActive && minimizeWindow(focusActive.id) },
    ];
    const defaultEdit: MenuItem[] = [
      { label: t.menu.undo, shortcut: '⌘Z', action: () => document.execCommand('undo') },
      { label: t.menu.redo, shortcut: '⇧⌘Z', action: () => document.execCommand('redo') },
      { separator: true },
      { label: t.menu.cut, shortcut: '⌘X', action: () => document.execCommand('cut') },
      { label: t.menu.copy, shortcut: '⌘C', action: () => document.execCommand('copy') },
      { label: t.menu.paste, shortcut: '⌘V', action: () => document.execCommand('paste') },
      { label: t.menu.selectAll, shortcut: '⌘A', action: () => document.execCommand('selectAll') },
    ];
    const defaultView: MenuItem[] = [
      { label: t.menu.showDesktop, action: () => minimizeAllWindows() },
      { label: t.menu.openSpotlight, shortcut: '⌘K', action: () => onSpotlightClick?.() },
    ];
    const defaultWindow: MenuItem[] = windows.length === 0
      ? [{ label: t.menu.noWindows }]
      : [
          { label: t.menu.minimizeAll, shortcut: '⌘M', action: () => minimizeAllWindows() },
          { separator: true },
          ...windows.map(w => {
            const a = apps.find(app => app.id === w.appId);
            return { label: a ? translateAppName(a.id, language, a.name) : w.appId, action: () => focusWindow(w.id) };
          }),
        ];
    const helpMenu: MenuItem[] = [
      { label: t.menu.computerHelp, action: () => setHelpOpen(true) },
      { label: t.menu.keyboardShortcuts, action: () => setShortcutsOpen(true) },
    ];

    return [
      {
        label: appName,
        items: [
          { label: t.menu.aboutApp(appName), action: () => openApp('settings') },
          { separator: true },
          { label: t.menu.hideApp(appName), shortcut: '⌘H', action: () => focusActive && closeWindow(focusActive.id) },
          { separator: true },
          { label: t.menu.quitApp(appName), shortcut: '⌘Q', action: () => focusActive && closeWindow(focusActive.id) },
        ],
      },
      { label: t.menu.file, items: defaultFile },
      { label: t.menu.edit, items: defaultEdit },
      { label: t.menu.view, items: defaultView },
      { label: t.menu.window, items: defaultWindow },
      { label: t.menu.help, items: helpMenu },
    ];
  }, [appName, focusActive, windows, apps, openApp, closeWindow, minimizeAllWindows, focusWindow, onSpotlightClick, language, t]);

  // Close any open status popover when another opens
  const openOnly = (which: 'battery' | 'wifi' | 'bt' | 'vol' | 'cc' | 'notif' | null) => {
    setBatteryOpen(which === 'battery');
    setWifiOpen(which === 'wifi');
    setBtOpen(which === 'bt');
    setVolOpen(which === 'vol');
    setCcOpen(which === 'cc');
    setNotifOpen(which === 'notif');
  };

  useEffect(() => {
    if (!activeMenu && !appleOpen && !batteryOpen && !wifiOpen && !btOpen && !volOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuBarRef.current?.contains(e.target as Node)) {
        setActiveMenu(null);
        setAppleOpen(false);
        setBatteryOpen(false);
        setWifiOpen(false);
        setBtOpen(false);
        setVolOpen(false);
      }
    };
    // Auto-close when cursor moves far away from the menu bar / open dropdown
    const onMove = (e: MouseEvent) => {
      if (!menuBarRef.current) return;
      const rect = menuBarRef.current.getBoundingClientRect();
      // Treat anything within 320px below the menubar (typical dropdown extent)
      // and within the bar's x-range (+40px) as still "near" — don't close.
      const inXBand = e.clientX >= rect.left - 40 && e.clientX <= rect.right + 40;
      const inYBand = e.clientY <= rect.bottom + 265 && e.clientY >= rect.top - 20;
      if (inXBand && inYBand) return;
      const dx = Math.max(rect.left - e.clientX, e.clientX - rect.right, 0);
      const dy = Math.max(rect.top - e.clientY, e.clientY - rect.bottom, 0);
      if (Math.hypot(dx, dy) > 40) {
        setActiveMenu(null);
        setAppleOpen(false);
        setBatteryOpen(false);
        setWifiOpen(false);
        setBtOpen(false);
        setVolOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
    };
  }, [activeMenu, appleOpen, batteryOpen, wifiOpen, btOpen, volOpen]);

  const formatTime = (d: Date) =>
    formatSystemDate(d, language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: language === 'en-US',
    });

  const renderDropdown = (items: MenuItem[]) => (
    <FrostedPanel className="mt-1" width={260} align="left" offset={8}>
      <div className="-mx-1">
        {items.map((it, i) =>
          it.separator ? (
            <div key={i} className="h-px bg-white/10 my-1 mx-2" />
          ) : (
            <button
              key={i}
              disabled={!it.action}
              onClick={() => {
                it.action?.();
                setActiveMenu(null);
                setAppleOpen(false);
              }}
              className={`flex items-center px-3 py-1.5 text-left rounded-md mx-1 w-[calc(100%-8px)] ${
                it.action ? 'hover:bg-black/40' : 'opacity-50 cursor-default'
              }`}
            >
              <span>{it.label}</span>
            </button>
          )
        )}
      </div>
    </FrostedPanel>
  );

  // Status icon button — darkens on hover (no white overlay)
  const StatusBtn: React.FC<{
    onClick?: () => void;
    active?: boolean;
    title?: string;
    children: React.ReactNode;
    className?: string;
  }> = ({ onClick, active, title, children, className = '' }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-[6px] rounded transition-colors hover:bg-black/30 ${active ? 'bg-black/40' : ''} ${className}`}
    >
      {children}
    </button>
  );

  return (
    <>
      <div
        ref={menuBarRef}
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-3 z-50 text-[12.4px] text-white"
        style={{
          height: 25,
          background: 'rgba(20,20,25,0.45)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-1 relative">
          <div
            className="relative"
            onMouseEnter={() => { setActiveMenu(null); setAppleOpen(true); }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenu(null);
                setAppleOpen(o => !o);
              }}
              className={`px-2 py-0.5 rounded hover:bg-black/30 flex items-center ${appleOpen ? 'bg-black/40' : ''}`}
            >
              <FaApple aria-label={t.menu.systemMenu} className="h-[15px] w-[15px]" />
            </button>
            {appleOpen && renderDropdown(appleMenu)}
          </div>

          {menus.map((m, idx) => (
            <div
              key={`${m.label}:${idx}`}
              className="relative"
              onMouseEnter={() => { setAppleOpen(false); setActiveMenu(m.label); }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAppleOpen(false);
                  setActiveMenu(activeMenu === m.label ? null : m.label);
                }}
                className={`px-2.5 py-0.5 rounded hover:bg-black/30 ${idx === 0 ? 'font-semibold text-[12.35px]' : ''} ${activeMenu === m.label ? 'bg-black/40' : ''}`}
              >
                {m.label}
              </button>
              {activeMenu === m.label && renderDropdown(m.items)}
            </div>
          ))}
        </div>

        {/* Right status group — order: bluetooth, wifi, battery, search, control center, date */}
        <div className="flex items-center gap-[2px] relative">
          <div
            className="relative"
            onMouseEnter={() => openOnly('bt')}
          >
            <StatusBtn onClick={() => openOnly(btOpen ? null : 'bt')} active={btOpen} title={t.settings.bluetooth}>
              <IoBluetooth style={{ width: 14, height: 14 }} />
            </StatusBtn>

            {btOpen && (
              <FrostedPanel width={260} align="right" offset={8}>
                <div className="font-semibold mb-1 flex items-center justify-between">
                  {t.settings.bluetooth}
                  <span className={`text-[11px] ${settings.bluetooth ? 'text-[#32C14E]' : 'text-white/50'}`}>
                    {settings.bluetooth ? t.common.on : t.common.off}
                  </span>
                </div>

                <button
                  onClick={() => { const next = !settings.bluetooth; updateSettings({ bluetooth: next }); playToggleSound(next); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/40 text-[12.5px]"
                >
                  {settings.bluetooth ? t.menu.turnBluetoothOff : t.menu.turnBluetoothOn}
                </button>

                <div className="h-px bg-white/10 my-1" />

                <div className="text-[11px] text-white/55 px-2 mb-1">{t.menu.devices}</div>
                {['Wireless Headphones', 'Magic Mouse', 'Magic Keyboard'].map(d => (
                  <div key={d} className="px-2 py-1 text-[12.5px] flex items-center justify-between">
                    <span>{d}</span>
                    <span className="text-[10.5px] text-white/55">{t.common.connected}</span>
                  </div>
                ))}

                <div className="h-px bg-white/10 my-1" />
                <button
                  onClick={() => {
                    openApp('settings');
                    openOnly(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/40 text-[12.5px]"
                >
                  {t.menu.bluetoothSettings}
                </button>
              </FrostedPanel>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => openOnly('wifi')}
          >
            <StatusBtn
              onClick={() => openOnly(wifiOpen ? null : 'wifi')}
              active={wifiOpen}
              title={online ? t.common.online : t.menu.offline}
              className={settings.wifi && online ? '' : 'opacity-60'}
            >
              <IoIosWifi style={{ width: 17.5, height: 17.5 }} />
            </StatusBtn>

            {wifiOpen && (
              <FrostedPanel width={280} align="right" offset={8}>
                <div className="font-semibold mb-1 flex items-center justify-between">
                  Wi-Fi
                  <span className={`text-[11px] ${settings.wifi ? 'text-[#32C14E]' : 'text-white/50'}`}>
                    {settings.wifi ? t.common.on : t.common.off}
                  </span>
                </div>

                <button
                  onClick={() => { const next = !settings.wifi; updateSettings({ wifi: next }); playToggleSound(next); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/40 text-[12.5px]"
                >
                  {settings.wifi ? t.menu.turnWifiOff : t.menu.turnWifiOn}
                </button>

                <div className="h-px bg-white/10 my-1" />

                <div className="text-[11px] text-white/55 px-2 mb-1">{t.menu.networks}</div>
                {[
                  { name: 'Computer Network', current: true },
                  { name: 'Public Wi-Fi', current: false },
                  { name: 'Guest Network', current: false },
                  { name: 'Mobile Hotspot', current: false },
                ].map(n => (
                  <div
                    key={n.name}
                    className="px-2 py-1 text-[12.5px] flex items-center justify-between hover:bg-black/40 rounded cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      {n.current && <Check className="w-3 h-3 text-[#32C14E]" />}
                      {n.name}
                    </span>
                    <IoIosWifi className="w-3.5 h-3.5 opacity-70" />
                  </div>
                ))}

                <div className="h-px bg-white/10 my-1" />
                <button
                  onClick={() => {
                    openApp('settings');
                    openOnly(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/40 text-[12.5px]"
                >
                  {t.menu.wifiSettings}
                </button>
              </FrostedPanel>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => openOnly('battery')}
          >
            <StatusBtn onClick={() => openOnly(batteryOpen ? null : 'battery')} active={batteryOpen} title={t.menu.battery}>
              <IOSBattery level={batteryLevel} charging={batteryCharging} lowPower={settings.lowPowerMode} />
            </StatusBtn>

            {batteryOpen && (
              <FrostedPanel width={260} align="right" offset={8}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    {t.menu.battery} {batteryCharging && <BatteryCharging className="w-5 h-5" style={{ color: '#32C04E' }} />}
                  </div>
                  <div className="text-[12px] text-white/70">{batteryLevel ?? 100}%</div>
                </div>

                <div className="text-[12px] text-white/70 mb-2">
                  {t.menu.powerSource}: {batteryCharging ? t.menu.powerAdapter : t.menu.battery}
                </div>

                <div className="h-px bg-white/10 my-1.5" />
                <button
                  onClick={() => { const next = !settings.lowPowerMode; updateSettings({ lowPowerMode: next }); playToggleSound(next); }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-black/40 text-[12.5px]"
                >
                  <span>{t.menu.lowPowerMode}</span>
                  <span
                    className="relative inline-flex h-[18px] w-[30px] rounded-full transition-colors"
                    style={{ background: settings.lowPowerMode ? '#34c759' : 'rgba(255,255,255,0.22)' }}
                  >
                    <span
                      className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform"
                      style={{ left: 2, transform: settings.lowPowerMode ? 'translateX(12px)' : 'translateX(0)' }}
                    />
                  </span>
                </button>
                <div className="h-px bg-white/10 my-1" />
                <button
                  onClick={() => {
                    openApp('settings');
                    openOnly(null);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-black/40 text-[12.5px]"
                >
                  {t.menu.batterySettings}
                </button>
              </FrostedPanel>
            )}
          </div>

          <StatusBtn onClick={onSpotlightClick} title={`${t.system.spotlightSearch} (⌘K)`}>
            <Search style={{ width: 13, height: 13 }} />
          </StatusBtn>

          <StatusBtn onClick={() => openOnly(ccOpen ? null : 'cc')} active={ccOpen} title={t.menu.controlCenter}>
            <img
              src={controlCenterIcon}
              alt={t.menu.controlCenter}
              style={{ height: 13, width: 'auto', filter: 'brightness(0) invert(1)' }}
              className="object-contain"
            />
          </StatusBtn>

          <button
            onClick={() => openOnly(notifOpen ? null : 'notif')}
            title={t.system.notifications}
            aria-label={t.system.notifications}
            className={`px-2 py-0.5 rounded hover:bg-black/30 ${notifOpen ? 'bg-black/40' : ''}`}
          >
            <span style={{ fontWeight: 300, fontFamily: "'Inter', -apple-system, sans-serif" }}>{formatTime(time)}</span>
          </button>
        </div>
      </div>

      <ControlCenter open={ccOpen} onClose={() => setCcOpen(false)} />
      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
};

export default MenuBar;
