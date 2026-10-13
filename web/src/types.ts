// Contracts with the Lua side. Every shape here mirrors a table built in server/computers/*.lua -
// change one, change both.

/**
 * 'messages', 'notes', 'photos' and 'contacts' are the phone apps: only installed while sd-phone is
 * linked (server/computers/phone.lua) and, where it asks for the code, once the character has linked
 * their phone to the machine in 'phonelink' - the app that is there whenever sd-phone is. 'boss',
 * 'board' and 'cameras' are installed per player: for a boss, for someone with a job, and for
 * someone allowed to watch at least one camera.
 */
export type AppId =
  | 'mail'
  | 'logs'
  | 'cmd'
  | 'boss'
  | 'notepad'
  | 'calculator'
  | 'settings'
  | 'messages'
  | 'notes'
  | 'files'
  | 'cameras'
  | 'board'
  | 'bank'
  | 'photos'
  | 'contacts'
  | 'phonelink'
  | 'browser'
  | 'games';

export interface AppDef {
  id: AppId;
  label: string;
  w: number;
  h: number;
}

export interface WallpaperDef {
  id: string;
  label: string;
}

export type Theme = 'dark' | 'light';

/** The computer's look (configs/shared/desktop.lua Styles): same apps, different shell. */
export type OsStyle = 'modern' | 'retro' | 'mac';

export interface UserSettings {
  theme?: Theme;
  wallpaper?: string;
  accent?: string;
}

export interface GameMeta {
  program: string;
  label: string;
}

/** session.open's payload (server/computers/session.lua). */
export interface OpenPayload {
  /**
   * Added by client Lua when the camera is up at the prop (client/computers/view.lua): the part of
   * the display the prop's screen covers, as fractions of it. The page holding the OS reads it
   * (src/host); the OS itself just fills whatever window it is given.
   */
  view?: { x: number; y: number; w: number; h: number };
  computer: {
    id: string;
    label: string;
    hostname: string;
    ip: string;
    instance: string;
    style: OsStyle;
    requiresPin: boolean;
    lockedFor: number;
    apps: AppDef[];
    pinned: AppId[];
    desktopIcons: AppId[];
  };
  user: { name: string; initials: string; job: string };
  desktop: {
    style: OsStyle;
    osName: string;
    osBuild: string;
    boot: boolean;
    clock24: boolean;
    wallpapers: WallpaperDef[];
    accents: string[];
    defaultWallpaper: string;
    defaultTheme: Theme;
    /** retro: draw the desktop inside the CRT monitor chassis */
    monitor: boolean;
    /** the style's synthesized sounds (os/sfx.ts for modern and mac, os/retro/sounds.ts) */
    sounds: boolean;
  };
  settings: UserSettings;
  hacks: {
    practice: boolean;
    defaultDifficulty: Difficulty;
    games: Record<string, GameMeta>;
  };
  mail: {
    domain: string;
    maxRecipients: number;
    maxSubject: number;
    maxBody: number;
    minPassword: number;
    maxDisplayName: number;
    /** true = Mail runs on sd-phone's mail (its accounts, Spam folder, string ids, phone pushes) */
    phone?: boolean;
  };
}

/** Every rpc reply: { ok, data?, error? } (server/computers/rpc.lua). */
export interface RpcResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

/** A started hack run (hacks.lua begin()). */
export interface HackRun {
  token: number;
  game: string;
  difficulty: Difficulty;
  program: string;
  label: string;
  params: Record<string, number>;
  steps: number;
  minSeconds: number;
  challenge?: unknown;
  /** breach runs: which step of how many */
  step?: number;
  total?: number;
  /** library runs: optional window title from the calling resource */
  title?: string;
}
