export const TABS = ['overview', 'computers', 'automatic', 'props', 'styles'] as const;
export type Tab = (typeof TABS)[number];

// Where a computer comes from: placed from this panel (kept in the database, everything about it
// can be changed here), picked from this panel ('world': the same, but its prop is one the game
// already had there), a fixed location in configs/shared/computers.lua, or a model computer from
// that file (every prop of those models in the world - it has no one place).
export type Source = 'placed' | 'world' | 'config' | 'model';

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
  prop?: string; // placed / picked: the model it is
  models?: string[]; // model computers: the models that are it
  off?: boolean; // model computers: no prop is it right now (switched off in the Automatic tab)
  removed?: boolean; // config locations: taken away in this panel (still in the file; it can be put back)
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
  custom?: boolean; // added from the panel (kept in the database), not from the config
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

// A job the framework has, for the Business Manager picker (server/computers/employees.lua > jobs).
export interface Job {
  name: string; // as the framework spells it ('police')
  label: string;
  boss: boolean; // one of its grades is a boss: without one nobody would ever get the app
}

// One prop of a model computer (server/computers/auto.lua).
export interface AutoModel {
  model: string;
  on: boolean; // every prop of this model in the world is this computer
  own: boolean; // configs/shared/computers.lua lists it for this computer (the rest are spare props it can take on)
  taken?: string | null; // spare: the other model computer that has it
  style?: string | null; // a style of its own (otherwise it opens in its computer's)
}

// A model computer from configs/shared/computers.lua, as the Automatic tab has it.
export interface AutoComputer {
  key: string;
  label: string;
  enabled: boolean;
  style?: string | null; // the style the panel gave it (otherwise the config's, else the default)
  base?: string | null; // the style configs/shared/computers.lua gives it
  models: AutoModel[];
}

export interface Auto {
  enabled: boolean; // whether any prop in the world is a computer without being placed or picked
  computers: AutoComputer[];
}

export interface Snapshot {
  canEdit: boolean;
  computers: Computer[];
  props: Prop[];
  auto: Auto;
  // Which props have a screen, by model: 'config' = configs/shared/screens.lua has one for it,
  // 'custom' = an admin drew it with the screen tool (that wins). A prop that is not here has none:
  // it is still a computer, opening fullscreen.
  screens: Record<string, 'config' | 'custom'>;
  styles: OsStyle[];
  jobs: Job[]; // by label; empty where the Business Manager is not supported
  // Whether a computer can be given the Business Manager at all: not on a framework it does not
  // support, nor while configs/shared/boss.lua has it switched off.
  boss: { available: boolean; reason?: 'framework' | 'disabled' | null };
  defaultStyle: string;
  rules: { boot: boolean; reach: number; maxLabel: number };
  refreshMs: number;
}

// What came of a tool that ran with the panel hidden: the gizmo, the picker or the screen tool.
export interface Placed {
  what: 'computer' | 'screen';
  action: 'placed' | 'moved' | 'picked' | 'saved';
  success: boolean;
  cancelled?: boolean;
  message?: string | null;
}

export interface Reply<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
