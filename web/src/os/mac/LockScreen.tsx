import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BatteryFull, Power, Wifi } from 'lucide-react';
import { useOS } from '@/store/os';
import { fmtTime, fmtWeekdayLongDate, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { Wallpaper } from '../Wallpaper';
import { signIn, powerOff } from '../session';
import { sfx } from '../sfx';
import { MacAvatar, MacSpinner } from './MacIcon';

/** "Monday 5 October" ("星期一 10月5日" in Chinese). */
const lockDate = (d: Date): string => fmtWeekdayLongDate(d);

/**
 * Harbor lock screen: the wallpaper softly blurred, the date and a big thin clock at the top, the
 * account at the bottom with a pill PIN field (or "click / Enter to sign in" when the computer has
 * no PIN). The PIN is checked server-side; a wrong one shakes the field, a lockout counts down.
 */
export default function LockScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const now = useNow(1000);
  const needsPin = payload.computer.requiresPin;
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(() => (payload.computer.lockedFor > 0 ? Date.now() + payload.computer.lockedFor * 1000 : 0));
  const inputRef = useRef<HTMLInputElement>(null);
  const lockedLeft = Math.max(0, Math.ceil((lockedUntil - now.getTime()) / 1000));

  const submit = async () => {
    if (busy || lockedLeft > 0) return;
    if (needsPin && pin.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await signIn(needsPin ? pin : undefined);
    setBusy(false);
    if (res.ok) {
      sfx.logon();
      onSignedIn();
      return;
    }
    sfx.error();
    setPin('');
    setError(res.error ?? t('ui.common.error'));
    setShake(n => n + 1);
    if (res.lockedFor) setLockedUntil(Date.now() + res.lockedFor * 1000);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const h = window.setTimeout(() => inputRef.current?.focus(), 300);
    return () => window.clearTimeout(h);
  }, []);

  // PIN: any key lands in the field. No PIN: Enter signs in. (Escape is the OS-level "stand up".)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      if (!needsPin) {
        if (e.key === 'Enter') void submitRef.current();
        return;
      }
      if (document.activeElement !== inputRef.current) inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [needsPin]);

  // Refocus the field once a lockout runs out.
  useEffect(() => {
    if (lockedLeft === 0 && lockedUntil > 0) inputRef.current?.focus();
  }, [lockedLeft, lockedUntil]);

  const clock = fmtTime(now, payload.desktop.clock24).replace(/\s?[AP]M$/, '');
  const locked = lockedLeft > 0;

  return (
    <div
      className="absolute inset-0 overflow-hidden mac-fade"
      onMouseDown={() => {
        if (needsPin) window.setTimeout(() => inputRef.current?.focus(), 0);
        else void submit();
      }}
    >
      <div className="absolute inset-0" style={{ filter: 'blur(22px) brightness(0.86)', transform: 'scale(1.08)' }}>
        <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      </div>
      <div className="absolute inset-0 mac-lock-shade" />

      <div className="absolute right-5 top-3 flex items-center gap-3 text-white/90">
        <BatteryFull size={18} />
        <Wifi size={16} strokeWidth={2.2} />
      </div>

      <div className="absolute inset-x-0 top-[7%] flex flex-col items-center text-white pointer-events-none mac-lock-top">
        <div className="text-[22px] font-medium tracking-[0.005em] drop-shadow-sm">{lockDate(now)}</div>
        <div className="mac-lock-clock">{clock}</div>
      </div>

      <div className="absolute inset-x-0 bottom-[13%] flex flex-col items-center text-white mac-lock-user">
        <MacAvatar initials={payload.user.initials} size={76} />
        <div className="mt-3 text-[15px] font-semibold drop-shadow-sm">{payload.user.name}</div>
        {payload.user.job && <div className="text-[12px] text-white/70">{payload.user.job}</div>}

        <div className="mt-4 h-8 flex items-center justify-center">
          {needsPin ? (
            <div key={shake} className={`mac-pin ${shake ? 'mac-shake' : ''} ${locked ? 'is-locked' : ''}`} onMouseDown={e => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                value={pin}
                disabled={busy || locked}
                onChange={e => setPin(e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 16))}
                onKeyDown={e => {
                  if (e.key === 'Enter') void submit();
                }}
                placeholder={t('ui.mac.lock_pin')}
                aria-label={t('ui.mac.lock_pin')}
                className="mac-pin-input"
              />
              {busy ? (
                <span className="mac-pin-go is-busy">
                  <MacSpinner size={14} />
                </span>
              ) : (
                pin.length > 0 && (
                  <button type="button" className="mac-pin-go" aria-label={t('ui.mac.lock_submit')} title={t('ui.mac.lock_submit')} onClick={() => void submit()}>
                    <ArrowRight size={13} strokeWidth={2.6} />
                  </button>
                )
              )}
            </div>
          ) : busy ? (
            <MacSpinner size={20} />
          ) : (
            <div className="text-[13px] text-white/80">{t('ui.mac.lock_click')}</div>
          )}
        </div>

        <div className="mt-2 min-h-[36px] max-w-[340px] text-center text-[13px] leading-[18px] text-white/90">
          {locked ? t('ui.lock.locked_out', lockedLeft) : error}
          {!locked && error && shake >= 2 && <div className="mt-1 text-[12px] text-white/65">{t('ui.lock.forgot_hint')}</div>}
        </div>
      </div>

      <button
        type="button"
        className="mac-lock-power"
        onMouseDown={e => e.stopPropagation()}
        onClick={() => powerOff()}
      >
        <span className="mac-lock-power-btn">
          <Power size={15} strokeWidth={2.4} />
        </span>
        <span>{t('ui.mac.lock_shutdown')}</span>
      </button>
    </div>
  );
}
