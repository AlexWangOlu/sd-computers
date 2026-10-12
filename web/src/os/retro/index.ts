import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/vt323/400.css';
import type { ShellKit } from '../shells';
import Frame from './Monitor';
import BootScreen from './Boot';
import LockScreen from './Lock';
import Desktop from './Desktop';
import { ShutdownScreen, WelcomeScreen } from './Transitions';

/**
 * SD Desktop - the retro shell: a 1991-style desktop inside a beige CRT monitor. POST boot text,
 * a Log On dialog, the teal dithered desktop with a menu bar + status bar, bevelled grey windows
 * that snap open in chunky steps, and synthesised period sounds. Re-skins the apps through
 * src/styles/retro.css.
 */
const retro: ShellKit = { BootScreen, LockScreen, WelcomeScreen, ShutdownScreen, Desktop, Frame };

export default retro;
