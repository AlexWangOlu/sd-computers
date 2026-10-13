import { create } from 'zustand';
import { t } from '@/admin/i18n';
import { TABS } from '@/admin/types';
import type { Placed, Snapshot, Tab } from '@/admin/types';

export interface RecentAction {
  id: number;
  at: number;
  text: string;
  ok: boolean;
}

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  text: string;
  ok: boolean;
  action?: ToastAction;
}

interface AdminState {
  open: boolean;
  hidden: boolean;
  snapshot: Snapshot | null;
  tab: Tab;
  busy: boolean;
  toasts: Toast[];
  recent: RecentAction[];
  styleFocus: string | null; // style the Styles tab opens on (set from a computer's row)

  openWith: (snapshot: Snapshot) => void;
  hide: () => void;
  show: (snapshot: Snapshot | null | undefined, placed?: Placed | null) => void;
  close: () => void;
  setSnapshot: (snapshot: Snapshot) => void;
  setTab: (tab: Tab) => void;
  setBusy: (busy: boolean) => void;
  toast: (text: string, ok?: boolean, action?: ToastAction, ms?: number) => void;
  dismissToast: (id: number) => void;
  record: (text: string, ok?: boolean) => void;
  focusStyle: (key: string | null) => void;
}

// An empty Lua table has no way to say whether it was a list: depending on the road it took it can
// arrive as {} rather than []. Every list in a snapshot is made a list here, once, so the tabs can
// count and join them without looking.
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const clean = (s: Snapshot): Snapshot => ({
  ...s,
  computers: list<Snapshot['computers'][number]>(s.computers).map(c => ({ ...c, users: list<string>(c.users), models: c.models ? list<string>(c.models) : undefined })),
  cameras: {
    enabled: s.cameras?.enabled !== false,
    max: Number(s.cameras?.max) || 200,
    list: list<Snapshot['cameras']['list'][number]>(s.cameras?.list).map(c => ({ ...c, computers: c.computers ? list<string>(c.computers) : null })),
  },
  props: list<Snapshot['props'][number]>(s.props),
  screens: s.screens && !Array.isArray(s.screens) ? s.screens : {}, // (a map: empty, it can arrive as a list)
  auto: {
    enabled: s.auto?.enabled !== false,
    computers: list<Snapshot['auto']['computers'][number]>(s.auto?.computers).map(a => ({ ...a, models: list<Snapshot['auto']['computers'][number]['models'][number]>(a.models) })),
  },
  styles: list<Snapshot['styles'][number]>(s.styles).map(st => ({ ...st, wallpapers: list<string>(st.wallpapers) })),
});

let seq = 1;
const TAB_KEY = 'sd_computers:adminTab';

const loadTab = (): Tab => {
  try {
    const raw = window.localStorage.getItem(TAB_KEY);
    if (raw && (TABS as readonly string[]).includes(raw)) return raw as Tab;
  } catch {
    // storage is unavailable in some NUI setups; the default tab is fine
  }
  return 'overview';
};

export const useAdmin = create<AdminState>((set, get) => ({
  open: false,
  hidden: false,
  snapshot: null,
  tab: loadTab(),
  busy: false,
  toasts: [],
  recent: [],
  styleFocus: null,

  openWith: snapshot => set({ open: true, hidden: false, snapshot: clean(snapshot), busy: false }),
  hide: () => set({ hidden: true }),
  show: (snapshot, placed) => {
    const next: Partial<AdminState> = { hidden: false, busy: false };
    if (snapshot) next.snapshot = clean(snapshot);
    set(next);
    if (placed && !placed.cancelled) {
      const text = placed.message ?? t(`placed.${placed.what}_${placed.action}`);
      get().toast(text, placed.success);
      if (placed.success) get().record(text, true);
    }
  },
  close: () => set({ open: false, hidden: false, busy: false }),
  setSnapshot: snapshot => set({ snapshot: clean(snapshot) }),
  setTab: tab => {
    try {
      window.localStorage.setItem(TAB_KEY, tab);
    } catch {
      // see loadTab
    }
    set({ tab });
  },
  setBusy: busy => set({ busy }),
  toast: (text, ok = true, action, ms) => {
    const id = seq++;
    set(s => ({ toasts: [...s.toasts, { id, text, ok, action }] }));
    window.setTimeout(() => get().dismissToast(id), ms ?? (action ? 8000 : 3200));
  },
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(tt => tt.id !== id) })),
  record: (text, ok = true) => set(s => ({ recent: [{ id: seq++, at: Date.now(), text, ok }, ...s.recent].slice(0, 8) })),
  focusStyle: key => set({ styleFocus: key }),
}));
