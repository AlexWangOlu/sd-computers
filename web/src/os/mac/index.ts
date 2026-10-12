import type { ShellKit } from '../shells';
import Desktop from './Desktop';
import LockScreen from './LockScreen';
import { BootScreen, ShutdownScreen, WelcomeScreen } from './Screens';

/**
 * SD OS Harbor - the mac style: a top menu bar with the SD mark, a magnifying dock, windows with
 * coloured buttons on the left, Search, banner notifications. Apps re-skin via src/styles/mac.css.
 */
const mac: ShellKit = { BootScreen, LockScreen, WelcomeScreen, ShutdownScreen, Desktop };

export default mac;
