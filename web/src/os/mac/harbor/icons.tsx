import type { WinApp } from '@/store/os';
import { AppIcon } from '@/os/icons';
import mailIcon from './assets/icons/mail-icon.png';
import finderIcon from './assets/icons/finder-icon.png';
import safariIcon from './assets/icons/safari-icon.png';
import notesIcon from './assets/icons/notes-icon.png';
import settingsIcon from './assets/icons/settings-icon.png';
import calculatorIcon from './assets/icons/calculator-new-icon.png';
import terminalIcon from './assets/icons/terminal-icon.png';
import documentIcon from './assets/icons/document-icon.png';
import trashIcon from './assets/icons/trash-icon.png';
import launchpadIcon from './assets/icons/launchpad-icon.png';

// Where the reference shell has an icon for the app, use it; the rest keep sd-computers' own
// Fluent-style icons so every app the server configures still gets a recognisable tile.
export const HARBOR_ICONS: Partial<Record<WinApp, string>> = {
  mail: mailIcon,
  files: finderIcon,
  browser: safariIcon,
  notes: notesIcon,
  settings: settingsIcon,
  calculator: calculatorIcon,
  cmd: terminalIcon,
  notepad: documentIcon,
};

export const TRASH_ICON = trashIcon;
export const LAUNCHPAD_ICON = launchpadIcon;

/** One dock/Launchpad/Spotlight tile: the reference artwork, or sd's icon on a soft glass tile. */
export function HarborAppIcon({ app, size }: { app: WinApp; size: number }) {
  const src = HARBOR_ICONS[app];
  if (src) {
    return <img src={src} alt="" className="w-full h-full object-cover" draggable={false} decoding="async" />;
  }
  return (
    <div className="harbor-app-tile" style={{ width: size, height: size }}>
      <AppIcon app={app} size={Math.round(size * 0.74)} />
    </div>
  );
}
