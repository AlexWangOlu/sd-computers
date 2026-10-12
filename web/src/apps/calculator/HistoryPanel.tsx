import { Trash2 } from 'lucide-react';
import { t } from '@/i18n';
import { IconButton } from '@/ui/controls';
import { formatDec } from './decimal';
import type { HistoryItem } from './engine';
import { exprText } from './expr';

/** Past calculations, newest first. Clicking one recalls it; the bin clears them all. */
export default function HistoryPanel({ items, onRecall, onClear, docked }: { items: HistoryItem[]; onRecall: (id: number) => void; onClear: () => void; docked: boolean }) {
  return (
    <div className={`flex flex-col min-h-0 h-full ${docked ? '' : 'acrylic rounded-t-win shadow-flyout fly-up'}`}>
      {docked && <div className="shrink-0 px-4 pt-3 pb-2 text-body font-semibold text-t1">{t('ui.calculator.history')}</div>}
      <div className="flex-1 min-h-0 overflow-y-auto os-scroll px-1 pt-1">
        {items.length === 0 ? (
          <div className="px-3 py-3 text-body text-t2">{t('ui.calculator.history_empty')}</div>
        ) : (
          items.map(h => (
            <button
              key={h.id}
              type="button"
              tabIndex={-1}
              onMouseDown={e => e.preventDefault()}
              onClick={() => onRecall(h.id)}
              className="w-full flex flex-col items-end gap-0.5 px-3 py-2 rounded-ctl text-right hover:bg-subtle active:bg-control-press"
            >
              <span className="text-caption text-t2 max-w-full truncate">{exprText(h.expr)}</span>
              <span className="font-display text-[20px] leading-7 font-semibold text-t1 max-w-full truncate">{formatDec(h.result)}</span>
            </button>
          ))
        )}
      </div>
      <div className="shrink-0 h-11 flex items-center justify-end px-2">
        {items.length > 0 && (
          <IconButton title={t('ui.calculator.clear_history')} onMouseDown={e => e.preventDefault()} onClick={onClear}>
            <Trash2 size={16} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
