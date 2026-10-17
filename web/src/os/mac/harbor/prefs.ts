import { create } from 'zustand';

// Shell-only preferences (dock, brightness, the Wi-Fi/Bluetooth switches). sd keeps a character's
// wallpaper/accent/theme on the server; these are per-machine cosmetics and stay local. Kept out of
// the OS store so a hundred menu-bar renders do not touch the session state.

export interface HarborPrefs {
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

const KEY = 'sd-computers-harbor-prefs';

const defaults: HarborPrefs = {
  dockAutoHide: false,
  dockMagnification: 1,
  reducedMotion: false,
  brightness: 100,
  volume: 65,
  wifi: true,
  bluetooth: false,
  airdrop: false,
  focus: false,
  lowPowerMode: false,
};

const load = (): HarborPrefs => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<HarborPrefs>) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
};

interface HarborState {
  prefs: HarborPrefs;
  patch: (p: Partial<HarborPrefs>) => void;
  launchpadOpen: boolean;
  setLaunchpad: (open: boolean) => void;
}

export const useHarbor = create<HarborState>((set, get) => ({
  prefs: load(),
  patch: patch => {
    const next = { ...get().prefs, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage disabled: the session still works, preferences just do not outlive it
    }
    set({ prefs: next });
  },
  launchpadOpen: false,
  setLaunchpad: open => set({ launchpadOpen: open }),
}));
