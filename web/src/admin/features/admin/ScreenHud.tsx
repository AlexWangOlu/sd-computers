import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { t } from '@/admin/i18n';

// What the screen tool (client/admin/screener.lua) says about the screen being drawn on a prop.
export interface ScreenerHud {
  active: boolean;
  label?: string;
  model?: string;
  x?: number; // the middle of the screen, metres from the prop's origin (as configs/shared/screens.lua has it)
  y?: number;
  z?: number;
  w?: number;
  h?: number;
  tilt?: number;
  heading?: number;
  drawn?: boolean; // there is a box to see (a prop nothing was drawn on yet has none)
  over?: 'draw' | 'move' | 'resize' | null; // what a press would do where the cursor is
  dragging?: boolean;
  edgeOn?: boolean; // the screen is seen from too far round to drag on
  looking?: boolean; // the right button is held: the cursor is away
  view?: 'front' | 'side' | 'free';
  picture?: boolean; // the lock face is drawn in the box
  canUndo?: boolean;
  note?: string | null; // something that just happened (screener.notes.<note>)
  noteId?: number;
}

export const useScreener = create<{ hud: ScreenerHud; set: (hud: ScreenerHud) => void }>(set => ({
  hud: { active: false },
  set: hud => set({ hud }),
}));

const Kbd = ({ children, strong = false }: { children: string; strong?: boolean }) => (
  <span className="sc-kbd" style={strong ? { background: 'var(--text-1)', color: '#0c0d0f', borderColor: 'var(--text-1)' } : { color: 'var(--text-2)' }}>
    {children}
  </span>
);

const Hint = ({ keys, label, on, dim }: { keys: string[]; label: string; on?: boolean; dim?: boolean }) => (
  <div className="flex items-center justify-between gap-3 h-6" style={{ opacity: dim ? 0.4 : 1 }}>
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

const Value = ({ name, children }: { name: string; children: string }) => (
  <span className="inline-flex items-baseline gap-1.5">
    <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
      {name}
    </span>
    <span className="mono text-[12.5px]">{children}</span>
  </span>
);

const cm = (metres?: number) => ((metres ?? 0) * 100).toFixed(1);

// The one thing to do next, said plainly: what is on the screen decides it.
const nextStep = (hud: ScreenerHud) => {
  if (hud.looking) return t('screener.hint.looking');
  if (!hud.drawn) return t('screener.hint.draw');
  if (hud.edgeOn) return t('screener.hint.edge');
  if (hud.view === 'side') return t('screener.hint.side');
  return t('screener.hint.fit');
};

// Drawing a prop's screen: the keys down the left, like the gizmo's; along the bottom what is being
// drawn, how big it is and what to do next; and at the top what just happened. Look-only - the
// mouse belongs to the box on the prop.
export const ScreenHud = () => {
  const hud = useScreener(s => s.hud);
  const drawn = !!hud.drawn;

  // A note shows for a moment after it is made (the tool counts them: the same note twice is two).
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!hud.noteId || !hud.note) return;
    setNote(hud.note);
    const id = window.setTimeout(() => setNote(null), 2400);
    return () => window.clearTimeout(id);
  }, [hud.noteId, hud.note]);

  const size = `${cm(hud.w)} × ${cm(hud.h)} cm`;
  return (
    <>
      {(note || (hud.dragging && hud.over !== 'move')) && (
        <div className="fixed inset-x-0 top-10 flex justify-center font-sans animate-fadeIn pointer-events-none">
          <div className="flex items-center gap-2.5 h-9 px-3.5 rounded-[9px]" style={{ background: 'rgba(18,19,22,0.94)', border: '1px solid var(--hairline-strong)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
            {note ? <span className="text-[12.5px] font-medium">{t(`screener.notes.${note}`)}</span> : <span className="mono text-[15px] font-semibold">{size}</span>}
          </div>
        </div>
      )}

      <div className="fixed left-6 top-1/2 -translate-y-1/2 font-sans animate-fadeIn pointer-events-none" style={{ width: 248 }}>
        <div className="rounded-[12px] px-3.5 py-3 text-[12px]" style={{ background: 'rgba(18,19,22,0.9)', border: '1px solid var(--hairline-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}>
          <div className="sc-label mb-1">{t('screener.groups.draw')}</div>
          <Hint keys={['LMB']} label={t('screener.keys.drag')} />
          <Hint keys={['RMB']} label={t('screener.keys.look')} on={hud.looking} />
          <div className="sc-label mt-2.5 mb-1">{t('screener.groups.fit')}</div>
          <Hint keys={['Wheel']} label={t('screener.keys.depth')} dim={!drawn} />
          <Hint keys={['Q', 'E']} label={t('screener.keys.lean')} dim={!drawn} />
          <Hint keys={['↑', '↓', '←', '→']} label={t('screener.keys.nudge')} dim={!drawn} />
          <Hint keys={['G']} label={t('screener.keys.snap')} dim={!drawn} />
          <Hint keys={['Shift']} label={t('screener.keys.coarse')} dim={!drawn} />
          <div className="sc-label mt-2.5 mb-1">{t('screener.groups.view')}</div>
          <Hint keys={['F']} label={t('screener.keys.front')} on={hud.view === 'front'} />
          <Hint keys={['V']} label={t('screener.keys.side')} on={hud.view === 'side'} />
          <Hint keys={['Ctrl', 'Wheel']} label={t('screener.keys.zoom')} />
          <Hint keys={['H']} label={t('screener.keys.picture')} on={hud.picture} />
          <Hint keys={['R']} label={t('screener.keys.turn')} />
          <div className="sc-label mt-2.5 mb-1">{t('screener.groups.edit')}</div>
          <Hint keys={['Ctrl', 'Z']} label={t('screener.keys.undo')} dim={!hud.canUndo} />
          <Hint keys={['Del']} label={t('screener.keys.reset')} />
          <Hint keys={['C']} label={t('screener.keys.copy')} dim={!drawn} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-8 flex justify-center font-sans pointer-events-none">
        <div className="animate-toastIn rounded-[12px] overflow-hidden" style={{ width: 'min(900px, calc(100vw - 48px))', background: 'rgba(18,19,22,0.94)', border: '1px solid var(--hairline-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
          <div className="flex items-center gap-3 px-4 h-11" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <span className="text-[13px] font-semibold truncate">{t('screener.title', hud.label ?? hud.model ?? '')}</span>
            {hud.over && !hud.looking && (
              <span className="text-[11.5px] px-1.5 h-5 inline-flex items-center rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-1)' }}>
                {t(`screener.over.${hud.over}`)}
              </span>
            )}
            <span className="ml-auto flex items-center gap-4 flex-shrink-0" style={{ opacity: drawn ? 1 : 0.35 }}>
              <Value name={t('screener.size')}>{size}</Value>
              <Value name={t('screener.lean')}>{`${(hud.tilt ?? 0).toFixed(1)}°`}</Value>
              <Value name={t('screener.middle')}>{`${(hud.x ?? 0).toFixed(3)}, ${(hud.y ?? 0).toFixed(3)}, ${(hud.z ?? 0).toFixed(3)}`}</Value>
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 h-12">
            <span className="min-w-0 truncate text-[12.5px]" style={{ color: 'var(--text-2)' }}>
              {nextStep(hud)}
            </span>
            <span className="ml-auto pl-3 flex shrink-0 whitespace-nowrap items-center gap-3 text-[12px]">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <Kbd>Backspace</Kbd>
                {t('screener.keys.cancel')}
              </span>
              <span className="flex items-center gap-1.5 font-medium" style={{ opacity: drawn ? 1 : 0.45 }}>
                <Kbd strong={drawn}>Enter</Kbd>
                {t('screener.keys.confirm')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
