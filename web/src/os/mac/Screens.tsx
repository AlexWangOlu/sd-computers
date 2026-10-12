import { useEffect } from 'react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Wallpaper } from '../Wallpaper';
import { MacAvatar, MacSpinner, MarkMono } from './MacIcon';

/** Power-on: black screen, the white SD mark, a thin bar filling underneath - then the lock screen. */
export function BootScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const h = window.setTimeout(onDone, 2700);
    return () => window.clearTimeout(h);
  }, [onDone]);
  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center">
      <div className="mac-boot-mark text-white -mt-[4vh]">
        <MarkMono size={92} />
      </div>
      <div className="mac-boot-track mt-[9vh]">
        <div className="mac-boot-fill" />
      </div>
    </div>
  );
}

/** After sign-in: the lock screen's blurred wallpaper clears into the desktop's. */
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  useEffect(() => {
    const h = window.setTimeout(onDone, 950);
    return () => window.clearTimeout(h);
  }, [onDone]);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      <div className="absolute inset-0 mac-welcome-clear">
        <div className="absolute inset-0" style={{ filter: 'blur(22px) brightness(0.86)', transform: 'scale(1.08)' }}>
          <Wallpaper id={settings.wallpaper} accent={settings.accent} />
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
