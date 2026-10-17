import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, KeyRound, Unlock } from 'lucide-react';
import { useOS } from '@/store/os';
import { Wallpaper } from '../../Wallpaper';
import { signIn } from '../../session';
import { useMacOS } from './compat';
import { useHarbor } from './prefs';
import { formatSystemDate } from './i18n';
import { playSystemSound } from './sounds';
import { resolveWallpaper } from './wallpapers';

interface Props {
  onSignedIn: () => void;
}

// The reference lock screen with sd's sign-in kept intact: no face or password method (those belong
// to the reference resource's own device auth), the PIN is still checked server-side and a lockout
// still counts down. Everything visual - clock, click-to-login, glass field - is the reference.
export default function HarborLockScreen({ onSignedIn }: Props) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const { language, t } = useMacOS();
  const needsPin = payload.computer.requiresPin;
  const [now, setNow] = useState(new Date());
  const [loginVisible, setLoginVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(() =>
    payload.computer.lockedFor > 0 ? Date.now() + payload.computer.lockedFor * 1000 : 0,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const lockedLeft = Math.max(0, Math.ceil((lockedUntil - now.getTime()) / 1000));
  const reducedMotion = useHarbor(s => s.prefs.reducedMotion);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (lockedUntil > 0 && lockedLeft === 0) inputRef.current?.focus();
  }, [lockedLeft, lockedUntil]);

  useEffect(() => {
    if (!loginVisible) return;
    if (needsPin) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [loginVisible, needsPin]);

  const submit = async () => {
    if (busy || lockedLeft > 0) return;
    if (needsPin && pin.length === 0) return;
    setBusy(true);
    setError('');
    const res = await signIn(needsPin ? pin : undefined);
    setBusy(false);
    if (res.ok) {
      playSystemSound('login', { bypassFocus: true });
      setLeaving(true);
      window.setTimeout(onSignedIn, reducedMotion ? 120 : 520);
      return;
    }
    playSystemSound('error', { bypassFocus: true });
    setPin('');
    setError(res.lockedFor ? t.lock.locked : res.error || t.lock.failed);
    if (res.lockedFor) setLockedUntil(Date.now() + res.lockedFor * 1000);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  // No PIN: Enter signs straight in (sd keeps Escape for "stand up", handled by the OS).
  useEffect(() => {
    if (!loginVisible || needsPin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') void submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Split the day period out of the big clock: "下午4:22" reads badly at 140px, macOS shows the
  // period small above the time.
  const timeParts = new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !payload.desktop.clock24,
  }).formatToParts(now);
  const period = timeParts.find(p => p.type === 'dayPeriod')?.value ?? '';
  const time = timeParts.filter(p => p.type !== 'dayPeriod').map(p => p.value).join('').trim();
  const date = formatSystemDate(now, language, { weekday: 'long', month: 'long', day: 'numeric' });
  const image = resolveWallpaper(settings.wallpaper);

  return (
    <motion.div
      className="absolute inset-0 z-40 select-none overflow-hidden bg-black"
      initial={{ y: 0 }}
      animate={{ y: leaving ? '-100%' : 0 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.55, ease: [0.7, 0, 0.3, 1] }}
      onClick={() => !loginVisible && setLoginVisible(true)}
    >
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="absolute inset-0">
          <Wallpaper id={settings.wallpaper} accent={settings.accent} />
        </div>
      )}
      <motion.div
        className="absolute inset-0"
        animate={{
          backdropFilter: loginVisible ? 'blur(14px)' : 'blur(0px)',
          backgroundColor: loginVisible ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.12)',
        }}
        transition={{ duration: reducedMotion ? 0.1 : 0.3 }}
      />

      <AnimatePresence mode="wait">
        {!loginVisible ? (
          <motion.div
            key="clock"
            className="relative z-10 flex h-full flex-col items-center pt-[14vh] text-white"
            exit={{ opacity: 0, y: -14 }}
          >
            <div className="text-[18px] font-normal opacity-95">{date}</div>
            {period && <div className="mt-3 text-[18px] font-normal opacity-95">{period}</div>}
            <div className="mt-1 text-[clamp(72px,10vw,140px)] font-light leading-none tabular-nums">{time}</div>
            <button
              onClick={() => setLoginVisible(true)}
              className="mt-auto mb-16 h-10 rounded-full border border-white/25 bg-white/15 px-8 text-[13px] font-medium backdrop-blur-xl"
            >
              {t.lock.clickToLogin}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="login"
            className="relative z-10 grid h-full place-items-center px-5 text-white"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex w-full max-w-[360px] flex-col items-center" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLoginVisible(false)}
                aria-label={t.lock.back}
                className="absolute left-5 top-5 grid h-8 w-8 place-items-center rounded-full bg-black/20 backdrop-blur-xl"
              >
                <ArrowLeft size={16} />
              </button>

              <div className="grid h-[104px] w-[104px] place-items-center rounded-full border border-white/20 bg-black/20 backdrop-blur-xl">
                {needsPin ? <KeyRound size={40} strokeWidth={1.4} /> : <Unlock size={40} strokeWidth={1.4} />}
              </div>
              <h1 className="mt-5 text-[20px] font-semibold">{payload.user.name}</h1>
              <p className="mt-1 min-h-[18px] text-center text-[12px] text-white/65">
                {lockedLeft > 0 ? t.lock.retry(lockedLeft) : needsPin ? t.lock.pinHint : t.lock.noPinHint}
              </p>

              {needsPin ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    void submit();
                  }}
                  className="relative mt-5 w-full max-w-[280px]"
                >
                  <input
                    ref={inputRef}
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder={t.lock.pin}
                    disabled={lockedLeft > 0}
                    className="h-9 w-full rounded-lg border border-white/25 bg-black/25 px-3 pr-10 text-[13px] text-white outline-none backdrop-blur-xl placeholder:text-white/40 focus:border-white/60 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!pin || lockedLeft > 0 || busy}
                    aria-label={t.lock.unlock}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/20 disabled:opacity-35"
                  >
                    <ArrowRight size={14} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={lockedLeft > 0 || busy}
                  className="mt-5 h-8 rounded-md bg-white px-5 text-[13px] font-medium text-black disabled:opacity-45"
                >
                  {t.lock.login}
                </button>
              )}

              <div className="mt-5 min-h-5 text-center text-[12px] text-[#ff6961]">{error}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
