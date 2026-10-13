import type { CSSProperties, ReactNode } from 'react';
import type { OsStyle } from '@/types';
import { fmtLongDate, fmtTime, useNow } from '@/lib/format';
import { t, useI18n } from '@/i18n';
import { accentVars } from '@/os/theme';
import { Wallpaper } from '@/os/Wallpaper';
import MessageBox from '@/os/retro/MessageBox';
import { PixelMark } from '@/os/retro/glyphs';
import { params } from './params';

// A computer nobody is using: its style's lock face, as it rests before anyone touches a key. One
// of these is shared by every idle screen of a style, whatever its shape, and a screen narrower
// than the texture shows the middle of it - so everything here sits on the centre line.

/** The size each style's shell is laid out for; the face is scaled from it to fill the screen. */
const CANVAS: Record<OsStyle, { w: number; h: number }> = {
  modern: { w: 1920, h: 1080 },
  mac: { w: 1920, h: 1080 },
  retro: { w: 1688, h: 950 }, // (the retro tube is about 950px tall on a 1080p screen)
};

const shadow = (blur: number, a: number): CSSProperties => ({ textShadow: `0 2px ${blur}px rgba(0,0,0,${a})` });

function Modern({ now }: { now: Date }) {
  return (
    <>
      <Wallpaper id={params.wallpaper} accent={params.accent} />
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-x-0 top-[11%] flex flex-col items-center text-white">
        <div className="font-display font-semibold leading-none" style={{ fontSize: 120, ...shadow(24, 0.25) }}>
          {fmtTime(now, params.clock24).replace(/\s?[AP]M$/, '')}
        </div>
        <div className="font-display text-[26px] mt-3" style={shadow(12, 0.3)}>
          {fmtLongDate(now)}
        </div>
      </div>
    </>
  );
}

function Mac({ now }: { now: Date }) {
  const date = `${now.toLocaleDateString('en-US', { weekday: 'long' })} ${now.getDate()} ${now.toLocaleDateString('en-US', { month: 'long' })}`;
  return (
    <>
      <div className="absolute inset-0" style={{ filter: 'blur(22px) brightness(0.86)', transform: 'scale(1.08)' }}>
        <Wallpaper id={params.wallpaper} accent={params.accent} />
      </div>
      <div className="absolute inset-0 mac-lock-shade" />
      <div className="absolute inset-x-0 top-[7%] flex flex-col items-center text-white">
        <div className="text-[22px] font-medium tracking-[0.005em] drop-shadow-sm">{date}</div>
        <div className="mac-lock-clock">{fmtTime(now, params.clock24).replace(/\s?[AP]M$/, '')}</div>
      </div>
    </>
  );
}

function Retro({ now }: { now: Date }) {
  return (
    <div className="rt-fullscreen">
      <div className="rt-screen">
        <div className="rt-lock">
          <Wallpaper id={params.wallpaper} accent={params.accent} />
          <MessageBox bare width={420} title={t('ui.retro.logon_title')} icon={<PixelMark size={32} />}>
            <p className="rt-p">{t('ui.retro.idle_prompt')}</p>
          </MessageBox>
          <div className="rt-lock-foot">{fmtTime(now, params.clock24)}</div>
        </div>
      </div>
      <div className="rt-scan" aria-hidden />
    </div>
  );
}

const FACES: Record<OsStyle, (p: { now: Date }) => ReactNode> = { modern: Modern, mac: Mac, retro: Retro };

export default function Idle() {
  useI18n();
  const now = useNow(1000);
  const { w, h } = CANVAS[params.style];
  const scale = Math.max(params.vw / w, params.vh / h);
  const Face = FACES[params.style];
  return (
    <div
      className="os-root absolute overflow-hidden select-none"
      data-theme={params.theme}
      data-style={params.style}
      style={{
        ...accentVars(params.accent, params.theme),
        width: w,
        height: h,
        left: (params.vw - w * scale) / 2,
        top: (params.vh - h * scale) / 2,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      <Face now={now} />
    </div>
  );
}
