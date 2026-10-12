import { Plus, X } from 'lucide-react';
import { t } from '@/i18n';
import { ExitFx } from '@/hooks/useExitFx';
import { isDirty, tabTitle, type Tab } from './model';

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/**
 * The Notepad tab row. The active tab shares the editor's layer colour so it reads as
 * one sheet with the menu bar. The close slot shows "•" for unsaved changes and turns into X on
 * hover (always X on a clean active tab); middle-click closes too.
 */
export default function TabStrip({
  tabs,
  activeKey,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: Tab[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="shrink-0 h-10 flex items-end gap-0.5 pl-2 pr-1 bg-win" onMouseDown={e => e.preventDefault()}>
      <div className="flex items-end gap-0.5 h-full min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden" role="tablist">
        {tabs.map(tab => {
          const active = tab.key === activeKey;
          const dirty = isDirty(tab);
          const title = tabTitle(tab);
          return (
            <ExitFx
              exit="tab-out"
              key={tab.key}
              role="tab"
              aria-selected={active}
              title={title}
              onMouseDown={e => {
                if (e.button === 0) onSelect(tab.key);
              }}
              onAuxClick={e => {
                if (e.button === 1) onClose(tab.key);
              }}
              className={cx(
                'group relative h-[34px] flex items-center gap-1 pl-3 pr-1 rounded-t-win cursor-default select-none flex-[0_1_220px] min-w-[96px] transition-colors duration-150 fade-in',
                active ? 'bg-layer text-t1' : 'text-t2 hover:bg-subtle hover:text-t1',
              )}
            >
              <span className="flex-1 min-w-0 truncate text-caption">{title}</span>
              <span className="w-6 h-6 shrink-0 flex items-center justify-center">
                {dirty && <span className={cx('text-[18px] leading-none text-t1', 'group-hover:hidden')}>•</span>}
                <button
                  type="button"
                  tabIndex={-1}
                  title={t('ui.notepad.close_tab')}
                  aria-label={t('ui.notepad.close_tab')}
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => onClose(tab.key)}
                  className={cx(
                    'w-6 h-6 items-center justify-center rounded-ctl text-t1 hover:bg-subtle active:bg-control-press',
                    active && !dirty ? 'flex' : 'hidden group-hover:flex',
                  )}
                >
                  <X size={12} />
                </button>
              </span>
            </ExitFx>
          );
        })}
      </div>
      <button
        type="button"
        tabIndex={-1}
        title={t('ui.notepad.new_tab')}
        aria-label={t('ui.notepad.new_tab')}
        onClick={onNew}
        className="shrink-0 mb-1 w-8 h-7 flex items-center justify-center rounded-ctl text-t1 hover:bg-subtle active:bg-control-press"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
