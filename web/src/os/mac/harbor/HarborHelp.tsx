import { CircleHelp } from 'lucide-react';
import { HarborModal } from './HarborModal';
import { useMacOS } from './compat';

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useMacOS();
  return (
    <HarborModal open={open} onClose={onClose} title={t.help.title} width={520}>
      <div className="flex items-start gap-3 text-sm leading-relaxed text-white/80">
        <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
        <p>{t.help.body}</p>
      </div>
    </HarborModal>
  );
}
