import { create } from 'zustand';

/**
 * The cosmetic switches (brightness, volume, notifications, ...). Nothing reads them - they just
 * remember where the player left them for this session, so the pages feel real.
 */
export interface Cosmetic {
  brightness: number;
  volume: number;
  notifications: boolean;
  power: 'balanced' | 'performance' | 'efficiency';
  toggles: Record<string, boolean>;
}

interface LocalState extends Cosmetic {
  set: (patch: Partial<Cosmetic>) => void;
  toggle: (key: string, fallback: boolean) => void;
}

export const useLocal = create<LocalState>(set => ({
  brightness: 72,
  volume: 40,
  notifications: true,
  power: 'balanced',
  toggles: {},
  set: patch => set(patch),
  toggle: (key, fallback) => set(s => ({ toggles: { ...s.toggles, [key]: !(s.toggles[key] ?? fallback) } })),
}));
