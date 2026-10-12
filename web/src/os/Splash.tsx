import { useEffect } from 'react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Wallpaper } from './Wallpaper';
import { Avatar, OsLogo } from './icons';

/** The OS loading ring: a spinning arc over a faint track. */
export function LoadingRing({ size = 40, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 40 40" style={{ color }}>
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3.5" />
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="30 120" />
    </svg>
  );
}

/**
 * Avatar, name and job of the signed-in user. The sign-in panel and the Welcome screen both hang it
 * off the same line (56% down a centred column), so the dissolve from one to the other leaves the
 * user standing still and only swaps what is underneath: PIN box -> "Welcome".
 */
export function UserIdentity() {
  const user = useOS(s => s.payload)!.user;
  return (
    <div className="h-[56%] shrink-0 flex flex-col items-center justify-end">
      <Avatar initials={user.initials} size={176} />
      <div className="font-display text-[34px] font-semibold mt-5">{user.name}</div>
      {user.job && <div className="text-body text-white/70 mt-0.5">{user.job}</div>}
    </div>
  );
}

/** Power-on: black screen, logo, spinner - then the lock screen. */
export function BootScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1700);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center fade-in">
      <div className="mb-[18vh] boot-logo"><OsLogo size={96} /></div>
      <div className="boot-ring"><LoadingRing size={44} /></div>
    </div>
  );
}

/** After sign-in: "Welcome" over the blurred wallpaper. */
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const settings = useOS(s => s.settings);
  useEffect(() => {
    const t = window.setTimeout(onDone, 1300);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ filter: 'blur(28px) brightness(0.7)', transform: 'scale(1.08)' }}>
        <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      </div>
      <div className="absolute inset-0 bg-black/10" />
      <div className="welcome-stage absolute inset-0 flex flex-col items-center text-white">
        <UserIdentity />
        <div className="welcome-row mt-7 flex items-center gap-4 text-[22px] font-display">
          <LoadingRing size={30} />
          {t('ui.lock.welcome')}
        </div>
      </div>
    </div>
  );
}

/** Start > Shut down: "Shutting down" then the NUI closes. */
export function ShutdownScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1400);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="absolute inset-0 bg-[#0a1a3a] flex items-center justify-center">
      <div className="shutdown-row flex items-center gap-4 text-white text-[22px] font-display">
        <LoadingRing size={30} />
        {t('ui.power.shutting_down')}
      </div>
    </div>
  );
}
