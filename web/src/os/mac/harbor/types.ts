import type { Win, WinApp } from '@/store/os';

/** A window as the Harbor shell sees it: sd's Win plus the shapes the ported components expect. */
export interface HarborWindow {
  id: string;
  appId: WinApp;
  /** The store's own window (apps receive it). */
  raw: Win;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

/** An app, as the shell's menus/dock/spotlight need it. */
export interface HarborApp {
  id: WinApp;
  name: string;
  icon?: string;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  nonResizable?: boolean;
  noMaximize?: boolean;
}

export interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

export interface AppMenus {
  File?: MenuItem[];
  Edit?: MenuItem[];
  View?: MenuItem[];
  Window?: MenuItem[];
}

export interface DockItem {
  appId: WinApp;
  badge?: number;
}

/** What the shell shows. sd's per-style settings carry wallpaper/theme; the rest is shell preference. */
export interface HarborSettings {
  language: 'zh-CN' | 'en-US';
  wallpaper: string;
  theme: 'light' | 'dark';
  dockAutoHide: boolean;
  dockMagnification: number;
  reducedMotion: boolean;
  brightness: number;
  volume: number;
  wifi: boolean;
  bluetooth: boolean;
  airdrop: boolean;
  focus: boolean;
  lowPowerMode: boolean;
}
