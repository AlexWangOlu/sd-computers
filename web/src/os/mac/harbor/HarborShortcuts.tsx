import { HarborModal } from './HarborModal';
import { useMacOS } from './compat';

const KEYS = [
  ['Ctrl / ⌘ K', 'spotlight'],
  ['Ctrl Space', 'spotlight'],
  ['Esc', 'leave'],
  ['Alt F4', 'closeWindow'],
  ['Ctrl ⌘ Q', 'lock'],
] as const;

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useMacOS();
  return (
    <HarborModal open={open} onClose={onClose} title={t.help.shortcuts} width={520}>
      <div className="grid grid-cols-1 gap-2">
        {KEYS.map(([keys, action]) => (
          <div key={keys} className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/5">
            <span className="text-sm text-white/85">{t.help.keys[action]}</span>
            <kbd className="font-mono text-xs px-2 py-1 rounded-md bg-white/10 border border-white/15">{keys}</kbd>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-white/50">{t.help.tip}</p>
    </HarborModal>
  );
}
