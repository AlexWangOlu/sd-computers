import { create } from 'zustand';
import { t } from '@/admin/i18n';

// What the prop picker (client/admin/picker.lua) says about the prop under the crosshair.
export interface PickerHud {
  active: boolean;
  state?: 'none' | 'ok' | 'taken'; // nothing meant, a prop that can be taken, one that is a computer already
  model?: string | null;
  label?: string | null;
}

export const usePicker = create<{ hud: PickerHud; set: (hud: PickerHud) => void }>(set => ({
  hud: { active: false },
  set: hud => set({ hud }),
}));

const Kbd = ({ children, strong = false }: { children: string; strong?: boolean }) => (
  <span className="sc-kbd" style={strong ? { background: 'var(--text-1)', color: '#0c0d0f', borderColor: 'var(--text-1)' } : { color: 'var(--text-2)' }}>
    {children}
  </span>
);

// Picking a prop the game already has: a crosshair where the admin is looking, and one bar saying
// what is under it and what the keys do. Look-only, like the gizmo's HUD.
export const PickHud = () => {
  const hud = usePicker(s => s.hud);
  const ok = hud.state === 'ok';
  const taken = hud.state === 'taken';
  const tone = ok ? 'var(--ok)' : taken ? 'var(--warn)' : 'var(--text-4)';
  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <span className="block rounded-full" style={{ width: 6, height: 6, background: ok || taken ? tone : 'rgba(237,237,239,0.85)', boxShadow: '0 0 0 1.5px rgba(0,0,0,0.55)' }} />
      </div>

      <div className="fixed inset-x-0 bottom-8 flex justify-center font-sans pointer-events-none">
        <div className="animate-toastIn rounded-[12px] overflow-hidden" style={{ width: 'min(720px, calc(100vw - 48px))', background: 'rgba(18,19,22,0.94)', border: '1px solid var(--hairline-strong)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
          <div className="flex items-center gap-3 px-4 h-12">
            <span className="text-[13px] font-semibold flex-shrink-0">{t('pick.title')}</span>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tone }} />
            <span className="min-w-0 flex items-baseline gap-2 text-[12.5px]">
              <span className="truncate" style={{ color: ok ? 'var(--text-1)' : taken ? 'var(--warn)' : 'var(--text-3)' }}>
                {ok ? (hud.label ?? hud.model) : taken ? t('pick.taken') : t('pick.none')}
              </span>
              {(ok || taken) && hud.model && (
                <span className="mono text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>
                  {hud.model}
                </span>
              )}
            </span>
            <span className="ml-auto pl-3 flex shrink-0 whitespace-nowrap items-center gap-3 text-[12px]">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <Kbd>Backspace</Kbd>
                {t('pick.cancel')}
              </span>
              <span className="flex items-center gap-1.5 font-medium" style={{ opacity: ok ? 1 : 0.45 }}>
                <Kbd strong={ok}>Enter</Kbd>
                <Kbd strong={ok}>LMB</Kbd>
                {t('pick.confirm')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
