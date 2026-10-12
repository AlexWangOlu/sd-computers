// Event Viewer shapes. Entry/Page mirror server/computers/logs.lua + shell.lua (logs:page).

export type Level = 'information' | 'warning' | 'error' | 'success' | 'failure';

export interface Entry {
  id: number;
  level: Level;
  source: string;
  event_id: number;
  message: string;
  actor_name?: string | null;
  data?: unknown;
  ts: number;
}

export interface Page {
  entries: Entry[];
  counts: Partial<Record<Level, number>>;
  sources: string[];
  pageSize: number;
  canClear: boolean;
  computer: { hostname: string; label: string } | null;
}

/** What logs:page filters on server-side (single-valued only). */
export interface ServerFilter {
  level?: Level;
  source?: string;
  search?: string;
}

/** The real Windows logs + the cosmetic nodes of the console tree. */
export type LogId = 'application' | 'security' | 'setup' | 'system' | 'forwarded';
export type NodeId =
  | 'root'
  | 'custom'
  | 'custom-admin'
  | 'windows'
  | LogId
  | 'services'
  | 'svc-hardware'
  | 'svc-kms'
  | 'svc-powershell'
  | 'subscriptions';

/** The Filter Current Log dialog's checkboxes (Windows' levels + the two audit keywords). */
export type LevelCheck = 'critical' | 'error' | 'warning' | 'information' | 'verbose' | 'success' | 'failure';

export type Logged = 'any' | '1h' | '12h' | '24h' | '7d' | '30d';

export interface UserFilter {
  checks: Partial<Record<LevelCheck, boolean>>;
  source: string;
  search: string;
  logged: Logged;
  ids: string;
  user: string;
}

export type SortKey = 'level' | 'ts' | 'source' | 'event_id' | 'task' | 'user';
export interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

export interface MenuItem {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
}
