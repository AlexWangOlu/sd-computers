import type { ShellKit } from './shells';
import LockScreen from './LockScreen';
import Desktop from './Desktop';
import { BootScreen, ShutdownScreen, WelcomeScreen } from './Splash';

/** SD OS Pro - the modern shell (centred taskbar, Start menu, rounded translucent windows). */
const modern: ShellKit = { BootScreen, LockScreen, WelcomeScreen, ShutdownScreen, Desktop, crossfade: 440 };

export default modern;
