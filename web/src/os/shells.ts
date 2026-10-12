import type { ComponentType, ReactNode } from 'react';
import type { OsStyle } from '@/types';
import modern from './modern';
import retro from './retro';
import mac from './mac';

/**
 * One style's shell: everything around the apps. Computer.tsx walks the same phases for every style
 * (boot -> lock -> welcome -> desktop -> shutdown) and renders that style's screen for each. The apps
 * themselves are shared - they re-skin through the theme tokens + the style's CSS (data-style on
 * .os-root).
 */
export interface ShellKit {
  BootScreen: ComponentType<{ onDone: () => void }>;
  LockScreen: ComponentType<{ onSignedIn: () => void }>;
  WelcomeScreen: ComponentType<{ onDone: () => void }>;
  ShutdownScreen: ComponentType<{ onDone: () => void }>;
  /** The signed-in desktop: wallpaper, icons, every window (with this style's frame), bars/menus. */
  Desktop: ComponentType;
  /** Optional chassis around every phase (retro: the CRT monitor). */
  Frame?: ComponentType<{ children: ReactNode }>;
  /**
   * Dissolve between phases: the outgoing screen stays mounted under the incoming one for this many
   * ms (see "Shell phases" in styles.css). Without it screens cut, and each one owns its own entry
   * (retro's CRT effects, mac's lock/welcome animations).
   */
  crossfade?: number;
}

export const SHELLS: Record<OsStyle, ShellKit> = { modern, retro, mac };
