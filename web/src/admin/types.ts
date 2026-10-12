export const TABS = ['overview', 'computers', 'styles'] as const;
export type Tab = (typeof TABS)[number];

// Where a computer comes from: placed from this panel (kept in the database, everything about it
// can be changed here), a fixed location in configs/shared/computers.lua, or a model computer from
// that file (every prop of those models in the world - it has no one place).
export type Source = 'placed' | 'config' | 'model';

// A computer as the server describes it (server/admin/panel.lua > snapshot).
export interface Computer {
  key: string; // its id everywhere: logs, sessions ('placed_3', 'mrpd_frontdesk')
  order: number;
  id?: number; // placed: its row id
  source: Source;
  label: string;
  hostname: string;
  style: string; // the style it opens in
  styleSet: boolean; // false = it follows the default style
  prop?: string; // placed: the model it stands as
  models?: string[]; // model computers: the models that are it
  x?: number;
  y?: number;
  z?: number;
  heading?: number;
  groups?: Record<string, number> | null; // job lock: name -> minimum grade
  boss?: string | null; // Business Manager: a job name, or '*' = the signed-in player's own job
  pin: boolean; // has a PIN (configs/server/security.lua); the PIN itself never leaves the server
  users: string[]; // who is sitting at it right now
}

// A prop a computer can be placed as (configs/shared/admin.lua > Props).
export interface Prop {
  model: string;
  label: string;
  kind?: 'monitor' | 'tower' | 'laptop';
  image?: string; // a picture of its own (a URL); otherwise props/<model>.jpg, and its icon when there is none
}

// An OS look (configs/shared/desktop.lua > Styles).
export interface OsStyle {
  key: string;
  name: string;
  build: string;
  wallpaper?: string;
  accent?: string;
  theme: 'dark' | 'light';
  wallpapers: string[];
  default: boolean;
}

export interface Snapshot {
  canEdit: boolean;
  computers: Computer[];
  props: Prop[];
  styles: OsStyle[];
  defaultStyle: string;
  rules: { boot: boolean; reach: number; maxLabel: number };
  refreshMs: number;
}

export interface Placed {
  what: 'computer';
  action: 'placed' | 'moved';
  success: boolean;
  cancelled?: boolean;
  message?: string | null;
}

export interface Reply<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
