// Toasts as small bevelled message boxes stacked in the desktop's bottom-right corner, each
// arriving with a chime. Click runs the toast's action; the control box dismisses it.
import { useEffect, useRef } from 'react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { GlyphSys, PixelAppIcon } from './glyphs';
import { retroSfx } from './sounds';

export default function Toasts() {
  const toasts = useOS(s => s.toasts);
  const payload = useOS(s => s.payload);
  const { dismissToast } = useOS.getState();

  // Chime once per NEW toast (not for ones already up when the desktop mounted).
  const seen = useRef(toasts.reduce((m, x) => Math.max(m, x.id), 0));
  useEffect(() => {
    const top = toasts.reduce((m, x) => Math.max(m, x.id), 0);
    if (top > seen.current) retroSfx.notify();
    seen.current = Math.max(seen.current, top);
  }, [toasts]);

  if (toasts.length === 0) return null;
  const labelOf = (app: string) => payload?.computer.apps.find(a => a.id === app)?.label ?? t('ui.retro.toast_system');

  return (
    <div className="rt-toasts" onPointerDown={e => e.stopPropagation()}>
      {toasts.map(tst => (
        <div
          key={tst.id}
          role="status"
          className={`rt-win is-active rt-toast${tst.onClick ? ' is-clickable' : ''}`}
          onClick={() => {
            tst.onClick?.();
            dismissToast(tst.id);
          }}
        >
          <div className="rt-win-inner">
            <div className="rt-title">
              <button
                type="button"
                tabIndex={-1}
                className="rt-sysbtn rt-ctlbox"
                title={t('ui.retro.toast_dismiss')}
                aria-label={t('ui.retro.toast_dismiss')}
                onClick={e => {
                  e.stopPropagation();
                  retroSfx.click();
                  dismissToast(tst.id);
                }}
              >
                <GlyphSys />
              </button>
              <span className="rt-title-text">{labelOf(tst.app)}</span>
            </div>
            <div className="rt-toast-body">
              <PixelAppIcon app={tst.app} size={32} />
              <div className="rt-toast-text">
                <div className="rt-toast-title">{tst.title}</div>
                {tst.body && <div className="rt-toast-msg">{tst.body}</div>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
