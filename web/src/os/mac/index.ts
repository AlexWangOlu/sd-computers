import type { ShellKit } from '../shells';
import HarborDesktop from './harbor/HarborDesktop';
import HarborLockScreen from './harbor/HarborLockScreen';
import { BootScreen, ShutdownScreen, WelcomeScreen } from './harbor/HarborScreens';

/**
 * SD OS Harbor - the mac style, now running the reference shell: top menu bar, magnifying dock,
 * Launchpad, Spotlight, Control Center, photographic wallpapers and its sound set. The apps inside
 * are sd-computers' own (src/apps/registry.tsx) and re-skin through src/styles/mac.css; the shell's
 * styles live in src/styles/mac-harbor.css, scoped to .harbor-root.
 */
const mac: ShellKit = { BootScreen, LockScreen: HarborLockScreen, WelcomeScreen, ShutdownScreen, Desktop: HarborDesktop };

export default mac;
