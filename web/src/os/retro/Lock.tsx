// The Log On dialog: a bevelled box on the bare desktop wallpaper. User name prefilled (read-only),
// a PIN field when the computer has one, OK / Cancel (Cancel powers the machine off). The PIN is
// checked server-side; a wrong one buzzes and pops an error box, and a lockout counts down with
// the fields disabled.
import { useEffect, useRef, useState } from 'react';
import { useOS } from '@/store/os';
import { fmtTime, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { Wallpaper } from '../Wallpaper';
import { signIn, powerOff } from '../session';
import MessageBox from './MessageBox';
import { IconStop, PixelMark } from './glyphs';
import { retroSfx } from './sounds';

export default function LockScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const now = useNow(1000);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(() => (payload.computer.lockedFor > 0 ? Date.now() + payload.computer.lockedFor * 1000 : 0));
  const pinRef = useRef<HTMLInputElement>(null);
  const lockedLeft = Math.max(0, Math.ceil((lockedUntil - now.getTime()) / 1000));
  const needsPin = payload.computer.requiresPin;

  const focusPin = () => window.setTimeout(() => pinRef.current?.focus(), 30);

  useEffect(() => {
    if (needsPin) focusPin();
  }, [needsPin]);

  // The lockout just ran out: hand the field back.
  const wasLocked = useRef(lockedLeft > 0);
  useEffect(() => {
    if (wasLocked.current && lockedLeft === 0 && needsPin) focusPin();
    wasLocked.current = lockedLeft > 0;
  }, [lockedLeft, needsPin]);

  const submit = async () => {
    if (busy || lockedLeft > 0 || error) return;
    if (needsPin && pin.length === 0) {
      pinRef.current?.focus();
      return;
    }
    setBusy(true);
    const res = await signIn(needsPin ? pin : undefined);
    setBusy(false);
    if (res.ok) {
      retroSfx.logon();
      onSignedIn();
      return;
    }
    retroSfx.deny();
    setPin('');
    setError(res.error ?? t('ui.common.error'));
    if (res.lockedFor) setLockedUntil(Date.now() + res.lockedFor * 1000);
  };

  const closeError = () => {
    setError(null);
    if (needsPin) focusPin();
  };

  const c = payload.computer;
  const locked = lockedLeft > 0;

  return (
    <div className="rt-lock" style={busy ? { cursor: 'wait' } : undefined}>
      <Wallpaper id={settings.wallpaper} accent={settings.accent} />

      <MessageBox
        bare
        width={420}
        title={t('ui.retro.logon_title')}
        icon={<PixelMark size={32} />}
        onClose={powerOff}
        buttons={[
          { label: busy ? t('ui.retro.logon_checking') : t('ui.common.ok'), primary: true, disabled: busy || locked, onClick: () => void submit() },
          { label: t('ui.common.cancel'), onClick: powerOff },
        ]}
      >
        <p className="rt-p">{needsPin ? t('ui.retro.logon_prompt_pin', c.hostname) : t('ui.retro.logon_prompt', c.hostname)}</p>
        <div className="rt-form">
          <label className="rt-label" htmlFor="rt-logon-user">
            {t('ui.retro.logon_user')}
          </label>
          <input id="rt-logon-user" className="rt-field is-readonly" value={payload.user.name} readOnly tabIndex={-1} />
          {needsPin && (
            <>
              <label className="rt-label" htmlFor="rt-logon-pin">
                {t('ui.retro.logon_pin')}
              </label>
              <input
                id="rt-logon-pin"
                ref={pinRef}
                className="rt-field"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                disabled={busy || locked}
                onChange={e => setPin(e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 16))}
                onKeyDown={e => {
                  if (e.key.length === 1) retroSfx.key();
                }}
              />
            </>
          )}
        </div>
        {payload.user.job && <p className="rt-p rt-dim">{t('ui.retro.logon_job', payload.user.job)}</p>}
        {locked && <p className="rt-p rt-logon-locked">{t('ui.lock.locked_out', lockedLeft)}</p>}
      </MessageBox>

      {error && (
        <MessageBox width={340} title={t('ui.retro.logon_error_title')} icon={<IconStop size={32} />} onClose={closeError} buttons={[{ label: t('ui.common.ok'), primary: true, onClick: closeError }]}>
          <p className="rt-p">{error}</p>
          {needsPin && <p className="rt-p rt-dim">{t('ui.lock.forgot_hint')}</p>}
        </MessageBox>
      )}

      <div className="rt-lock-foot">
        {c.label}&nbsp;&nbsp;·&nbsp;&nbsp;{c.hostname}&nbsp;&nbsp;·&nbsp;&nbsp;{fmtTime(now, payload.desktop.clock24)}
      </div>
    </div>
  );
}
