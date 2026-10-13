// The chassis around every retro phase: a putty-beige 14" CRT (4:3 tube, glass glare, scanlines,
// embossed badge on the chin, decorative knobs, a power LED and a working power button), or - with
// payload.desktop.monitor = false - the same tube stretched over the whole screen. Boot, lock,
// desktop and shutdown all render INSIDE .rt-screen, which is the desktop's container.
// Ported from frp_mdt's Monitor.
import { useEffect, type ReactNode } from 'react';
import { useOS } from '@/store/os';
import { isEnvBrowser } from '@/nui/bridge';
import { t } from '@/i18n';
import { powerOff } from '../session';
import { retroSfx } from './sounds';

export default function Frame({ children }: { children: ReactNode }) {
  const monitor = useOS(s => s.payload?.desktop.monitor ?? true);
  const phase = useOS(s => s.phase);

  // The PSU fan belongs to the machine, not to a phase: Boot's power-on starts it; with Boot
  // disabled a soft wake does. It always stops when the computer goes away.
  useEffect(() => {
    if (useOS.getState().phase !== 'boot') retroSfx.wake();
    return () => retroSfx.fanOff(0.25);
  }, []);

  const power = () => {
    const s = useOS.getState();
    if (s.phase === 'shutdown') return;
    if (s.phase === 'desktop') s.setPhase('shutdown');
    else powerOff();
  };

  // data-mirror-viewport: the screen on the prop shows the tube, not a picture of this monitor (src/screen).
  const screen = (
    <>
      <div className="rt-screen" data-mirror-viewport>
        {children}
      </div>
      <div className="rt-scan" aria-hidden />
    </>
  );

  if (!monitor) return <div className="rt-fullscreen">{screen}</div>;

  return (
    <div className={`rt-stage${isEnvBrowser() ? ' is-dev' : ''}`}>
      <div className="rt-backdrop" />
      <div className="rt-monitor">
        <div className="rt-tube">
          {screen}
          <div className="rt-glare" aria-hidden />
        </div>
        <div className="rt-chin">
          <span className="rt-brand">
            <b>{t('ui.retro.chin_brand')}</b>&nbsp;&nbsp;<span className="rt-brand-sub">{t('ui.retro.chin_model')}</span>
          </span>
          <div className="rt-chin-controls">
            <span className="rt-knob" title={t('ui.retro.chin_brightness')} />
            <span className="rt-knob" title={t('ui.retro.chin_contrast')} />
            <span className={`rt-led${phase === 'shutdown' ? ' is-down' : ''}`} />
            <button
              type="button"
              className="rt-power"
              title={t('ui.power.power')}
              aria-label={t('ui.power.power')}
              onClick={power}
              onPointerDown={e => e.stopPropagation()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
