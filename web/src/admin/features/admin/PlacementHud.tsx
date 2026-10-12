import { create } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import { t } from '@/admin/i18n';

export interface PlacerWarning {
  key: string;
  value?: string;
}

export interface PlacerHud {
  active: boolean;
  label?: string;
  x?: number;
  y?: number;
  z?: number;
  heading?: number;
  space?: 'local' | 'world';
  snap?: boolean;
  stick?: boolean;
  cursor?: boolean;
  mode?: 'move' | 'rotate';
  handle?: string | null;
  dragging?: boolean;
  readout?: string | null;
  warnings?: PlacerWarning[];
  canUndo?: boolean;
  canRedo?: boolean;
  snapMove?: number;
  snapTurn?: number;
}

export const usePlacer = create<{ hud: PlacerHud; set: (hud: PlacerHud) => void }>(set => ({
  hud: { active: false },
  set: hud => set({ hud }),
}));

const Kbd = ({ children, strong = false }: { children: string; strong?: boolean }) => (
  <span className="sc-kbd" style={strong ? { background: 'var(--text-1)', color: '#0c0d0f', borderColor: 'var(--text-1)' } : { color: 'var(--text-2)' }}>
    {children}
  </span>
);

const Hint = ({ keys, label, on }: { keys: string[]; label: string; on?: boolean }) => (
  <div className="flex items-center justify-between gap-3 h-6">
    <span style={{ color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
      {label}
      {on && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle" style={{ background: 'var(--ok)' }} />}
    </span>
    <span className="flex items-center gap-1">
      {keys.map(k => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  </div>
);

const Mode = ({ label, on }: { label: string; on: boolean }) => (
  <span
    className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 h-6 px-2 rounded-[6px] text-[11.5px] font-medium transition-colors"
    style={{ background: on ? 'rgba(255,255,255,0.1)' : 'transparent', color: on ? 'var(--text-1)' : 'var(--text-3)', border: `1px solid ${on ? 'rgba(255,255,255,0.14)' : 'var(--hairline)'}` }}
  >
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? 'var(--ok)' : 'var(--text-4)' }} />
    {label}
  </span>
);

const Axis = ({ name, value, colour }: { name: string; value?: number; colour: string }) => (
  <span className="inline-flex items-baseline gap-1.5">
    <span className="text-[11px] font-semibold" style={{ color: colour }}>
      {name}
    </span>
    <span className="mono text-[12.5px]">{(value ?? 0).toFixed(2)}</span>
  </span>
);

const warningText = (w: PlacerWarning) => {
  return t(`placement.warnings.${w.key}`, w.value ?? '');
};

export const PlacementHud = () => {
  const hud = usePlacer(s => s.hud);
  const handleName = hud.handle ? t(`placement.handles.${hud.handle}`) : null;
  const warnings = hud.warnings ?? [];
  return (
    <>
      {hud.dragging && hud.readout && (
        <div className="fixed inset-x-0 top-10 flex justify-center font-sans animate-fadeIn pointer-events-none">
          <div className="flex items-center gap-2.5 h-9 px-3.5 rounded-[9px]" style={{ background: 'rgba(18,19,22,0.94)', border: '1px solid var(--hairline-strong)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
            <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
              {handleName}
            </span>
            <span className="mono text-[15px] font-semibold">{hud.readout}</span>
          </div>
        </div>
      )}

      <div className="fixed left-6 top-1/2 -translate-y-1/2 font-sans animate-fadeIn" style={{ width: 236 }}>
        <div className="rounded-[12px] px-3.5 py-3 text-[12px]" style={{ background: 'rgba(18,19,22,0.9)', border: '1px solid var(--hairline-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}>
          <div className="sc-label mb-1">{t('placement.groups.gizmo')}</div>
          <Hint keys={['G']} label={t('placement.keys.cursor')} on={hud.cursor} />
          <Hint keys={['RMB']} label={t('placement.keys.look')} />
          <Hint keys={['LMB']} label={t('placement.keys.drag')} />
          <Hint keys={['W']} label={t('placement.keys.move')} on={hud.mode !== 'rotate'} />
          <Hint keys={['R']} label={t('placement.keys.rotate_mode')} on={hud.mode === 'rotate'} />
          <Hint keys={['Q']} label={hud.space === 'world' ? t('placement.modes.world') : t('placement.modes.local')} />
          <div className="sc-label mt-2.5 mb-1">{t('placement.groups.move')}</div>
          <Hint keys={['Wheel']} label={t('placement.keys.rotate')} />
          <Hint keys={['↑', '↓', '←', '→']} label={t('placement.keys.nudge')} />
          <Hint keys={['PgUp', 'PgDn']} label={t('placement.keys.height')} />
          <div className="sc-label mt-2.5 mb-1">{t('placement.groups.edit')}</div>
          <Hint keys={['X']} label={t('placement.keys.snap')} on={hud.snap} />
          <Hint keys={['T']} label={t('placement.keys.stick')} on={hud.stick} />
          <Hint keys={['Alt']} label={t('placement.keys.drop')} />
          <Hint keys={['Ctrl', 'Z']} label={t('placement.keys.undo')} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-8 flex justify-center font-sans pointer-events-none">
      <div className="animate-toastIn flex flex-col items-center gap-2" style={{ width: 'min(860px, calc(100vw - 48px))' }}>
        {warnings.map(w => (
          <div key={w.key} className="flex items-center gap-2 h-8 px-3 rounded-[8px] text-[12px] animate-fadeIn" style={{ background: 'rgba(40,30,12,0.94)', border: '1px solid rgba(229,163,59,0.45)', color: '#f3c77a' }}>
            <AlertTriangle size={13} />
            {warningText(w)}
          </div>
        ))}
        <div className="w-full rounded-[12px] overflow-hidden" style={{ background: 'rgba(18,19,22,0.94)', border: '1px solid var(--hairline-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
          <div className="flex items-center gap-3 px-4 h-11" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <span className="text-[13px] font-semibold">{t('placement.title', hud.label ?? '')}</span>
            {handleName && (
              <span className="text-[11.5px] px-1.5 h-5 inline-flex items-center rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-1)' }}>
                {handleName}
              </span>
            )}
            <span className="ml-auto flex items-center gap-4">
              <Axis name="X" value={hud.x} colour="#ef5b5b" />
              <Axis name="Y" value={hud.y} colour="#48d680" />
              <Axis name="Z" value={hud.z} colour="#609cff" />
              <span className="inline-flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold" style={{ color: '#eeb848' }}>
                  H
                </span>
                <span className="mono text-[12.5px]">{(hud.heading ?? 0).toFixed(1)}°</span>
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 h-12">
            <Mode label={hud.snap ? `${t('placement.modes.snap')} ${hud.snapMove ?? 0.25} m · ${hud.snapTurn ?? 15}°` : t('placement.modes.snap')} on={!!hud.snap} />
            <Mode label={hud.mode === 'rotate' ? t('placement.modes.rotate') : t('placement.modes.move')} on />
            <Mode label={t('placement.modes.cursor')} on={!!hud.cursor} />
            <Mode label={t('placement.modes.stick')} on={!!hud.stick} />
            <Mode label={hud.space === 'world' ? t('placement.modes.world') : t('placement.modes.local')} on={hud.space === 'world'} />
            <span className="ml-auto pl-3 flex shrink-0 whitespace-nowrap items-center gap-3 text-[12px]">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <Kbd>Backspace</Kbd>
                {t('placement.keys.cancel')}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Kbd strong>Enter</Kbd>
                {t('placement.keys.confirm')}
              </span>
            </span>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};
