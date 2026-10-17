import { useMemo } from 'react';
import { selectActiveId, useOS, type Win, type WinApp } from '@/store/os';
import type { AppId } from '@/types';
import { t as uiT } from '@/i18n';
import { tFor, type HarborLanguage } from './i18n';
import { useHarbor } from './prefs';
import { HARBOR_ICONS } from './icons';
import type { DockItem, HarborApp, HarborSettings, HarborWindow } from './types';

// The reference shell was written against its own MacOSContext (its window model, app registry,
// settings and auth). This hook gives the ported components that same surface, backed by
// sd-computers' store - so the chrome looks like the reference while the apps, the server-verified
// sign-in and every feature stay sd's.

const MIN_W = 360;
const MIN_H = 240;

const isChinese = (): boolean => uiT('ui.common.close') === '关闭';

export function useMacOS() {
  const payload = useOS(s => s.payload);
  const wins = useOS(s => s.windows);
  const osSettings = useOS(s => s.settings);
  const activeId = useOS(selectActiveId);
  const prefs = useHarbor(s => s.prefs);
  const patchPrefs = useHarbor(s => s.patch);
  const setLaunchpad = useHarbor(s => s.setLaunchpad);
  const os = useOS.getState();

  const language: HarborLanguage = isChinese() ? 'zh-CN' : 'en-US';
  const t = tFor(language);

  const apps: HarborApp[] = useMemo(
    () =>
      (payload?.computer.apps ?? []).map(a => ({
        id: a.id,
        name: a.label,
        icon: HARBOR_ICONS[a.id],
        defaultSize: { width: a.w, height: a.h },
        minSize: { width: Math.min(MIN_W, a.w), height: Math.min(MIN_H, a.h) },
        nonResizable: false,
        noMaximize: false,
      })),
    [payload],
  );

  const windows: HarborWindow[] = useMemo(
    () =>
      wins.map(w => ({
        id: w.id,
        appId: w.app,
        raw: w,
        position: { x: w.x, y: w.y },
        size: { width: w.w, height: w.h },
        isMinimized: w.min,
        isMaximized: w.max,
        zIndex: w.z,
      })),
    [wins],
  );

  // The reference dock opens with Launchpad, then the pinned apps. sd's pins come from
  // configs/shared/desktop.lua (Pinned), already filtered to the apps this computer has.
  const dockItems: DockItem[] = useMemo(
    () => [
      { appId: 'launchpad' as WinApp },
      ...(payload?.computer.pinned ?? []).map(id => ({ appId: id as WinApp })),
    ],
    [payload],
  );

  const settings: HarborSettings = {
    language,
    wallpaper: osSettings.wallpaper,
    theme: osSettings.theme,
    ...prefs,
  };

  const updateSettings = (p: Partial<HarborSettings>): void => {
    const { theme, wallpaper, language: _language, ...rest } = p;
    if (theme || wallpaper) {
      os.updateSettings({ ...(theme ? { theme } : {}), ...(wallpaper ? { wallpaper } : {}) });
    }
    if (Object.keys(rest).length > 0) patchPrefs(rest);
  };

  const openApp = (id: string): void => {
    if (id === 'launchpad') {
      setLaunchpad(true);
      return;
    }
    os.openApp(id as AppId);
  };

  const closeWindow = (id: string): void => os.close(id);
  const finalizeWindow = (id: string): void => os.finalize(id);
  const minimizeWindow = (id: string): void => os.minimize(id);
  const maximizeWindow = (id: string): void => os.toggleMax(id);
  const focusWindow = (id: string): void => os.focus(id);
  const minimizeAllWindows = (): void => {
    for (const w of wins) if (!w.min) os.minimize(w.id);
  };
  const updateWindowPosition = (id: string, pos: { x: number; y: number }): void => os.move(id, pos.x, pos.y);
  const updateWindowSize = (id: string, size: { width: number; height: number }): void => {
    const w = wins.find(v => v.id === id);
    if (w) os.resize(id, w.x, w.y, size.width, size.height);
  };

  return {
    payload,
    apps,
    windows,
    dockItems,
    settings,
    language,
    t,
    focusedWindowId: activeId,
    openApp,
    closeWindow,
    finalizeWindow,
    minimizeWindow,
    maximizeWindow,
    minimizeAllWindows,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    updateSettings,
  };
}

/** The store's own window for a shell window (apps are rendered with it). */
export type { Win };
