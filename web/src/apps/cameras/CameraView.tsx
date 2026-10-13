import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Minimize2 } from 'lucide-react';
import { isEnvBrowser } from '@/nui/bridge';
import { t } from '@/i18n';
import { Rec, Static, Tint, useStamp } from './Overlay';
import { useLook } from './useLook';
import type { Camera, Control, Stage, Watching } from './types';

// A camera's picture over the whole display. The picture is the game itself here, seen through the
// page: this draws nothing over the middle of it - a name plate, the time, a line of keys - and
// turns what the mouse and the keys do into turns of the camera. It is put on the page beside the
// desktop, not in the window: while it is up the desktop is hidden altogether, and the page holding
// the OS has given it the whole display (src/host/Host.tsx). Its colours are its own - white on the
// picture, like any camera's overlay - since it sits outside the desktop the theme belongs to.

const plate: CSSProperties = { background: 'rgba(8, 10, 14, 0.62)', border: '1px solid rgba(255, 255, 255, 0.14)', color: '#f2f4f7' };
const key: CSSProperties = { border: '1px solid rgba(255, 255, 255, 0.28)', background: 'rgba(255, 255, 255, 0.08)' };

const Key = ({ children }: { children: string }) => (
  <span className="inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium" style={key}>
    {children}
  </span>
);

const Hint = ({ keys, label }: { keys: string[]; label: string }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    {keys.map(k => (
      <Key key={k}>{k}</Key>
    ))}
    <span style={{ color: 'rgba(242, 244, 247, 0.8)' }}>{label}</span>
  </span>
);

export default function CameraView({
  camera,
  stage,
  watching,
  cameras,
  windowed,
  onSwitch,
  onControl,
  onBack,
}: {
  camera: Camera;
  stage: Stage;
  watching: Watching | null;
  cameras: Camera[];
  /** There is a window to put the picture back in (false: leaving this is leaving the camera). */
  windowed: boolean;
  onSwitch: (id: string) => void;
  onControl: (c: Control) => Promise<number | null>;
  onBack: () => void;
}) {
  const stamp = useStamp();
  const [zoom, setZoom] = useState(watching?.zoom ?? 1);
  const surface = useRef<HTMLDivElement>(null);

  const several = cameras.length > 1;
  const index = cameras.findIndex(c => c.id === camera.id);
  const live = stage === 'live' && watching?.id === camera.id;
  const leave = t(windowed ? 'ui.cameras.collapse' : 'ui.cameras.back');

  useEffect(() => setZoom(watching?.zoom ?? 1), [watching?.id, watching?.zoom]);

  // The desktop is not part of this picture: hidden for as long as the frame is up.
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const was = root.style.visibility;
    root.style.visibility = 'hidden';
    return () => {
      root.style.visibility = was;
    };
  }, []);

  const step = (dir: number) => {
    if (!several || stage !== 'live') return;
    onSwitch(cameras[(Math.max(0, index) + dir + cameras.length) % cameras.length].id);
  };

  useLook(surface, 'window', { live, onControl, onZoom: setZoom, onStep: step, onToggle: onBack, onBack });

  return createPortal(
    <div
      ref={surface}
      className="fixed inset-0 select-none"
      style={{
        zIndex: 2147483000,
        cursor: 'grab',
        fontFamily: "'Inter Variable', system-ui, sans-serif",
        fontSize: 13,
        // (in a browser there is no game behind the page: something for the frame to sit on)
        background: isEnvBrowser() ? 'radial-gradient(120% 90% at 50% 40%, #3a4250 0%, #171b22 70%, #0c0e12 100%)' : 'transparent',
      }}
    >
      {isEnvBrowser() && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ color: 'rgba(242, 244, 247, 0.45)' }}>
          {t('ui.cameras.no_picture')}
        </div>
      )}
      <Tint filter={watching?.filter ?? 'cctv'} />
      <Static on={!live}>{stage === 'leaving' ? t('ui.cameras.disconnecting') : t('ui.cameras.connecting', camera.label)}</Static>

      {/* The four corners of a viewfinder: where the edge of the picture is. */}
      {(['top-6 left-6 border-t-2 border-l-2', 'top-6 right-6 border-t-2 border-r-2', 'bottom-6 left-6 border-b-2 border-l-2', 'bottom-6 right-6 border-b-2 border-r-2'] as const).map(c => (
        <span key={c} className={`absolute w-7 h-7 pointer-events-none ${c}`} style={{ borderColor: 'rgba(255, 255, 255, 0.5)' }} />
      ))}

      <div className="absolute top-10 left-10 flex items-center gap-3 h-10 pl-3 pr-4 rounded-[10px] pointer-events-none" style={plate}>
        <Rec />
        <span className="min-w-0">
          <span className="font-semibold">{camera.label}</span>
          {camera.area && <span style={{ color: 'rgba(242, 244, 247, 0.65)' }}>{`  ·  ${camera.area}`}</span>}
        </span>
        {several && index >= 0 && <span style={{ color: 'rgba(242, 244, 247, 0.55)' }}>{t('ui.cameras.position', index + 1, cameras.length)}</span>}
      </div>

      <div className="absolute top-10 right-10 flex items-center gap-3">
        <div className="flex items-center gap-3 h-10 px-4 rounded-[10px] pointer-events-none" style={{ ...plate, fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace", fontSize: 12.5 }}>
          <span>{stamp}</span>
          <span style={{ color: 'rgba(242, 244, 247, 0.65)' }}>{`${zoom.toFixed(1)}×`}</span>
        </div>
        <button type="button" className="flex items-center gap-2 h-10 px-4 rounded-[10px] font-medium" style={{ ...plate, cursor: 'pointer' }} disabled={stage === 'leaving'} onClick={() => onBack()}>
          {windowed ? <Minimize2 size={15} /> : <ArrowLeft size={15} />}
          {leave}
        </button>
      </div>

      <div className="absolute bottom-10 inset-x-0 flex justify-center pointer-events-none">
        <div className="flex items-center gap-5 h-10 px-5 rounded-[10px]" style={plate}>
          <Hint keys={['←', '↑', '↓', '→']} label={t('ui.cameras.key_look')} />
          <Hint keys={[t('ui.cameras.key_wheel')]} label={t('ui.cameras.key_zoom')} />
          {several && <Hint keys={['A', 'D']} label={t('ui.cameras.key_switch')} />}
          <Hint keys={['R']} label={t('ui.cameras.key_reset')} />
          <Hint keys={['Esc']} label={leave} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
