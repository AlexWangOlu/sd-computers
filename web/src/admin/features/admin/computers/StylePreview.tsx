import type { CSSProperties, ReactNode } from 'react';
import { Wallpaper } from '@/os/Wallpaper';
import type { OsStyle } from '@/admin/types';

// What a computer of a given style looks like when somebody sits down at it, as a small screen:
// the style's own default wallpaper (the OS draws those itself - src/os/Wallpaper.tsx) under a
// schematic of its shell. Not a screenshot: enough to tell the three looks apart at a glance.

const abs = (style: CSSProperties): CSSProperties => ({ position: 'absolute', ...style });

const Lines = ({ color, widths }: { color: string; widths: number[] }) => (
  <div className="flex flex-col" style={{ gap: 6, padding: '9px 10% 0' }}>
    {widths.map((w, i) => (
      <span key={i} style={{ display: 'block', flexShrink: 0, height: 3, width: `${w}%`, borderRadius: 2, background: color }} />
    ))}
  </div>
);

// SD OS Pro: rounded translucent window, centred taskbar.
const Modern = ({ accent, light }: { accent: string; light: boolean }) => {
  const win = light ? 'rgba(243,243,243,0.96)' : 'rgba(32,32,32,0.94)';
  const ink = light ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.3)';
  return (
    <>
      <div style={abs({ left: '17%', top: '14%', width: '54%', height: '54%', borderRadius: 6, background: win, boxShadow: '0 10px 28px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' })}>
        <div className="flex items-center justify-end" style={{ height: '13%', gap: 5, paddingRight: 7 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 6, height: 1.5, background: ink }} />
          ))}
        </div>
        <div className="flex" style={{ height: '87%' }}>
          <div style={{ width: '30%' }}>
            <Lines color={ink} widths={[70, 55, 62, 48]} />
          </div>
          <div style={{ flex: 1, borderTopLeftRadius: 5, background: light ? '#fbfbfb' : '#272727', borderTop: '1px solid rgba(128,128,128,0.2)', borderLeft: '1px solid rgba(128,128,128,0.2)' }}>
            <Lines color={ink} widths={[46, 88, 80, 64]} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center" style={abs({ left: 0, right: 0, bottom: 0, height: '10%', gap: '1.6%', background: light ? 'rgba(238,238,238,0.86)' : 'rgba(28,28,28,0.84)', borderTop: '1px solid rgba(255,255,255,0.08)' })}>
        {[accent, ink, ink, ink, ink, ink].map((c, i) => (
          <span key={i} style={{ height: '56%', aspectRatio: '1', borderRadius: 3, background: c }} />
        ))}
      </div>
    </>
  );
};

// SD OS Harbor: top menu bar, traffic-light window, dock.
const Mac = ({ accent }: { accent: string }) => (
  <>
    <div className="flex items-center" style={abs({ left: 0, right: 0, top: 0, height: '7%', gap: '2%', padding: '0 2.5%', background: 'rgba(255,255,255,0.5)' })}>
      <span style={{ height: '50%', aspectRatio: '1', borderRadius: 999, background: 'rgba(0,0,0,0.6)' }} />
      {[9, 6, 6, 7].map((w, i) => (
        <span key={i} style={{ height: 3, width: `${w}%`, borderRadius: 2, background: 'rgba(0,0,0,0.42)' }} />
      ))}
    </div>
    <div style={abs({ left: '16%', top: '15%', width: '55%', height: '52%', borderRadius: 7, background: 'rgba(246,246,246,0.97)', boxShadow: '0 12px 30px rgba(0,0,0,0.35)', overflow: 'hidden' })}>
      <div className="flex items-center" style={{ height: '14%', gap: 4, paddingLeft: 7, background: 'rgba(232,232,232,0.95)' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map(c => (
          <span key={c} style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
        ))}
      </div>
      <div className="flex" style={{ height: '86%' }}>
        <div style={{ width: '30%', background: 'rgba(0,0,0,0.05)' }}>
          <Lines color="rgba(0,0,0,0.25)" widths={[70, 55, 62]} />
        </div>
        <div style={{ flex: 1 }}>
          <Lines color="rgba(0,0,0,0.22)" widths={[46, 88, 80, 64]} />
        </div>
      </div>
    </div>
    <div className="flex items-center justify-center" style={abs({ left: '27%', right: '27%', bottom: '4%', height: '12%', gap: '3%', borderRadius: 8, background: 'rgba(255,255,255,0.32)', border: '1px solid rgba(255,255,255,0.4)' })}>
      {[accent, '#34c759', '#ff9f0a', '#5e5ce6', '#8e8e93'].map(c => (
        <span key={c} style={{ height: '62%', aspectRatio: '1', borderRadius: 4, background: c }} />
      ))}
    </div>
  </>
);

// SD Desktop: bevelled grey windows on a status bar, inside a CRT.
const Retro = ({ accent }: { accent: string }) => {
  const bevel = 'inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080';
  return (
    <>
      <div className="flex items-center" style={abs({ left: 0, right: 0, top: 0, height: '8%', gap: '3%', padding: '0 3%', background: '#c0c0c0', boxShadow: bevel })}>
        {[8, 10, 7].map((w, i) => (
          <span key={i} style={{ height: 3, width: `${w}%`, background: '#000000' }} />
        ))}
      </div>
      <div style={abs({ left: '14%', top: '17%', width: '58%', height: '55%', background: '#c0c0c0', border: '1px solid #000000', boxShadow: `${bevel}, 3px 3px 0 rgba(0,0,0,0.4)` })}>
        <div className="flex items-center justify-center" style={{ height: '15%', margin: 2, background: accent }}>
          <span style={{ height: 3, width: '32%', background: '#ffffff' }} />
        </div>
        <div style={{ margin: '4% 5%', height: '62%', background: '#ffffff', border: '1px solid #808080' }}>
          <Lines color="#000000" widths={[52, 84, 70]} />
        </div>
      </div>
      <div className="flex items-center" style={abs({ left: 0, right: 0, bottom: 0, height: '8%', gap: '2%', padding: '0 3%', background: '#c0c0c0', boxShadow: bevel })}>
        <span style={{ height: 3, width: '22%', background: '#000000' }} />
        <span style={{ marginLeft: 'auto', height: 3, width: '12%', background: '#000000' }} />
      </div>
    </>
  );
};

export const StylePreview = ({ style, className = '' }: { style: OsStyle; className?: string }) => {
  const accent = style.accent ?? '#4cc2ff';
  const wallpaper = style.wallpaper ?? 'solid';
  let screen: ReactNode;
  if (style.key === 'mac') screen = <Mac accent={accent} />;
  else if (style.key === 'retro') screen = <Retro accent={accent} />;
  else screen = <Modern accent={accent} light={style.theme === 'light'} />;

  const picture = (
    <>
      <Wallpaper id={wallpaper} accent={accent} />
      {screen}
    </>
  );

  // Retro sits in its monitor, as the real thing does (configs/shared/desktop.lua > retro.Monitor).
  if (style.key === 'retro') {
    return (
      <div className={`relative w-full ${className}`} style={{ aspectRatio: '16 / 10', borderRadius: 14, background: 'linear-gradient(180deg, #ddd6c2, #c8c0aa)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }}>
        <div style={abs({ left: '5.5%', right: '5.5%', top: '6.5%', bottom: '13%', borderRadius: 7, overflow: 'hidden', boxShadow: '0 0 0 3px #2c2a26, inset 0 0 18px rgba(0,0,0,0.5)' })}>{picture}</div>
        <span style={abs({ right: '8%', bottom: '4.5%', width: 5, height: 5, borderRadius: 999, background: '#58d36a', boxShadow: '0 0 6px #58d36a' })} />
      </div>
    );
  }
  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: '16 / 10', borderRadius: 10, border: '1px solid var(--hairline-strong)' }}>
      {picture}
    </div>
  );
};
