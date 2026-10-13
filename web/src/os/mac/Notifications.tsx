import { X } from 'lucide-react';
import { useOS, type Toast } from '@/store/os';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { MacIcon } from './MacIcon';
import { MENU_H } from './layout';

/**
 * Notification banners: rounded translucent cards sliding in at the top right, under the menu bar.
 * Click runs the toast's action; the round close button appears on hover. (The store drops each
 * toast after a few seconds; App.tsx already plays the chime for mail.) The stack stays mounted
 * while empty: a banner's way out plays inside it.
 */
export default function Notifications() {
  const toasts = useOS(s => s.toasts);
  return (
    <div className="absolute right-3 flex flex-col gap-2.5 w-[356px]" style={{ top: MENU_H + 8, zIndex: 55 }} onMouseDown={e => e.stopPropagation()}>
      {toasts.map(tst => (
        <Banner key={tst.id} toast={tst} />
      ))}
    </div>
  );
}

function Banner({ toast }: { toast: Toast }) {
  const { dismissToast } = useOS.getState();
  const ref = useExitFx('toast-out', 400);
  return (
    <div
      ref={ref}
      data-sfx="press"
      className={`mac-toast group ${toast.onClick ? 'cursor-pointer' : ''}`}
      onClick={() => {
        toast.onClick?.();
        dismissToast(toast.id);
      }}
    >
      <button
        type="button"
        aria-label={t('ui.mac.dismiss')}
        title={t('ui.mac.dismiss')}
        className="mac-toast-close"
        onClick={e => {
          e.stopPropagation();
          dismissToast(toast.id);
        }}
      >
        <X size={10} strokeWidth={3} />
      </button>
      <MacIcon app={toast.app} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-t1">{toast.title}</span>
          <span className="shrink-0 text-[12px] text-t3">{t('ui.mac.now')}</span>
        </div>
        {toast.body && <div className="text-[13px] leading-[17px] text-t2 line-clamp-2">{toast.body}</div>}
      </div>
    </div>
  );
}
