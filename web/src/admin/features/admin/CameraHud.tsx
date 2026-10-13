import { create } from 'zustand';
import { t } from '@/admin/i18n';

// What the camera tool (client/admin/camtool.lua) says about the camera being flown into place.
export interface CamtoolHud {
  active: boolean;
  moving?: boolean; // one that is up already is being aimed again
  x?: number;
  y?: number;
  z?: number;
  pitch?: number;
  yaw?: number;
  fov?: number;
}

export const useCamtool = create<{ hud: CamtoolHud; set: (hud: CamtoolHud) => void }>(set => ({
  hud: { active: false },
  set: hud => set({ hud }),
}));

const Kbd = ({ children, strong = false }: { children: string; strong?: boolean }) => (
  <span className="sc-kbd" style={strong ? { background: 'var(--text-1)', color: '#0c0d0f', borderColor: 'var(--text-1)' } : { color: 'var(--text-2)' }}>
    {children}
  </span>
);

const Hint = ({ keys, label }: { keys: string[]; label: string }) => (
  <div className="flex items-center justify-between gap-3 h-6">
    <span style={{ color: 'var(--text-2)' }}>{label}</span>
    <span className="flex items-center gap-1">
      {keys.map(k => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  </div>
);

const Value = ({ name, children }: { name: string; children: string }) => (
  <span className="inline-flex items-baseline gap-1.5">
    <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
      {name}
    </span>
    <span className="mono text-[12.5px]">{children}</span>
  </span>
);

// The four corners of a viewfinder: the display is the camera's picture, edge to edge.
const CORNERS = ['top-6 left-6 border-t-2 border-l-2', 'top-6 right-6 border-t-2 border-r-2', 'bottom-6 left-6 border-b-2 border-l-2', 'bottom-6 right-6 border-b-2 border-r-2'];

// Flying a security camera into place: the keys down the left, like the gizmo's, and along the
// bottom where it is, how wide it sees and what keeps or drops it. Look-only - the mouse aims the
// camera - and nothing sits over the middle of the picture.
export const CameraHud = () => {
  const hud = useCamtool(s => s.hud);
  return (
    <>
      {CORNERS.map(c => (
        <span key={c} className={`fixed w-7 h-7 pointer-events-none ${c}`} style={{ borderColor: 'rgba(255,255,255,0.5)' }} />
      ))}

      <div className="fixed left-6 top-1/2 -translate-y-1/2 font-sans animate-fadeIn pointer-events-none" style={{ width: 232 }}>
        <div className="rounded-[12px] px-3.5 py-3 text-[12px]" style={{ background: 'rgba(18,19,22,0.9)', border: '1px solid var(--hairline-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}>
          <div className="sc-label mb-1">{t('camtool.groups.fly')}</div>
          <Hint keys={['W', 'A', 'S', 'D']} label={t('camtool.keys.move')} />
          <Hint keys={['Space', 'Ctrl']} label={t('camtool.keys.height')} />
          <Hint keys={['Shift']} label={t('camtool.keys.fast')} />
          <Hint keys={['Alt']} label={t('camtool.keys.slow')} />
          <div className="sc-label mt-2.5 mb-1">{t('camtool.groups.aim')}</div>
          <Hint keys={['Mouse']} label={t('camtool.keys.look')} />
          <Hint keys={['Wheel']} label={t('camtool.keys.zoom')} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-8 flex justify-center font-sans pointer-events-none">
        <div className="animate-toastIn rounded-[12px] overflow-hidden" style={{ width: 'min(860px, calc(100vw - 48px))', background: 'rgba(18,19,22,0.94)', border: '1px solid var(--hairline-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
          <div className="flex items-center gap-3 px-4 h-11" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <span className="text-[13px] font-semibold truncate">{t(hud.moving ? 'camtool.title_move' : 'camtool.title')}</span>
            <span className="ml-auto flex items-center gap-4 flex-shrink-0">
              <Value name={t('camtool.fov')}>{`${(hud.fov ?? 60).toFixed(0)}°`}</Value>
              <Value name={t('camtool.tilt')}>{`${(hud.pitch ?? 0).toFixed(0)}°`}</Value>
              <Value name={t('camtool.at')}>{`${(hud.x ?? 0).toFixed(1)}, ${(hud.y ?? 0).toFixed(1)}, ${(hud.z ?? 0).toFixed(1)}`}</Value>
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 h-12">
            <span className="min-w-0 truncate text-[12.5px]" style={{ color: 'var(--text-2)' }}>
              {t('camtool.hint')}
            </span>
            <span className="ml-auto pl-3 flex shrink-0 whitespace-nowrap items-center gap-3 text-[12px]">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <Kbd>Backspace</Kbd>
                {t('camtool.keys.cancel')}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Kbd strong>Enter</Kbd>
                {t(hud.moving ? 'camtool.keys.confirm_move' : 'camtool.keys.confirm')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
