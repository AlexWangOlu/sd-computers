import { useState } from 'react';
import { Hint, Modal, ModalActions } from '@/admin/components/shared';
import { useAdmin } from '@/admin/store/admin';
import { act } from '@/admin/nui/api';
import { t } from '@/admin/i18n';
import type { Prop } from '@/admin/types';

const KINDS = ['monitor', 'tower', 'laptop'] as const;

// A prop of the server's own, beside the ones in configs/shared/admin.lua: a model name the game
// has (a streamed one counts), what to call it and what kind of thing it is. From then on a
// computer can be placed as it, one can be picked from the world, and the Automatic tab offers it.
// The game is asked whether the model exists before it is kept. (The props themselves are listed,
// and taken away again, in the Props tab.)
export function AddPropModal({ onClose, onAdded }: { onClose(): void; onAdded?(model: string): void }) {
  const snapshot = useAdmin(s => s.snapshot)!;
  const busy = useAdmin(s => s.busy);
  const [model, setModel] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<NonNullable<Prop['kind']>>('monitor');

  const name = model.trim().toLowerCase();
  const taken = snapshot.props.some(p => p.model === name);
  const valid = /^[a-z0-9_]{1,64}$/.test(name) && !taken;

  async function add() {
    if (!valid || busy) return;
    const title = label.trim() || name;
    const reply = await act('addprop', { model: name, label: title, kind }, t('props.added', title));
    if (!reply.success) return;
    onAdded?.(name);
    onClose();
  }

  return (
    <Modal title={t('props.add_title')} onClose={onClose} width={480}>
      <Hint>{t('props.hint')}</Hint>

      <div className="mt-3.5">
        <label className="sc-label block mb-1.5" htmlFor="prop-model">
          {t('props.model')}
        </label>
        <input id="prop-model" className="sc-input w-full mono" maxLength={64} value={model} spellCheck={false} autoFocus onChange={e => setModel(e.target.value)} onKeyDown={e => e.key === 'Enter' && void add()} placeholder="prop_monitor_01a" />
        {/* (always there, so saying a model is taken never moves what is below it) */}
        <p className="text-[11.5px] m-0 mt-1" style={{ minHeight: 17, color: 'var(--warn)' }}>
          {taken ? t('props.taken') : ''}
        </p>
      </div>

      <div className="flex items-end gap-3 mt-1">
        <div className="flex-1 min-w-0">
          <label className="sc-label block mb-1.5" htmlFor="prop-label">
            {t('props.label')}
          </label>
          <input id="prop-label" className="sc-input w-full" maxLength={snapshot.rules.maxLabel} value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && void add()} placeholder={t('props.label_placeholder')} />
        </div>
        <div className="flex-shrink-0">
          <span className="sc-label block mb-1.5">{t('props.kind')}</span>
          <div className="sc-segment" style={{ height: 32, alignItems: 'center' }}>
            {KINDS.map(k => (
              <button key={k} type="button" data-on={kind === k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {t(`props.kind_${k}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Hint className="mt-3.5">{t('props.screen_hint')}</Hint>

      <ModalActions>
        <button type="button" className="sc-btn" onClick={onClose}>
          {t('actions.cancel')}
        </button>
        <button type="button" className="sc-btn sc-btn--primary" disabled={!valid || busy} onClick={() => void add()}>
          {t('props.add')}
        </button>
      </ModalActions>
    </Modal>
  );
}
