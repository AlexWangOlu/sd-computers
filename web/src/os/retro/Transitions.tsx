// The two short beats either side of the desktop:
//   Welcome  - after Log On: a small box restoring the desktop while its blocks fill.
//   Shutdown - "Saving your settings..." with drive chatter, then the CRT power-off: the picture
//              collapses to a bright line, the line to a dot, the dot fades - then the NUI closes.
import { useEffect, useState } from 'react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Wallpaper } from '../Wallpaper';
import MessageBox, { LoadBlocks } from './MessageBox';
import { IconInfo, PixelMark } from './glyphs';
import { retroSfx } from './sounds';

const BLOCKS = 12;

/** Fill `count` blocks over `ms`. */
function useBlocks(count: number, ms: number, run = true): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    const step = Math.max(16, Math.floor(ms / count));
    const tm = window.setInterval(() => setN(v => (v >= count ? v : v + 1)), step);
    return () => window.clearInterval(tm);
  }, [count, ms, run]);
  return n;
}

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const filled = useBlocks(BLOCKS, 900);

  useEffect(() => {
    retroSfx.hddSeek(700);
    const tm = window.setTimeout(onDone, 1250);
    return () => window.clearTimeout(tm);
  }, [onDone]);

  return (
    <div className="rt-lock" style={{ cursor: 'wait' }}>
      <Wallpaper id={settings.wallpaper} accent={settings.accent} />
      <MessageBox bare width={360} title={payload.desktop.osName} icon={<PixelMark size={32} />}>
        <p className="rt-p rt-strong">{t('ui.retro.welcome_title', payload.user.name)}</p>
        <p className="rt-p">{t('ui.retro.welcome_body')}</p>
        <LoadBlocks count={BLOCKS} filled={filled} className="rt-blocks-dlg" />
      </MessageBox>
    </div>
  );
}

export function ShutdownScreen({ onDone }: { onDone: () => void }) {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const [off, setOff] = useState(false);
  const filled = useBlocks(BLOCKS, 950);

  useEffect(() => {
    retroSfx.hddSeek(900);
    const a = window.setTimeout(() => {
      setOff(true);
      retroSfx.powerDown();
    }, 1150);
    const b = window.setTimeout(onDone, 1150 + 820);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [onDone]);

  return (
    <div className="rt-shutdown" style={off ? undefined : { cursor: 'wait' }}>
      <div className={`rt-picture${off ? ' is-off' : ''}`}>
        <Wallpaper id={settings.wallpaper} accent={settings.accent} />
        <MessageBox bare width={360} title={payload.desktop.osName} icon={<IconInfo size={32} />}>
          <p className="rt-p rt-strong">{t('ui.retro.shutdown_saving')}</p>
          <p className="rt-p">{t('ui.retro.shutdown_body', payload.desktop.osName)}</p>
          <LoadBlocks count={BLOCKS} filled={filled} className="rt-blocks-dlg" />
        </MessageBox>
      </div>
      {off && <div className="rt-crt-dot" aria-hidden />}
    </div>
  );
}
