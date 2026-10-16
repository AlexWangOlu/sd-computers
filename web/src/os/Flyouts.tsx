import { useState, type ReactNode } from 'react';
import { Accessibility, Airplay, BatteryFull, BatteryCharging, Bluetooth, ChevronDown, ChevronUp, Moon, Plane, Settings as Gear, Sun, Volume2, Wifi, X } from 'lucide-react';
import { useOS, type Toast } from '@/store/os';
import { fmtLongDate, fmtMonthYear, fmtWeekdayInitials, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { AppIcon } from './icons';

/** Clock flyout: long date + a month calendar with today ringed in accent. */
export function CalendarFlyout() {
  const now = useNow(30000);
  const [offset, setOffset] = useState(0);
  // Which way the month was last paged: the grid slides in from that side.
  const [paged, setPaged] = useState<'next' | 'prev' | null>(null);
  const page = (by: 1 | -1) => {
    setOffset(o => o + by);
    setPaged(by > 0 ? 'next' : 'prev');
  };
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const startDay = view.getDay();
  const daysIn = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const prevDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
  const cells: { d: number; cur: boolean; today: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const n = i - startDay + 1;
    if (n < 1) cells.push({ d: prevDays + n, cur: false, today: false });
    else if (n > daysIn) cells.push({ d: n - daysIn, cur: false, today: false });
    else cells.push({ d: n, cur: true, today: offset === 0 && n === now.getDate() });
  }
  const weekdays = fmtWeekdayInitials();
  return (
    <Panel>
      <div className="px-4 py-3 border-b border-stroke text-body font-semibold text-t1">{fmtLongDate(now)}</div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div key={offset} className={`text-body font-semibold text-t1 ${paged ? 'fade-in' : ''}`}>{fmtMonthYear(view)}</div>
          <div className="flex gap-1">
            <button type="button" onClick={() => page(-1)} className="w-8 h-8 flex items-center justify-center rounded-ctl hover:bg-subtle active:scale-90 text-t1"><ChevronUp size={16} /></button>
            <button type="button" onClick={() => page(1)} className="w-8 h-8 flex items-center justify-center rounded-ctl hover:bg-subtle active:scale-90 text-t1"><ChevronDown size={16} /></button>
          </div>
        </div>
        <div key={offset} className={`grid grid-cols-7 gap-y-1 text-center ${paged ? `cal-${paged}` : ''}`}>
          {weekdays.map(w => <div key={w} className="text-caption text-t1 h-8 flex items-center justify-center">{w}</div>)}
          {cells.map((c, i) => (
            <div key={i} className="h-10 flex items-center justify-center">
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-full text-body ${c.today ? 'bg-accent text-accent-on font-semibold' : c.cur ? 'text-t1 hover:bg-subtle' : 'text-t3'}`}
              >
                {c.d}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Quick settings: cosmetic toggle tiles, brightness + volume sliders, battery, Settings shortcut. */
export function QuickSettings() {
  const payload = useOS(s => s.payload)!;
  const { openApp, setFlyout } = useOS.getState();
  const [on, setOn] = useState<Record<string, boolean>>({ wifi: true, bt: true, air: false, saver: false, focus: false, a11y: false });
  const [bright, setBright] = useState(80);
  const [vol, setVol] = useState(45);
  const tiles: { key: string; icon: ReactNode; label: string }[] = [
    { key: 'wifi', icon: <Wifi size={16} />, label: t('ui.quick.wifi') },
    { key: 'bt', icon: <Bluetooth size={16} />, label: t('ui.quick.bluetooth') },
    { key: 'air', icon: <Plane size={16} />, label: t('ui.quick.airplane') },
    { key: 'saver', icon: <BatteryCharging size={16} />, label: t('ui.quick.saver') },
    { key: 'focus', icon: <Moon size={16} />, label: t('ui.quick.focus') },
    { key: 'a11y', icon: <Accessibility size={16} />, label: t('ui.quick.accessibility') },
  ];
  const hasSettings = payload.computer.apps.some(a => a.id === 'settings');
  return (
    <Panel>
      <div className="p-5 grid grid-cols-3 gap-x-3 gap-y-4">
        {tiles.map(tl => (
          <div key={tl.key} className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOn(o => ({ ...o, [tl.key]: !o[tl.key] }))}
              className={`w-full h-12 rounded-ctl flex items-center justify-center border active:scale-95 ${
                on[tl.key] ? 'bg-accent text-accent-on border-transparent hover:bg-accent-hover' : 'bg-control border-stroke-strong text-t1 hover:bg-control-hover'
              }`}
            >
              {tl.icon}
            </button>
            <span className="text-caption text-t1 truncate max-w-full">{tl.label}</span>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5 flex flex-col gap-4">
        <Slider icon={<Sun size={16} />} value={bright} onChange={setBright} />
        <Slider icon={<Volume2 size={16} />} value={vol} onChange={setVol} />
      </div>
      <div className="h-12 px-4 flex items-center justify-between border-t border-stroke bg-[var(--card)]">
        <span className="flex items-center gap-2 text-caption text-t1"><BatteryFull size={16} />100%</span>
        <div className="flex items-center gap-1">
          <span className="w-8 h-8 flex items-center justify-center text-t1"><Airplay size={16} /></span>
          {hasSettings && (
            <button type="button" title={t('ui.quick.settings')} onClick={() => { openApp('settings'); setFlyout(null); }} className="w-8 h-8 flex items-center justify-center rounded-ctl hover:bg-subtle text-t1">
              <Gear size={16} />
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Slider({ icon, value, onChange }: { icon: ReactNode; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-t1">
      {icon}
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1" style={{ accentColor: 'var(--accent-fill)' }} />
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  const ref = useExitFx('fly-out');
  return (
    <div ref={ref} className="absolute right-3 bottom-[60px] w-[360px] acrylic rounded-win shadow-flyout overflow-hidden fly-up" style={{ zIndex: 9100 }} onMouseDown={e => e.stopPropagation()}>
      {children}
    </div>
  );
}

/**
 * Bottom-right toast notifications (new mail, hack results, ...). Click runs the toast's action.
 * The stack stays mounted while empty: a toast's way out plays inside it.
 */
export function Toasts() {
  const toasts = useOS(s => s.toasts);
  const payload = useOS(s => s.payload);
  const labelOf = (app: string) => payload?.computer.apps.find(a => a.id === app)?.label ?? t('ui.toast.system');
  return (
    <div className="absolute right-3 bottom-[60px] flex flex-col gap-2 items-end" style={{ zIndex: 9200 }} onMouseDown={e => e.stopPropagation()}>
      {toasts.map(tst => (
        <ToastCard key={tst.id} toast={tst} label={labelOf(tst.app)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, label }: { toast: Toast; label: string }) {
  const { dismissToast } = useOS.getState();
  const ref = useExitFx('toast-out', 400);
  return (
    <div
      ref={ref}
      data-sfx="press"
      onClick={() => {
        toast.onClick?.();
        dismissToast(toast.id);
      }}
      className={`w-[364px] acrylic rounded-win shadow-flyout p-3 toast-in ${toast.onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <AppIcon app={toast.app} size={16} />
        <span className="flex-1 text-caption text-t2 truncate">{label}</span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            dismissToast(toast.id);
          }}
          className="w-6 h-6 flex items-center justify-center rounded-ctl hover:bg-subtle text-t2"
        >
          <X size={12} />
        </button>
      </div>
      <div className="text-body font-semibold text-t1 truncate">{toast.title}</div>
      {toast.body && <div className="text-body text-t2 line-clamp-2">{toast.body}</div>}
    </div>
  );
}
