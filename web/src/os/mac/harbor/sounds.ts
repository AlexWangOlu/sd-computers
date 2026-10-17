import { useOS } from '@/store/os';
import { useHarbor } from './prefs';
import batteryLowUrl from './assets/sounds/battery-low.ogg';
import bellUrl from './assets/sounds/bell.ogg';
import completeUrl from './assets/sounds/complete.ogg';
import desktopLoginUrl from './assets/sounds/desktop-login.ogg';
import dialogErrorUrl from './assets/sounds/dialog-error.ogg';
import dialogInformationUrl from './assets/sounds/dialog-information.ogg';
import dialogQuestionUrl from './assets/sounds/dialog-question.ogg';
import dialogWarningUrl from './assets/sounds/dialog-warning.ogg';
import messageUrl from './assets/sounds/message.ogg';
import newEmailUrl from './assets/sounds/message-new-email.ogg';
import newMessageUrl from './assets/sounds/message-new-instant.ogg';
import messageSentUrl from './assets/sounds/message-sent-instant.ogg';
import powerPlugUrl from './assets/sounds/power-plug.ogg';
import powerUnplugUrl from './assets/sounds/power-unplug.ogg';
import toggleOffUrl from './assets/sounds/button-toggle-off.ogg';
import toggleOnUrl from './assets/sounds/button-toggle-on.ogg';
import trashUrl from './assets/sounds/trash-empty.ogg';
import volumeChangeUrl from './assets/sounds/audio-volume-change.ogg';

// The mac shell's sounds: real UI sounds, not the OS's synthesized ones (os/sfx.ts belongs to the
// modern and retro shells). Honour desktop.sounds from configs/shared/desktop.lua.

const URLS = {
  success: completeUrl,
  complete: completeUrl,
  error: dialogErrorUrl,
  warning: dialogWarningUrl,
  information: dialogInformationUrl,
  question: dialogQuestionUrl,
  bell: bellUrl,
  toggleOn: toggleOnUrl,
  toggleOff: toggleOffUrl,
  volumeChange: volumeChangeUrl,
  message: messageUrl,
  newMessage: newMessageUrl,
  messageSent: messageSentUrl,
  newMail: newEmailUrl,
  powerPlug: powerPlugUrl,
  powerUnplug: powerUnplugUrl,
  batteryLow: batteryLowUrl,
  login: desktopLoginUrl,
  trash: trashUrl,
} as const;

export type SystemSoundName = keyof typeof URLS;

const lastPlayed = new Map<string, number>();

export function playSystemSound(name: SystemSoundName, _opts?: { bypassFocus?: boolean }): void {
  const payload = useOS.getState().payload;
  if (payload && payload.desktop.sounds === false) return;
  const now = performance.now();
  const last = lastPlayed.get(name) ?? 0;
  if (now - last < 80) return;
  lastPlayed.set(name, now);
  try {
    const audio = new Audio(URLS[name]);
    audio.volume = Math.max(0, Math.min(1, (useHarbor.getState().prefs.volume ?? 65) / 100));
    void audio.play().catch(() => {
      // CEF blocks audio before the first gesture; the next click plays normally
    });
  } catch {
    // a sound is never worth throwing over
  }
}

export const playToggleSound = (on: boolean): void => playSystemSound(on ? 'toggleOn' : 'toggleOff');

let lastVolume = 0;
export function playVolumeChange(_value: number): void {
  const now = performance.now();
  if (now - lastVolume < 120) return;
  lastVolume = now;
  playSystemSound('volumeChange');
}
