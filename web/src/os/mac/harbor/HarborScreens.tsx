import { useEffect } from 'react';
import { FaApple } from 'react-icons/fa';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Wallpaper } from '../../Wallpaper';
import { MacAvatar, MacSpinner } from '../MacIcon';
import { resolveWallpaper } from './wallpapers';

// Boot / welcome / shutdown in the reference's language: black, the mark, a thin loader. sd's phase
// timings and callbacks are kept (BootScreen onDone, WelcomeScreen onDone, ShutdownScreen onDone),
// so Computer.tsx drives the same sequence as before.

export function BootScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const h = window.setTimeout(onDone, 2700);
    return () => window.clearTimeout(h);
  }, [onDone]);
  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
      <FaApple className="text-white -mt-[4vh]" style={{ width: 84, height: 84 }} aria-hidden />
      <div className="mt-[9vh] h-1 w-[210px] rounded-full bg-white/20 overflow-hidden">
        <div className="h-full bg-white/90" style={{ animation: 'harbor-boot-fill 2.5s cubic-bezier(0.3,0,0.2,1) forwards' }} />
      </div>
      <style>{`@keyframes harbor-boot-fill { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}

/** After sign-in: the blurred lock-screen wallpaper clears into the desktop's. */
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  useEffect(() => {
    const h = window.setTimeout(onDone, 950);
    return () => window.clearTimeout(h);
  }, [onDone]);

  const image = resolveWallpaper(settings.wallpaper);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      )}
      <div className="absolute inset-0 mac-welcome-clear">
        <div className="absolute inset-0" style={{ filter: 'blur(22px) brightness(0.86)', transform: 'scale(1.08)' }}>
          {image ? (
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Wallpaper id={settings.wallpaper} accent={settings.accent} />
          )}
        </div>
        <div className="absolute inset-0 mac-lock-shade" />
      </div>
      <div className="absolute inset-x-0 bottom-[13%] flex flex-col items-center text-white mac-welcome-user">
        <MacAvatar initials={payload.user.initials} size={76} />
        <div className="mt-3 text-[15px] font-semibold">{payload.user.name}</div>
        <div className="mt-4 h-8 flex items-center">
          <MacSpinner size={20} />
        </div>
      </div>
    </div>
  );
}

/** Shut down: the screen fades to black under a spinner, then the NUI closes. */
export function ShutdownScreen({ onDone }: { onDone: () => void }) {
  const settings = useOS(s => s.settings);
  useEffect(() => {
    const h = window.setTimeout(onDone, 1900);
    return () => window.clearTimeout(h);
  }, [onDone]);
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      <div className="absolute inset-0 bg-black mac-to-black" />
      <div className="absolute inset-0 flex items-center justify-center mac-shutdown-spin">
        <MacSpinner size={30} label={t('ui.power.shutting_down')} />
      </div>
    </div>
  );
}
