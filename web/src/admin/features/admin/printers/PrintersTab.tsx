import { useState } from 'react';
import { Crosshair, Move, Navigation, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { Badge, ConfirmDialog, Empty, Heading, Hint, SearchInput, Status } from '@/admin/components/shared';
import { ScrollArea } from '@/admin/components/ScrollArea';
import { useAdmin } from '@/admin/store/admin';
import { act, place } from '@/admin/nui/api';
import { t } from '@/admin/i18n';
import type { Printer } from '@/admin/types';
import { PrinterSetupModal, PropPicture } from './PrinterSetupModal';

const whereOf = (p: Printer) => `${p.prop} · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;

const Row = ({ p, onEdit, onDelete }: { p: Printer; onEdit: () => void; onDelete: () => void }) => {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const edit = snapshot.canEdit;
  const prop = snapshot.printers.props.find(x => x.model === p.prop);
  const label = prop?.label;
  return (
    <div className="sc-row">
      <PropPicture prop={prop ?? { model: p.prop, label: p.prop }} className="rounded-[6px] flex-shrink-0" style={{ width: 38, height: 38, boxShadow: '0 0 0 1px var(--hairline-strong)' }} iconSize={16} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-medium truncate">{p.label}</span>
          {label && <Badge>{label}</Badge>}
          <Badge tone={p.world ? 'neutral' : 'accent'}>{t(p.world ? 'printers.source_world' : 'printers.source_placed')}</Badge>
          {p.waiting > 0 ? <Status tone="ok">{t(p.waiting === 1 ? 'printers.waiting_one' : 'printers.waiting', p.waiting)}</Status> : <Status>{t('printers.tray_empty')}</Status>}
        </div>
        <div className="text-[11.5px] mono mt-1 truncate" style={{ color: 'var(--text-3)' }}>
          {whereOf(p)}
        </div>
      </div>
      {edit && (
        <div className="sc-row__actions">
          <button type="button" className="sc-btn sc-btn--icon" title={t('printers.go')} aria-label={t('printers.go')} disabled={busy} onClick={() => void act('teleportprinter', { id: p.id })}>
            <Navigation size={14} />
          </button>
          <button type="button" className="sc-btn sc-btn--icon" title={t('actions.edit')} aria-label={t('actions.edit')} disabled={busy} onClick={onEdit}>
            <Pencil size={14} />
          </button>
          {/* (a picked prop is where the game put it) */}
          {!p.world && (
            <button type="button" className="sc-btn sc-btn--icon" title={t('actions.move')} aria-label={t('actions.move')} disabled={busy} onClick={() => void place('moveprinter', { id: p.id })}>
              <Move size={14} />
            </button>
          )}
          <button type="button" className="sc-btn sc-btn--icon sc-btn--danger" title={t('actions.delete')} aria-label={t('actions.delete')} disabled={busy} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

// Every printer on the server. A printer is a prop stood here with the gizmo, or one the game
// already has, picked by aiming at it. The computers within reach of it print to it: the page
// waits in its tray (the count on its row) until somebody at the printer takes it, as an item.
export function PrintersTab() {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const edit = snapshot.canEdit;
  const [setup, setSetup] = useState<{ printer?: Printer; world?: boolean } | null>(null);
  const [deleting, setDeleting] = useState<Printer | null>(null);
  const [search, setSearch] = useState('');

  const { list, max, range, item, enabled, itemMissing } = snapshot.printers;
  const full = list.length >= max;
  const query = search.trim().toLowerCase();
  const shown = list.filter(p => `${p.label} ${p.prop}`.toLowerCase().includes(query));

  return (
    <div className="flex flex-col h-full min-h-0 px-6 py-5 gap-4">
      <Heading title={t('tabs.printers')} count={list.length}>
        {edit && (
          <>
            <button type="button" className="sc-btn" disabled={busy || full} title={full ? t('printers.full', max) : t('printers.pick_hint')} onClick={() => setSetup({ world: true })}>
              <Crosshair size={14} />
              {t('printers.pick')}
            </button>
            <button type="button" className="sc-btn sc-btn--primary" disabled={busy || full} title={full ? t('printers.full', max) : undefined} onClick={() => setSetup({})}>
              <Plus size={14} />
              {t('printers.place')}
            </button>
          </>
        )}
      </Heading>

      <Hint className="flex-shrink-0">
        {enabled ? (
          t('printers.about', Math.round(range), item)
        ) : (
          <span style={{ color: 'var(--warn)' }}>
            <TriangleAlert size={12} className="inline-block mr-1" style={{ verticalAlign: -2 }} />
            {t('printers.disabled')}
          </span>
        )}
      </Hint>

      {enabled && itemMissing && (
        <Hint className="flex-shrink-0">
          <span style={{ color: 'var(--warn)' }}>
            <TriangleAlert size={12} className="inline-block mr-1" style={{ verticalAlign: -2 }} />
            {t('printers.item_missing', item)}
          </span>
        </Hint>
      )}

      {list.length > 0 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <SearchInput value={search} onChange={setSearch} placeholder={t('printers.search')} />
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {!list.length ? (
          <Empty text={t('printers.empty')} />
        ) : !shown.length ? (
          <Empty text={t('computers.no_results')} />
        ) : (
          <div className="sc-list">
            {shown.map(p => (
              <Row key={p.id} p={p} onEdit={() => setSetup({ printer: p })} onDelete={() => setDeleting(p)} />
            ))}
          </div>
        )}
      </ScrollArea>

      {setup && <PrinterSetupModal printer={setup.printer} world={setup.world} onClose={() => setSetup(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('printers.delete')}
          body={t(deleting.waiting > 0 ? 'printers.delete_confirm_tray' : 'printers.delete_confirm', deleting.label, deleting.waiting)}
          confirmLabel={t('actions.delete')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const reply = await act('deleteprinter', { id: deleting.id }, t('printers.deleted', deleting.label));
            if (reply.success) setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
