import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Power, Wifi, BatteryFull, Accessibility } from 'lucide-react';
import { useOS } from '@/store/os';
import { fmtLongDate, fmtTime, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { Wallpaper } from './Wallpaper';
import { Avatar } from './icons';
import { UserIdentity } from './Splash';
import { signIn, powerOff } from './session';
import { sfx } from './sfx';
import { Spinner } from '@/ui/controls';

/**
 * Lock screen: big clock over the wallpaper; any click/key slides it away to the
 * sign-in panel (blurred wallpaper, avatar, name, PIN box or Sign in button). The PIN is verified
 * server-side; wrong PINs shake the box and a lockout counts down.
 */
export default function LockScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const now = useNow(1000);
  const [revealed, setRevealed] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(() => (payload.computer.lockedFor > 0 ? Date.now() + payload.computer.lockedFor * 1000 : 0));
  const inputRef = useRef<HTMLInputElement>(null);
  const lockedLeft = Math.max(0, Math.ceil((lockedUntil - now.getTime()) / 1000));

  useEffect(() => {
    if (revealed) window.setTimeout(() => inputRef.current?.focus(), 250);
  }, [revealed]);

  // Any key or click on the lock screen reveals the sign-in panel (Escape is the OS-level "stand up").
  useEffect(() => {
    if (revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      setRevealed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed]);

  const submit = async () => {
    if (busy || lockedLeft > 0) return;
    if (payload.computer.requiresPin && pin.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await signIn(payload.computer.requiresPin ? pin : undefined);
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

  const clock = fmtTime(now, payload.desktop.clock24).replace(/\s?[AP]M$/, '');

  return (
    <div className="absolute inset-0 overflow-hidden" onMouseDown={() => !revealed && setRevealed(true)}>
      <div
        className="absolute inset-0 transition-all duration-500 ease-[var(--ease-out)]"
        style={{ filter: revealed ? 'blur(28px) brightness(0.7)' : 'none', transform: revealed ? 'scale(1.08)' : 'scale(1)' }}
      >
        <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      </div>
      <div className="absolute inset-0 bg-black/10" />

      {/* Lock face: clock + date, slides up and away on reveal. */}
      <div
        className="absolute inset-x-0 top-[11%] flex flex-col items-center text-white transition-all duration-500 pointer-events-none"
        style={{ transform: revealed ? 'translateY(-60px)' : 'none', opacity: revealed ? 0 : 1 }}
      >
        <div className="lock-face flex flex-col items-center">
          <div className="font-display font-semibold leading-none" style={{ fontSize: 120, textShadow: '0 2px 24px rgba(0,0,0,0.25)' }}>{clock}</div>
          <div className="font-display text-[26px] mt-3" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.3)' }}>{fmtLongDate(now)}</div>
        </div>
      </div>

      {/* Sign-in panel. */}
      <div
        className="absolute inset-0 flex flex-col items-center text-white transition-all duration-500 ease-[var(--ease-out)]"
        style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(40px)', pointerEvents: revealed ? 'auto' : 'none' }}
      >
        <UserIdentity />

        <div className="lock-actions mt-7 w-[296px] flex flex-col items-center gap-3">
          {payload.computer.requiresPin ? (
            <div key={shake} className={`w-full relative ${shake ? 'shake' : ''}`}>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                value={pin}
                disabled={busy || lockedLeft > 0}
                onChange={e => setPin(e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 16))}
                onKeyDown={e => {
                  if (e.key === 'Enter') void submit();
                }}
                placeholder={t('ui.lock.pin')}
                className="w-full h-10 pl-3 pr-11 rounded-ctl bg-black/35 border border-white/25 border-b-2 border-b-white/60 text-white text-body placeholder:text-white/60 outline-none focus:bg-black/50 focus:border-b-[var(--accent-fill)]"
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || lockedLeft > 0}
                className="absolute right-1 top-1 w-8 h-8 rounded-ctl flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-40"
                aria-label={t('ui.lock.sign_in')}
              >
                {busy ? <Spinner size={16} className="text-white" /> : <ArrowRight size={16} />}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="h-9 min-w-[120px] px-6 rounded-ctl bg-white/15 hover:bg-white/25 border border-white/20 text-body flex items-center justify-center gap-2"
            >
              {busy ? <Spinner size={16} className="text-white" /> : t('ui.lock.sign_in')}
            </button>
          )}
          {lockedLeft > 0 ? (
            <div className="text-body text-white/90 text-center page-in">{t('ui.lock.locked_out', lockedLeft)}</div>
          ) : (
            error && <div key={`error-${shake}`} className="text-body text-white/90 text-center page-in">{error}</div>
          )}
          {payload.computer.requiresPin && <button type="button" className="text-caption text-white/70 hover:text-white hover:underline" title={t('ui.lock.forgot_hint')}>{t('ui.lock.forgot')}</button>}
        </div>

        <div className="absolute left-6 bottom-6 flex flex-col items-start gap-1 text-white/90">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-ctl bg-white/10">
            <Avatar initials={payload.user.initials} size={28} />
            <span className="text-body">{payload.user.name}</span>
          </div>
        </div>
      </div>

      {/* Bottom-right status / power, like the real lock screen. */}
      <div className="absolute right-6 bottom-6 flex items-center gap-1 text-white">
        <span className="w-9 h-9 flex items-center justify-center rounded-ctl"><Wifi size={18} /></span>
        <span className="w-9 h-9 flex items-center justify-center rounded-ctl"><BatteryFull size={18} /></span>
        {revealed && (
          <>
            <span className="w-9 h-9 flex items-center justify-center rounded-ctl hover:bg-white/10 fade-in"><Accessibility size={18} /></span>
            <button type="button" title={t('ui.power.shutdown')} onClick={e => { e.stopPropagation(); powerOff(); }} className="w-9 h-9 flex items-center justify-center rounded-ctl hover:bg-white/10 fade-in">
              <Power size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
