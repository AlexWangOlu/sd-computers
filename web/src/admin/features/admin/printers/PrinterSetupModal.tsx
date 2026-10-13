import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, Crosshair, Printer as PrinterIcon } from 'lucide-react';
import { Hint, Modal, ModalActions } from '@/admin/components/shared';
import { useAdmin } from '@/admin/store/admin';
import { act, place } from '@/admin/nui/api';
import { t } from '@/admin/i18n';
import type { Printer, PrinterProp } from '@/admin/types';

// What a printer prop looks like: its picture (web/public/props/<model>.jpg, or the `image` its
// config entry gives), and a printer drawn in its place when there is none.
export const PropPicture = ({ prop, className = '', style, iconSize = 22 }: { prop?: PrinterProp; className?: string; style?: CSSProperties; iconSize?: number }) => {
  const [missing, setMissing] = useState<string | null>(null);
  const src = prop ? (prop.image ?? `props/${prop.model}.jpg`) : null;
  return (
    <span className={`flex items-center justify-center overflow-hidden ${className}`} style={{ background: 'var(--surface-1)', color: 'var(--text-3)', ...style }}>
      {src && missing !== src ? <img src={src} alt="" draggable={false} className="w-full h-full object-cover" onError={() => setMissing(src)} /> : <PrinterIcon size={iconSize} />}
    </span>
  );
};

// Standing a printer, or changing one: what it is called and the prop it is. Standing one hands
// over to the gizmo. With `world` it makes a printer of a prop the game already has instead: there
// is no prop to choose (the admin aims at it next), and one made that way keeps the prop it is.
// The server checks every field again either way.
export function PrinterSetupModal({ printer, world, onClose }: { printer?: Printer; world?: boolean; onClose(): void }) {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const props = snapshot.printers.props;
  const existing = world || printer?.world === true; // its prop is the game's own
  const [label, setLabel] = useState(printer?.label ?? t('printers.default_label'));
  const [prop, setProp] = useState(printer?.prop ?? props[0]?.model ?? '');

  const name = label.trim();
  const valid = name.length > 0 && (existing || props.some(p => p.model === prop));

  async function save() {
    if (!valid || busy) return;
    if (!printer) {
      onClose();
      await place(world ? 'pickprinter' : 'placeprinter', { label: name, prop });
      return;
    }
    const reply = await act('updateprinter', { id: printer.id, label: name, prop }, t('printers.saved'));
    if (reply.success) onClose();
  }

  return (
    <Modal title={t(printer ? 'printers.edit' : world ? 'printers.pick_title' : 'printers.place')} onClose={onClose} width={existing ? 440 : 560}>
      <label className="sc-label block mb-1.5" htmlFor="printer-label">
        {t('printers.name')}
      </label>
      <input id="printer-label" className="sc-input w-full" maxLength={snapshot.rules.maxLabel} value={label} onChange={e => setLabel(e.target.value)} placeholder={t('printers.name_placeholder')} autoFocus />
      <Hint className="mt-2">{t('printers.name_hint')}</Hint>

      {existing ? (
        <div className="flex items-center gap-3 mt-4 p-3 rounded-[10px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
          <span className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-[8px]" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
            <Crosshair size={17} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{printer ? (props.find(p => p.model === printer.prop)?.label ?? printer.prop) : t('printers.pick_next')}</div>
            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
              {t(printer ? 'printers.picked_hint' : 'printers.pick_hint')}
            </div>
          </div>
        </div>
      ) : (
        <>
          <span className="sc-label block mt-4 mb-1.5">{t('printers.prop')}</span>
          <div className="grid grid-cols-4 gap-2" role="group">
            {props.map(p => {
              const on = prop === p.model;
              return (
                <button
                  key={p.model}
                  type="button"
                  aria-pressed={on}
                  title={p.model}
                  onClick={() => setProp(p.model)}
                  className="relative flex flex-col text-left p-1.5 rounded-[8px] transition-colors"
                  style={{ background: on ? 'var(--surface-3)' : 'var(--surface-2)', border: `1px solid ${on ? 'var(--hairline-focus)' : 'var(--hairline)'}` }}
                >
                  <PropPicture prop={p} className="w-full rounded-[5px]" style={{ aspectRatio: '4 / 3' }} />
                  <span className="block mt-1.5 px-0.5 text-[11.5px] font-medium truncate" style={{ color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
                    {p.label}
                  </span>
                  {on && (
                    <span className="absolute top-2.5 right-2.5 flex items-center justify-center w-4 h-4 rounded-full" style={{ background: 'var(--text-1)', color: '#0c0d0f' }}>
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {!props.length && <Hint className="mt-2">{t('printers.no_props')}</Hint>}
          {!printer && <Hint className="mt-3">{t('printers.place_hint')}</Hint>}
        </>
      )}

      <ModalActions>
        <button type="button" className="sc-btn" onClick={onClose}>
          {t('actions.cancel')}
        </button>
        <button type="button" className="sc-btn sc-btn--primary" disabled={!valid || busy} onClick={() => void save()}>
          {t(printer ? 'actions.save' : world ? 'printers.pick_world' : 'printers.place_next')}
        </button>
      </ModalActions>
    </Modal>
  );
}
