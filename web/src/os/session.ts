import { fetchNui, isEnvBrowser } from '@/nui/bridge';
import { MOCK_PIN } from '@/nui/mock/payload';
import { useOS } from '@/store/os';
import { t } from '@/i18n';

// The OS's own session calls (sign in / lock / power off). They go straight to the client Lua, not
// through rpc - the session isn't signed in yet when signIn runs. Browser dev mode fakes them.

export interface SignInResult {
  ok: boolean;
  error?: string;
  lockedFor?: number;
}

/** Lock screen -> desktop. The PIN (when the computer has one) is checked server-side. */
export async function signIn(pin?: string): Promise<SignInResult> {
  if (isEnvBrowser()) {
    await new Promise(r => setTimeout(r, 500));
    const p = useOS.getState().payload;
    if (p?.computer.requiresPin && pin !== MOCK_PIN) return { ok: false, error: t('ui.lock.bad_pin_mock') };
    return { ok: true };
  }
  return (await fetchNui<SignInResult>('computers:signIn', { pin })) ?? { ok: false, error: t('ui.common.no_response') };
}

/** Desktop -> lock screen (the server logs the logoff; the session itself stays open). */
export function lockSession(): void {
  if (!isEnvBrowser()) void fetchNui('computers:lock');
}

/** Turn the computer off: the client closes the NUI, drops focus and ends the session. */
export function powerOff(): void {
  if (isEnvBrowser()) {
    window.postMessage({ action: 'computers:close' }, '*');
    return;
  }
  void fetchNui('computers:close');
}
